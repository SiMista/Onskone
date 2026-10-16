import { useSyncExternalStore } from 'react';
import { Capacitor } from '@capacitor/core';

// État partagé "le bandeau de téléchargement app est-il affiché ?".
// Permet à la Home de décaler ses boutons du haut (Premium / langue) SANS
// pousser tout le contenu, et de les remonter quand on ferme le bandeau.
// Web uniquement (le bandeau n'existe pas en natif).

let visible = !Capacitor.isNativePlatform();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const hideAppBanner = (): void => {
  if (!visible) return;
  visible = false;
  emit();
};

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};

/** Hook : true tant que le bandeau app occupe le haut de l'écran. */
export const useAppBannerVisible = (): boolean =>
  useSyncExternalStore(subscribe, () => visible, () => visible);

/**
 * Position des boutons flottants du haut (Premium, Réglages), conteneurs `absolute`
 * + `safe-pt`. Mobile : le bandeau prend toute la largeur, on passe dessous tant
 * qu'il est affiché. Grand écran (tablet:) : il est centré et laisse les côtés
 * libres, les boutons restent TOUJOURS alignés sur son centre (~38px), bandeau ou
 * non, pour que sa fermeture ne les fasse pas bouger. Translate -50% : le centre du
 * bouton vaut alors top + safe-pt / 2 (24px / 2), quelle que soit sa hauteur, d'où 26px.
 */
export const topControlsClass = (bannerVisible: boolean): string =>
  `${bannerVisible ? 'top-[4.5rem]' : 'top-3'} tablet:top-[26px] tablet:-translate-y-1/2`;
