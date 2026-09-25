import { useSyncExternalStore } from 'react';
import { Capacitor } from '@capacitor/core';
import { studioStorage } from './studioStorage';
import socket, { setAnnouncedPremium } from './socket';

// Statut premium de l'utilisateur (achat unique à vie "premium").
//
// Source de vérité = RevenueCat (SDK natif). Le backend n'a pas de compte user
// stable, donc on ne persiste PAS le premium côté serveur : le SDK expose
// customerInfo.entitlements, et on le relaie au backend au handshake socket pour
// le gating des thèmes premium ("l'host débloque pour la table").
//
// Le SDK ne fonctionne QU'EN NATIF (Capacitor). Sur web (PC + navigateur mobile),
// il n'y a pas d'achat : le paywall bascule en "va sur le store" (cf. PremiumModal).

// Identifiant de l'entitlement configuré côté RevenueCat.
const ENTITLEMENT_ID = 'premium';

// Clés API publiques RevenueCat, par plateforme (injectées au build via Vite).
const RC_APPLE_KEY = import.meta.env.VITE_RC_APPLE_KEY as string | undefined;
const RC_GOOGLE_KEY = import.meta.env.VITE_RC_GOOGLE_KEY as string | undefined;

// --- Cache local (optimisation d'affichage, JAMAIS la vérité) ----------------
// Versionné façon playerStats.ts. En web/Studio, sert aussi d'override de test.
const CACHE_KEY = 'onskone_premium';
const CACHE_VERSION = 1;

const readCache = (): boolean => {
  try {
    const raw = studioStorage.getItem(CACHE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || parsed.version !== CACHE_VERSION) return false;
    return parsed.premium === true;
  } catch {
    return false;
  }
};

const writeCache = (premium: boolean): void => {
  try {
    studioStorage.setItem(CACHE_KEY, JSON.stringify({ version: CACHE_VERSION, premium }));
  } catch {
    /* silent */
  }
};

// --- Store réactif (même pattern que versionGate.ts) -------------------------
let isPremium = readCache();
// Synchro immédiate du flag annoncé au handshake avec le cache : sinon le tout
// premier createLobby/joinLobby annoncerait premium=false même si l'appareil est
// déjà premium (cache/override Studio écrit avant l'ouverture du socket).
setAnnouncedPremium(isPremium);
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const setPremium = (next: boolean): void => {
  if (next === isPremium) return;
  isPremium = next;
  writeCache(next);
  setAnnouncedPremium(next);
  // Réannoncer au backend : le handshake auth est réévalué à la reconnexion.
  try {
    socket.disconnect();
    socket.connect();
  } catch {
    /* silent */
  }
  emit();
};

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};

/** Hook React : renvoie true si l'utilisateur est premium. Re-render au changement. */
export const usePremium = (): boolean =>
  useSyncExternalStore(subscribe, () => isPremium, () => isPremium);

/** Lecture synchrone hors composant (ex. buildSlotUrl). */
export const getIsPremium = (): boolean => isPremium;

/** true si l'achat in-app est possible (natif uniquement). Sinon → redirection store. */
export const canPurchase = (): boolean => Capacitor.isNativePlatform();

// --- Override de test (web / Studio) -----------------------------------------
// Permet de tester le déblocage sans vrai achat (pas de SDK sur web).
export const setPremiumOverride = (v: boolean): void => setPremium(v);

