import { useSyncExternalStore } from 'react';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import type { AdMobPlugin } from '@capacitor-community/admob';
import { studioStorage } from './studioStorage';
import { getIsPremium, initPremium } from './premium';
import { getLastGame } from './playerHelpers';
import { reportClientLog, describeError, type ClientLogLevel } from './clientLog';
import {
  parseAdMemory,
  launchAdSkipReason,
  canShowEndGameAd,
  type AdMemory,
  type LaunchAdSkipReason,
} from './adPolicy';

// Pubs AdMob (natif uniquement : rien sur le web ni dans le Studio).
//
// Règle produit : JAMAIS de pub pendant une partie. Deux emplacements, entre les
// parties : la pub d'ouverture au lancement (format "App open" : un interstitiel au
// lancement est interdit par AdMob) et l'interstitiel en quittant l'écran de fin.
// Premium = le SDK n'est même pas initialisé : ni pub, ni popup de consentement.
// Les règles pures (quand sauter une pub) sont dans adPolicy.ts.

// IDs AdMob : publics par nature (ils finissent en clair dans l'app). Les App IDs
// (`~`) sont dans le manifest Android et injectés dans l'Info.plist par Codemagic.
const AD_UNITS = {
  android: {
    appOpen: 'ca-app-pub-1213483210041504/3321598566',
    interstitial: 'ca-app-pub-1213483210041504/8096157958',
  },
  ios: {
    appOpen: 'ca-app-pub-1213483210041504/8896349710',
    interstitial: 'ca-app-pub-1213483210041504/9848223326',
  },
} as const;

// Blocs de démo de Google. JAMAIS de vraies pubs en dev : un clic sur ses propres
// pubs = trafic invalide = compte suspendu. VITE_ADMOB_TEST_ADS=1 force aussi les
// pubs de test sur un build de prod (pour tester sur son téléphone).
const TEST_AD_UNITS = {
  android: {
    appOpen: 'ca-app-pub-3940256099942544/9257395921',
    interstitial: 'ca-app-pub-3940256099942544/1033173712',
  },
  ios: {
    appOpen: 'ca-app-pub-3940256099942544/5575463023',
    interstitial: 'ca-app-pub-3940256099942544/4411468910',
  },
} as const;

const USE_TEST_ADS = import.meta.env.DEV || (import.meta.env.VITE_ADMOB_TEST_ADS as string | undefined) === '1';

const adUnit = (format: 'appOpen' | 'interstitial'): string => {
  const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
  return (USE_TEST_ADS ? TEST_AD_UNITS : AD_UNITS)[platform][format];
};

// Le splash natif reste affiché le temps de trancher (et de montrer) la pub
// d'ouverture, comme le recommande Google : une pub qui surgit sur l'accueil déjà
// affiché, c'est une pub "surprise". Au-delà de ce délai on renonce à la pub de ce
// lancement. Reste sous le launchShowDuration du splash (capacitor.config.ts).
const LAUNCH_AD_DEADLINE_MS = 3500;
// Attente max du statut premium frais (RevenueCat) avant d'initialiser le SDK : le
// cache local peut être vide sur un téléphone neuf alors que l'achat existe.
const PREMIUM_WAIT_MS = 1500;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// --- Logs --------------------------------------------------------------------
// Même canal que premium.ts (onglet « Logs » de l'admin) : sur iPhone sans Mac, la
// console de la WebView est inaccessible.
const adsLog = (msg: string, err?: unknown, level: ClientLogLevel = 'error'): void => {
  (level === 'error' ? console.error : console.warn)(`[ads] ${msg}`, err ?? '');
  reportClientLog('ads', msg, err !== undefined ? describeError(err) : undefined, level);
};

