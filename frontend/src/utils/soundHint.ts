import { Capacitor } from '@capacitor/core';
import { getSettings } from './settings';

/**
 * Rappel discret « joue avec le son », une fois par lancement d'app (flag module,
 * donc par iframe dans le Studio). Pas de détection : aucune API web ne donne le
 * volume, et iOS n'expose nulle part l'état du bouton silencieux (qui coupe les
 * sons de l'app sans toucher au volume). Simple toast à l'arrivée dans le salon,
 * pas de popup : on ne bloque personne pour ça. Jamais si le joueur a lui-même
 * coupé les sons dans les Réglages.
 */
let shown = false;

const isIos = (): boolean => {
  if (Capacitor.getPlatform() === 'ios') return true;
  if (typeof navigator === 'undefined') return false;
  // iPadOS se présente comme un Mac : on le reconnaît à l'écran tactile.
  return /iPhone|iPad|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

/** Variante du rappel à afficher maintenant, ou null (déjà vu / sons coupés). */
export const takeSoundHint = (): 'ios' | 'default' | null => {
  if (shown || !getSettings().sound) return null;
  shown = true;
  return isIos() ? 'ios' : 'default';
};