// --- SDK RevenueCat ----------------------------------------------------------
// Import dynamique : le module premium.ts reste chargeable même si le plugin
// n'est pas (encore) installé, et le web ne touche jamais au SDK natif.
//
// Contrat minimal du SDK qu'on utilise (évite un couplage de type dur au paquet,
// et laisse le build passer tant que le plugin n'est pas installé). Cf. doc
// RevenueCat Capacitor : https://www.revenuecat.com/docs/getting-started
interface RCCustomerInfo {
  entitlements: { active: Record<string, unknown> };
}
interface RCPackage { identifier: string }
interface RCPurchasesApi {
  // configure()/setLogLevel() sont déclarés RETURN_NONE côté natif : le proxy
  // Capacitor renvoie alors un callbackId (string) de façon SYNCHRONE, pas une
  // Promise, malgré ce qu'annoncent les .d.ts du plugin. Ne jamais `.then` /
  // `.catch` dessus ni les passer à withTimeout.
  configure(opts: { apiKey: string }): void | Promise<void>;
  setLogLevel?(opts: { level: string }): void | Promise<void>;
  getCustomerInfo(): Promise<{ customerInfo: RCCustomerInfo }>;
  getOfferings(): Promise<{ current?: { availablePackages?: RCPackage[] } }>;
  purchasePackage(opts: { aPackage: RCPackage }): Promise<{ customerInfo: RCCustomerInfo }>;
  restorePurchases(): Promise<{ customerInfo: RCCustomerInfo }>;
}
type PurchasesModule = { Purchases: RCPurchasesApi };

// Toute erreur du SDK est tracée : muettes, elles rendent le paywall
// indiagnosticable sur device (cf. `chrome://inspect` / logcat / Console.app).
const rcLog = (msg: string, err?: unknown): void => {
  console.error(`[premium] ${msg}`, err ?? '');
};

// Délai au-delà duquel on considère qu'un appel RÉSEAU du SDK (getOfferings,
// getCustomerInfo) ne répondra pas : sans plafond, l'UI reste bloquée sur son
// état "achat en cours". Réservé à ces appels : purchasePackage et
// restorePurchases sont pilotés par l'utilisateur (feuille Play / Apple, mot de
// passe, ajout de CB, 3-D Secure…) et dépassent légitimement n'importe quel
// délai. Les plafonner rejetait un achat encore en cours puis jetait son
// résultat : payé, pas premium.
const SDK_TIMEOUT_MS = 15_000;

const withTimeout = <T>(promise: Promise<T>, label: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`[premium] ${label} n'a pas répondu en ${SDK_TIMEOUT_MS}ms`));
    }, SDK_TIMEOUT_MS);
    // Promise.resolve : une valeur non-promesse (méthode RETURN_NONE du pont) ne
    // doit pas faire exploser l'executor en TypeError.
    Promise.resolve(promise).then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });

// Vrai une fois configure() abouti. Les appels d'achat le vérifient : le SDK
// rejette toute requête émise avant sa configuration.
let configured = false;
// Promesse d'initPremium(), mémorisée pour être attendue par les achats.
let configurePromise: Promise<void> | null = null;

let purchasesPromise: Promise<PurchasesModule | null> | null = null;
const loadPurchases = (): Promise<PurchasesModule | null> => {
  if (!purchasesPromise) {
    // @vite-ignore + cast : le paquet est résolu au runtime natif uniquement.
    purchasesPromise = import(/* @vite-ignore */ '@revenuecat/purchases-capacitor')
      .then((m) => m as unknown as PurchasesModule)
      .catch((err) => {
        rcLog('import du plugin impossible', err);
        return null;
      });
  }
  return purchasesPromise;
};

const readEntitlement = (customerInfo: { entitlements: { active: Record<string, unknown> } }): boolean =>
  Boolean(customerInfo?.entitlements?.active?.[ENTITLEMENT_ID]);

/**
 * Configure le SDK et rafraîchit le statut. À appeler une fois au boot (App.tsx).
 * La promesse est mémorisée (`configurePromise`) : purchasePremium/restorePurchases
 * l'attendent avant de parler au SDK. Sans ça, un clic rapide sur le paywall
 * appelle getOfferings() sur un SDK non configuré, que le natif rejette
 * ("Purchases must be configured before calling this function").
 */
export const initPremium = (): Promise<void> => {
  // Idempotent : App.tsx l'appelle sans await, les achats réutilisent la promesse.
  if (!configurePromise) configurePromise = runInit();
  return configurePromise;
};

