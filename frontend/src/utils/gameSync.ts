import { GameStatus, type IGame } from '@onskone/shared';

/**
 * Règles pures de convergence de l'état de partie côté client (testées dans
 * gameSync.test.ts). Le serveur est la seule source de vérité : ces règles
 * décident seulement quoi faire d'un état complet ou d'un delta reçu.
 */

/** Sans état de partie passé ce délai, l'écran de chargement propose de réessayer. */
export const LOADING_SLOW_MS = 8_000;

/** Deux resynchronisations complètes ne sont jamais demandées à moins de cet écart. */
export const RESYNC_MIN_GAP_MS = 1_000;

export type MergeDecision =
  | { apply: true; game: IGame; screenChanged: boolean }
  | { apply: false };

/**
 * Identité de l'ÉCRAN affiché (statut / manche / phase). Plus grossière que
 * l'empreinte de synchro (qui compte aussi les réponses révélées) : un changement
 * d'écran remonte les composants de phase, un simple delta de révélation non.
 */
export const screenKey = (game: IGame | null | undefined): string => {
  if (!game) return 'none';
  const r = game.currentRound;
  return r ? `${game.status}:${r.roundNumber}:${r.phase}` : `${game.status}:-`;
};

/**
 * Un état complet (`gameState`) remplace l'état local, SAUF s'il est manifestement
 * périmé : même manche mais phase antérieure à celle déjà affichée (réponse à une
 * demande partie avant un delta déjà appliqué). Une manche DIFFÉRENTE est toujours
 * acceptée, y compris inférieure : une nouvelle partie dans le même salon
 * recommence à la manche 1 et doit pouvoir écraser l'ancienne.
 * `screenChanged` = l'écran à afficher change (cf. screenKey) : les composants de
 * phase sont alors remontés pour relire les données de reconnexion.
 */
export const mergeGameState = (prev: IGame | null, incoming: IGame, phaseOrder: readonly string[]): MergeDecision => {
  const prevRound = prev?.currentRound;
  const nextRound = incoming.currentRound;
  if (prev && prevRound && nextRound && prevRound.roundNumber === nextRound.roundNumber && prev.status === incoming.status) {
    const nextOrder = phaseOrder.indexOf(nextRound.phase);
    const prevOrder = phaseOrder.indexOf(prevRound.phase);
    if (nextOrder !== -1 && prevOrder !== -1 && nextOrder < prevOrder) return { apply: false };
  }
  return { apply: true, game: incoming, screenChanged: screenKey(prev) !== screenKey(incoming) };
};

/**
 * Un delta de phase (questionSelected, revealResults…) ne s'applique qu'à la manche
 * affichée. Sinon le client a raté une transition (roundStarted…) : on n'applique
 * rien et on demande l'état complet — appliquer le delta à la mauvaise manche
 * faisait afficher une autre question / un autre pilier que le reste de la table.
 */
export const deltaMatchesCurrentRound = (game: IGame | null, roundNumber: number | undefined): boolean => {
  if (!game?.currentRound) return false;
  if (roundNumber === undefined) return true; // serveur antérieur au marquage : on fait confiance
  return game.currentRound.roundNumber === roundNumber;
};

/** Vrai si l'état reçu signifie que la partie est finie : direction l'écran de fin. */
export const isFinished = (game: IGame | null): boolean => game?.status === GameStatus.FINISHED;
