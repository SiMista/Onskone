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

// Avertissement : ta réponse est la PROCHAINE à être révélée (reveal local). Rejoué
// périodiquement tant que c'est le cas (cf. RevealPlayerLocalView). Vraie vibration
// et non plus un tap d'impact : le téléphone est posé sur la table, parfois sous une
// main ou un verre, et un Medium unique passait inaperçu.
export const hapticNextToReveal = () => {
  if (vibrationOff()) return;
  if (isNative) {
    // iOS ignore la durée (buzz système fixe), Android la respecte.
    Haptics.vibrate({ duration: 300 }).catch(() => { /* haptics best-effort */ });
  } else {
    webVibrate([200, 100, 200]);
  }
};

/** Rythme du rappel « tu es le prochain » : un buzz toutes les 4 s, 1 min max
 *  (le pilier peut traîner, inutile de vider la batterie sur la table). */
export const NEXT_TO_REVEAL_BUZZ_MS = 4000;
export const NEXT_TO_REVEAL_MAX_BUZZES = 15;