const runInit = async (): Promise<void> => {
  // Web/Studio : pas de SDK. On garde le cache/override en place.
  if (!Capacitor.isNativePlatform()) {
    setAnnouncedPremium(isPremium);
    configured = false;
    return;
  }
  const platform = Capacitor.getPlatform();
  const apiKey = platform === 'ios' ? RC_APPLE_KEY : RC_GOOGLE_KEY;
  if (!apiKey) {
    // Clé absente du build (variable Vite non injectée par la CI) : les achats
    // sont inertes. Muet, ce cas est indiscernable d'un vrai échec d'achat.
    rcLog(`clé API ${platform} absente du build → achats désactivés`);
    return;
  }

  const mod = await loadPurchases();
  if (!mod) return;
  try {
    // configure()/setLogLevel() sont RETURN_NONE côté natif : le proxy Capacitor
    // poste l'appel et renvoie un callbackId (string) de façon SYNCHRONE. Il n'y
    // a aucune promesse à attendre ni à plafonner. Les enrober (`.catch`,
    // withTimeout) levait un TypeError, `configured` restait false à vie, et
    // achats comme restauration étaient morts pour tout le monde.
    // Logs natifs du SDK (visibles dans logcat / Console.app), dev uniquement.
    if (import.meta.env.DEV && mod.Purchases.setLogLevel) {
      try { void mod.Purchases.setLogLevel({ level: 'DEBUG' }); } catch { /* best-effort */ }
    }
    void mod.Purchases.configure({ apiKey });
    configured = true;
    await refreshPremiumStatus();
  } catch (err) {
    // On garde le dernier statut connu (cache), mais on trace : sans ça, une clé
    // invalide ressemble à un achat qui échoue pour une raison mystérieuse.
    rcLog('configure a échoué → achats indisponibles', err);
  }
};

/** Attend la configuration lancée au boot. true si le SDK est utilisable. */
const ensureConfigured = async (): Promise<boolean> => {
  if (configurePromise) {
    try {
      await configurePromise;
    } catch {
      /* initPremium trace déjà l'échec */
    }
  }
  return configured;
};

/** Relit le statut depuis le SDK et met à jour le store. */
export const refreshPremiumStatus = async (): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) return isPremium;
  const mod = await loadPurchases();
  if (!mod) return isPremium;
  try {
    const { customerInfo } = await withTimeout(mod.Purchases.getCustomerInfo(), 'getCustomerInfo');
    const active = readEntitlement(customerInfo);
    setPremium(active);
    return active;
  } catch (err) {
    rcLog('getCustomerInfo a échoué → statut inchangé', err);
    return isPremium;
  }
};

/**
 * Pourquoi une tentative n'a pas abouti, quand `ok` est false :
 * - `cancelled` : l'utilisateur a fermé la feuille native → ne RIEN afficher ;
 * - `empty`     : le SDK a répondu, mais aucun achat/entitlement à la clé. Sur une
 *                 restauration c'est le cas NORMAL du "je n'ai jamais acheté" ;
 * - `unavailable`: le SDK répond mais le store ne sert aucun produit achetable
 *                 (produit pas encore approuvé par Apple/Google, contrat Paid
 *                 Applications non signé, app hors piste de test…). Rien à
 *                 corriger côté app : c'est une config store en attente ;
 * - `error`     : échec réel (réseau, SDK absent, SDK non configuré…).
 *
 * `empty` et `error` doivent rester distincts : dire "aucun achat à restaurer" à
 * quelqu'un qui est juste hors-ligne revient à lui affirmer qu'il n'a pas payé.
 * `unavailable` de même : ce n'est ni une panne ni une faute de l'utilisateur.
 */
export type PurchaseFailure = 'cancelled' | 'empty' | 'error' | 'unavailable';

/**
 * Résultat d'une tentative d'achat/restauration. Permet à l'UI de distinguer :
 * - `ok`      : premium actif après l'opération → fermer la modale ;
 * - `failure` : pourquoi ça n'a pas marché (cf. PurchaseFailure) → message adapté.
 * Sans ça, un bouton qui "ne fait rien" en cas d'échec ressemble au bug 2.1(b) d'Apple.
 */
export interface PurchaseResult {
  ok: boolean;
  failure?: PurchaseFailure;
}

