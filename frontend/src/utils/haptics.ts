import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

// Vibration robuste : haptics natifs (Android + iOS) en app, fallback Web Vibration
// API en navigateur (note: navigator.vibrate n'existe pas sur iOS Safari).
const isNative = Capacitor.isNativePlatform();

const webVibrate = (pattern: number | number[]) => {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(pattern);
  }
};

// Petit retour tactile (sélection / drag côté pilier).
export const hapticLight = () => {
  if (isNative) {
    Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
  } else {
    webVibrate(10);
  }
};

// Retour marqué : une réponse vient d'être attribuée au joueur.
export const hapticAssigned = () => {
  if (isNative) {
    Haptics.notification({ type: NotificationType.Success }).catch(() => {});
  } else {
    webVibrate([120, 60, 120]);
  }
};
