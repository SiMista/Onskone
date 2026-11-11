import { Capacitor } from '@capacitor/core';
import { Volume } from '@capawesome/capacitor-volume';
import { getSettings } from './settings';

/**
 * Rappel « monte le son », au lancement de la partie (gameStarted reçu dans le
 * salon), UNIQUEMENT si le volume média du téléphone est à 0. Simple toast, pas de
 * popup : on ne bloque personne pour ça.
 * - Au plus une fois par lancement d'app (flag module) ; tant qu'il n'a pas été
 *   montré, on revérifie le volume à chaque partie.
 * - Jamais si le joueur a coupé les sons dans les Réglages.
 * - Jamais sur le web : aucune API web ne donne le volume, et un rappel à
 *   l'aveugle tombait sur des joueurs qui avaient déjà le son.
 * - Volume illisible (plugin en échec) : rien, plutôt qu'un rappel à l'aveugle.
 * Le bouton silencieux de l'iPhone reste indétectable (Apple n'expose rien) : la
 * variante iOS le rappelle quand le volume est à 0.
 */
let shown = false;

/** Variante du rappel à afficher maintenant, ou null (web / déjà vu / sons coupés / volume > 0). */
export const takeSoundHint = async (): Promise<'ios' | 'default' | null> => {
  if (shown || !getSettings().sound || !Capacitor.isNativePlatform()) return null;
  let volume: number;
  try {
    ({ volume } = await Volume.getVolume());
  } catch {
    return null;
  }
  // Revérifié après l'attente : deux parties lancées coup sur coup ne doublent pas le toast.
  if (shown || volume > 0) return null;
  shown = true;
  return Capacitor.getPlatform() === 'ios' ? 'ios' : 'default';
};

/** Tests uniquement : remet le flag « déjà montré » à zéro. */
export const resetSoundHintForTests = (): void => {
  shown = false;
};
