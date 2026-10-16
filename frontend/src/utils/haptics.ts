import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { getSettings } from './settings';

// Vibration robuste : haptics natifs (Android + iOS) en app, fallback Web Vibration
// API en navigateur (note: navigator.vibrate n'existe pas sur iOS Safari).
const isNative = Capacitor.isNativePlatform();

/** L'appareil sait vibrer (app native, ou navigateur avec Vibration API — pas iOS Safari). */
export const canVibrate = isNative
  || (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function');

// Vibrations coupées dans les Réglages : lu à chaque appel, effet immédiat.
const vibrationOff = () => !getSettings().vibration;

const webVibrate = (pattern: number | number[]) => {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(pattern);
  }
};

// Retour marqué : une réponse vient d'être attribuée au joueur (jamais côté pilier,
// qui attribue). Aussi joué à l'activation dans les Réglages, en aperçu fidèle.
// `notification(Success)` était trop discret pour être senti téléphone posé sur
// la table — on double d'un impact Heavy.
export const hapticAssigned = () => {
  if (vibrationOff()) return;
  if (isNative) {
    Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => { /* haptics best-effort */ });
    Haptics.notification({ type: NotificationType.Success }).catch(() => { /* haptics best-effort */ });
  } else {
    webVibrate([160, 70, 160]);
  }
};

// Réussite ponctuelle, téléphone en main (ex. achat Premium abouti) : la
// notification Success seule suffit, pas besoin de l'impact Heavy d'hapticAssigned.
export const hapticSuccess = () => {
  if (vibrationOff()) return;
  if (isNative) {
    Haptics.notification({ type: NotificationType.Success }).catch(() => { /* haptics best-effort */ });
  } else {
    webVibrate([60, 40, 60]);
  }
};
