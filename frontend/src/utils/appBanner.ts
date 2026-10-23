import { useSyncExternalStore } from 'react';
import { Capacitor } from '@capacitor/core';

// Notification temporaire "télécharge l'app" : WEB uniquement (jamais en natif).
// Affichée au lancement de l'appli web et en fin de partie, puis se retire seule
// après APP_BANNER_DURATION_MS (la barre de durée du bandeau s'écoule sur ce délai).

export const APP_BANNER_DURATION_MS = 7000;
/** Délai avant la 1re apparition (laisser l'accueil se poser) et durée du fondu de sortie. */
export const APP_BANNER_LAUNCH_DELAY_MS = 3000;
export const APP_BANNER_EXIT_MS = 450;

const isWeb = !Capacitor.isNativePlatform();

interface BannerState {
  visible: boolean;
  /** Fondu de sortie en cours (le bandeau reste monté le temps de l'animation). */
  leaving: boolean;
  /** Horodatage d'affichage : recale la barre de durée si le bandeau se monte après coup. */
  shownAt: number;
}

let state: BannerState = { visible: false, leaving: false, shownAt: 0 };
let showTimer: ReturnType<typeof setTimeout> | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
let exitTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const clear = (t: ReturnType<typeof setTimeout> | null) => { if (t) clearTimeout(t); return null; };

/** Retire le bandeau en fondu (annule aussi une apparition programmée). */
export const hideAppBanner = (): void => {
  showTimer = clear(showTimer);
  hideTimer = clear(hideTimer);
  if (!state.visible || state.leaving) return;
  state = { ...state, leaving: true };
  emit();
  exitTimer = clear(exitTimer);
  exitTimer = setTimeout(() => {
    exitTimer = null;
    state = { ...state, visible: false, leaving: false };
    emit();
  }, APP_BANNER_EXIT_MS);
};

/**
 * Programme l'apparition (après `delayMs`) ou ré-affiche la notification, durée remise à
 * zéro ; elle se retire seule après APP_BANNER_DURATION_MS. No-op en natif.
 */
export const showAppBanner = (delayMs = 0): void => {
  if (!isWeb) return;
  showTimer = clear(showTimer);
  hideTimer = clear(hideTimer);
  exitTimer = clear(exitTimer);
  showTimer = setTimeout(() => {
    showTimer = null;
    state = { visible: true, leaving: false, shownAt: Date.now() };
    emit();
    hideTimer = setTimeout(hideAppBanner, APP_BANNER_DURATION_MS);
  }, delayMs);
};

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};

export const useAppBanner = (): BannerState =>
  useSyncExternalStore(subscribe, () => state, () => state);

// Lancement de l'appli web : apparition différée, pas dès la première image.
showAppBanner(APP_BANNER_LAUNCH_DELAY_MS);

/**
 * Position des boutons flottants du haut (Premium, Réglages), conteneurs `absolute`
 * + `safe-pt`. Alignés sur le centre du logo (~38px) en grand écran. Translate -50% :
 * le centre du bouton vaut alors top + safe-pt / 2 (24px / 2), quelle que soit sa
 * hauteur, d'où 26px. Le bandeau est un overlay : il ne les déplace jamais.
 */
export const TOP_CONTROLS_CLASS = 'top-3 tablet:top-[26px] tablet:-translate-y-1/2';