// Une pub qui ne charge pas (pas de pub dispo, réseau) est un cas NORMAL : tracée
// une seule fois par format et par session, pour ne pas épuiser le quota de logs.
const loggedLoadFailures = new Set<string>();
const logLoadFailure = (format: string, err: unknown): void => {
  if (loggedLoadFailures.has(format)) return;
  loggedLoadFailures.add(format);
  adsLog(`${format} : chargement impossible`, err, 'info');
};

// --- Mémoire locale (studioStorage, cf. adPolicy.AdMemory) -------------------
const MEMORY_KEY = 'onskone_ads';

const readMemory = (): AdMemory => {
  try {
    return parseAdMemory(studioStorage.getItem(MEMORY_KEY));
  } catch {
    return parseAdMemory(null);
  }
};

const updateMemory = (patch: Partial<Omit<AdMemory, 'version'>>): void => {
  try {
    studioStorage.setItem(MEMORY_KEY, JSON.stringify({ ...readMemory(), ...patch }));
  } catch {
    /* silent */
  }
};

// --- Store réactif (même pattern que premium.ts) -----------------------------
let consentIntroOpen = false;
let privacyOptionsRequired = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};

/** Hook React : true pendant l'écran d'intro qui précède le formulaire de Google. */
export const useAdConsentIntro = (): boolean =>
  useSyncExternalStore(subscribe, () => consentIntroOpen, () => consentIntroOpen);

/** Hook React : true si le RGPD impose un point d'entrée "Choix publicitaires" (Réglages). */
export const useAdPrivacyOptions = (): boolean =>
  useSyncExternalStore(subscribe, () => privacyOptionsRequired, () => privacyOptionsRequired);

let resolveConsentIntro: (() => void) | null = null;

const askConsentIntro = (): Promise<void> =>
  new Promise<void>((resolve) => {
    resolveConsentIntro = resolve;
    consentIntroOpen = true;
    emit();
  });

/** Bouton "Continuer" (ou fermeture) de l'écran d'intro : enchaîne sur le formulaire de Google. */
export const continueConsentIntro = (): void => {
  if (!consentIntroOpen) return;
  consentIntroOpen = false;
  emit();
  const resolve = resolveConsentIntro;
  resolveConsentIntro = null;
  resolve?.();
};

// --- SDK ---------------------------------------------------------------------
// Import dynamique : le web ne charge jamais le plugin.
type AdMobModule = typeof import('@capacitor-community/admob');
let modulePromise: Promise<AdMobModule | null> | null = null;
const loadAdMob = (): Promise<AdMobModule | null> => {
  if (!modulePromise) {
    modulePromise = import('@capacitor-community/admob').catch((err) => {
      adsLog('import du plugin impossible', err);
      return null;
    });
  }
  return modulePromise;
};

// `plugin` : chargé dès qu'on sait que le joueur n'est pas premium (formulaires de
// consentement). `readyPromise` : vrai seulement une fois le SDK pub initialisé AVEC
// un consentement qui autorise les requêtes de pub.
let plugin: AdMobPlugin | null = null;
let interstitialEvents: AdMobModule['InterstitialAdPluginEvents'] | null = null;
let readyPromise: Promise<boolean> | null = null;

let releaseSplashFn: (() => void) | null = null;
const splashReleased = new Promise<void>((resolve) => { releaseSplashFn = resolve; });
const releaseSplash = (): void => releaseSplashFn?.();

/**
 * Lance les pubs au boot (App.tsx, natif). Idempotent. Résout quand le splash peut
 * disparaître : tout de suite si aucune pub d'ouverture n'est prévue, sinon une
 * fois la pub fermée ou abandonnée (trop lente).
 */
export const initAds = (): Promise<void> => {
  if (!readyPromise) {
    setTimeout(releaseSplash, LAUNCH_AD_DEADLINE_MS);
    readyPromise = runInit()
      .catch((err) => {
        adsLog('initialisation impossible → pas de pub', err);
        return false;
      })
      .finally(releaseSplash);
  }
  return splashReleased;
};

