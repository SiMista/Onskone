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