/** true si l'erreur RevenueCat correspond à une annulation utilisateur (pas un échec). */
const isUserCancelled = (err: unknown): boolean => {
  const e = err as { userCancelled?: boolean; code?: string | number; message?: string } | null;
  if (!e) return false;
  return (
    e.userCancelled === true ||
    e.code === 'PURCHASE_CANCELLED' ||
    e.code === 1 || // PurchasesErrorCode.PurchaseCancelledError
    /cancel/i.test(e.message ?? '')
  );
};

/**
 * Lance l'achat premium (feuille native Play/StoreKit). Ne DOIT être appelé
 * qu'en natif (cf. canPurchase). L'UI utilise le résultat pour afficher un toast
 * en cas d'échec réel (mais pas si l'utilisateur a simplement annulé).
 */
export const purchasePremium = async (): Promise<PurchaseResult> => {
  // Web : le bouton d'achat n'est même pas rendu (cf. canPurchase), donc y
  // arriver signale un appel qui n'aurait pas dû se produire → 'error'.
  if (!Capacitor.isNativePlatform()) return { ok: false, failure: 'error' };
  const mod = await loadPurchases();
  if (!mod) return { ok: false, failure: 'error' }; // plugin absent du build
  // Le SDK rejette tout appel émis avant sa configuration.
  if (!(await ensureConfigured())) {
    rcLog('achat impossible : SDK non configuré');
    return { ok: false, failure: 'error' };
  }
  try {
    const offerings = await withTimeout(mod.Purchases.getOfferings(), 'getOfferings');
    const pkg = offerings.current?.availablePackages?.[0];
    if (!pkg) {
      // L'offering existe côté RevenueCat mais le store ne résout aucun produit :
      // typiquement un achat in-app pas encore approuvé, ou une app pas publiée
      // sur une piste. Distinct d'une panne — l'utilisateur ne peut rien y faire.
      rcLog('offering sans package achetable → produit indisponible sur le store');
      return { ok: false, failure: 'unavailable' };
    }
    // Pas de withTimeout : c'est l'utilisateur qui pilote la feuille native, et le
    // natif règle toujours la promesse quand elle se ferme (achat, annulation,
    // erreur). Cf. SDK_TIMEOUT_MS.
    const { customerInfo } = await mod.Purchases.purchasePackage({ aPackage: pkg });
    const active = readEntitlement(customerInfo);
    setPremium(active);
    // Achat "réussi" sans entitlement actif : anormal (config RevenueCat), on le
    // signale plutôt que de laisser l'user devant une modale qui ne se ferme pas.
    if (!active) rcLog('achat abouti mais entitlement inactif (config RevenueCat ?)');
    return active ? { ok: true } : { ok: false, failure: 'error' };
  } catch (err) {
    // Annulation utilisateur : pas une erreur à signaler.
    if (isUserCancelled(err)) return { ok: isPremium, failure: 'cancelled' };
    rcLog('achat échoué', err);
    return { ok: false, failure: 'error' };
  }
};

/** Restaure les achats (obligatoire Apple). Même contrat de résultat que purchasePremium. */
export const restorePurchases = async (): Promise<PurchaseResult> => {
  if (!Capacitor.isNativePlatform()) return { ok: false, failure: 'error' };
  const mod = await loadPurchases();
  if (!mod) return { ok: false, failure: 'error' };
  if (!(await ensureConfigured())) {
    rcLog('restauration impossible : SDK non configuré');
    return { ok: false, failure: 'error' };
  }
  try {
    // Pas de withTimeout : prompt Apple ID / Play possible, piloté par l'utilisateur.
    const { customerInfo } = await mod.Purchases.restorePurchases();
    const active = readEntitlement(customerInfo);
    setPremium(active);
    // Le SDK a bien répondu : pas d'entitlement = ce compte n'a rien acheté.
    // Cas NORMAL, à ne surtout pas confondre avec un échec réseau ('error').
    return active ? { ok: true } : { ok: false, failure: 'empty' };
  } catch (err) {
    if (isUserCancelled(err)) return { ok: isPremium, failure: 'cancelled' };
    rcLog('restauration échouée', err);
    return { ok: false, failure: 'error' };
  }
};