const runInit = async (): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) return false;

  const startedAt = Date.now();
  const memory = readMemory();
  // Ce lancement compte même si on s'arrête plus bas : le 1er n'a jamais de pub d'ouverture.
  updateMemory({ launches: memory.launches + 1 });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') updateMemory({ lastSeenAt: Date.now() });
  });

  // Une partie à reprendre = on est "pendant une partie" : ni pub, ni popup.
  const hasGameToResume = getLastGame() !== null;
  // Relu juste avant chaque popup : le consentement peut mettre des secondes à
  // répondre (réseau lent), le temps de rejoindre une partie (mémorisée par Game.tsx).
  const inGame = (): boolean => hasGameToResume || getLastGame() !== null;
  let launchSkip: LaunchAdSkipReason | 'prompted' | null = launchAdSkipReason({
    now: startedAt,
    memory,
    premium: getIsPremium(),
    hasGameToResume,
  });
  if (launchSkip) releaseSplash();

  await Promise.race([initPremium(), sleep(PREMIUM_WAIT_MS)]);
  if (getIsPremium()) return false;

  const mod = await loadAdMob();
  if (!mod) return false;
  const { AdMob, AdmobConsentStatus, InterstitialAdPluginEvents } = mod;
  plugin = AdMob;
  interstitialEvents = InterstitialAdPluginEvents;
  const ios = Capacitor.getPlatform() === 'ios';

  // iOS : le plugin 8.1.0 ne branche le formulaire de consentement sur l'écran
  // qu'à l'init (corrigé en 8.2, qui exige Capacitor 8.5). Android garde l'ordre
  // recommandé par Google : consentement d'abord, SDK ensuite.
  if (ios) await AdMob.initialize();

  let consent;
  try {
    consent = await AdMob.requestConsentInfo();
  } catch (err) {
    // Hors ligne au lancement : cas banal, pas une panne. Pas de pub cette session.
    adsLog('consentement : statut illisible (hors ligne ?) → pas de pub', err, 'info');
    return false;
  }
  if (
    consent.status === AdmobConsentStatus.REQUIRED
    && consent.isConsentFormAvailable
    && !inGame()
  ) {
    releaseSplash();
    launchSkip = 'prompted';
    await askConsentIntro();
    // Partie lancée pendant l'intro : pas de formulaire Google en pleine manche
    // (redemandé au prochain lancement).
    if (!inGame()) consent = await AdMob.showConsentForm();
  }

  // ATT : normalement présenté par UMP via le message IDFA publié dans AdMob. Filet
  // si ce message manque : on le demande nous-mêmes, une seule fois (notDetermined).
  if (ios && !inGame()) {
    const tracking = await AdMob.trackingAuthorizationStatus();
    if (tracking.status === 'notDetermined') {
      releaseSplash();
      launchSkip = 'prompted';
      await AdMob.requestTrackingAuthorization();
    }
  }

  // Enum PrivacyOptionsRequirementStatus non réexporté par le plugin 8.1.0 : on
  // compare sa valeur (chaîne) directement.
  privacyOptionsRequired = (consent.privacyOptionsRequirementStatus as string) === 'REQUIRED';
  emit();

  if (!consent.canRequestAds) return false;
  if (!ios) await AdMob.initialize();

  if (!launchSkip) await showLaunchAd(AdMob, startedAt + LAUNCH_AD_DEADLINE_MS);
  return true;
};

const showLaunchAd = async (AdMob: AdMobPlugin, deadline: number): Promise<void> => {
  const remaining = deadline - Date.now();
  if (remaining <= 0) return;
  const adId = adUnit('appOpen');
  const loaded = await Promise.race([
    AdMob.loadAppOpen({ adId }).then(
      () => true,
      (err) => { logLoadFailure('pub d\'ouverture', err); return false; },
    ),
    sleep(remaining).then(() => false),
  ]);
  // Chargée trop tard : l'accueil est déjà affiché, la pub surgirait par surprise.
  // App passée en arrière-plan pendant le splash : jamais de pub hors de l'app.
  // Partie rejointe pendant le chargement : jamais de pub en partie.
  if (
    !loaded
    || Date.now() >= deadline
    || getIsPremium()
    || document.visibilityState !== 'visible'
    || getLastGame() !== null
  ) return;
  updateMemory({ lastAdAt: Date.now() });
  try {
    // Se résout à la FERMETURE de la pub (Android et iOS) : le splash part après.
    await AdMob.showAppOpen({ adId });
  } catch (err) {
    adsLog('pub d\'ouverture : affichage impossible', err, 'warn');
  }
};

// --- Interstitiel de fin de partie -------------------------------------------
let interstitial: 'idle' | 'loading' | 'ready' = 'idle';

/**
 * Précharge l'interstitiel dès l'écran de fin (Google recommande de précharger),
 * pour qu'il s'affiche sans attente quand le joueur quitte cet écran.
 */
export const prepareEndGameAd = async (): Promise<void> => {
  if (!readyPromise || !(await readyPromise)) return;
  if (!plugin || getIsPremium() || interstitial !== 'idle') return;
  interstitial = 'loading';
  try {
    await plugin.prepareInterstitial({ adId: adUnit('interstitial') });
    interstitial = 'ready';
  } catch (err) {
    interstitial = 'idle';
    logLoadFailure('interstitiel', err);
  }
};

// Filet si l'event de fermeture ne vient jamais : le joueur quitte alors l'écran de
// fin derrière la pub au lieu d'y rester coincé.
const END_GAME_AD_MAX_MS = 60_000;

let endGameAdClosed: Promise<void> | null = null;

/**
 * Au clic sur "Retour au salon" / "Accueil" de l'écran de fin : affiche
 * l'interstitiel s'il est prêt, sinon rien (on ne fait JAMAIS attendre un joueur
 * pour une pub). Se résout à la FERMETURE de la pub, tout de suite s'il n'y en a
 * pas : "Retour au salon" ne rejoint le salon qu'après (cf. EndGame).
 */
export const showEndGameAd = (): Promise<void> => {
  // Pub déjà en cours (double appel) : même attente.
  if (endGameAdClosed) return endGameAdClosed;
  if (!plugin || !interstitialEvents || interstitial !== 'ready') return Promise.resolve();
  const now = Date.now();
  if (!canShowEndGameAd({ now, premium: getIsPremium(), lastAdAt: readMemory().lastAdAt })) return Promise.resolve();
  interstitial = 'idle';
  updateMemory({ lastAdAt: now });

  const ad = plugin;
  const events = interstitialEvents;
  endGameAdClosed = new Promise<void>((resolve) => {
    const handles: Promise<PluginListenerHandle>[] = [];
    let settled = false;
    const done = (): void => {
      if (settled) return;
      settled = true;
      clearTimeout(fallback);
      handles.forEach((h) => { void h.then((l) => l.remove()).catch(() => undefined); });
      endGameAdClosed = null;
      resolve();
    };
    const fallback = setTimeout(done, END_GAME_AD_MAX_MS);
    // Android résout showInterstitial dès l'AFFICHAGE : seule la fermeture compte.
    handles.push(
      ad.addListener(events.Dismissed, done),
      ad.addListener(events.FailedToShow, done),
    );
    Promise.all(handles)
      .then(() => ad.showInterstitial())
      .catch((err) => {
        adsLog('interstitiel : affichage impossible', err, 'warn');
        done();
      });
  });
  return endGameAdClosed;
};

/** "Choix publicitaires" (Réglages) : rouvre le formulaire de consentement de Google. */
export const openAdPrivacyOptions = async (): Promise<void> => {
  if (!plugin) return;
  try {
    await plugin.showPrivacyOptionsForm();
  } catch (err) {
    adsLog('choix publicitaires : formulaire impossible', err, 'warn');
  }
};
