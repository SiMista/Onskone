import type { RevealResult } from './types/socket-events.js';
import { tableTurnFrom } from './seating.js';

/**
 * Une entrée est "ciblée Personne" : le pilier ne l'a attribuée à aucun joueur
 * (révélée en silence). Le serveur n'accepte que des ids de joueurs du salon et
 * met un id vide sinon : on teste l'id, jamais le nom (un joueur qui s'appelle
 * « Personne » ou « Aucun » a une vraie carte).
 */
export const isPersonneGuess = (r: RevealResult): boolean => !r.guessedPlayerId;

/**
 * Ce à quoi se compare une carte mal attribuée (similarité, tour de table).
 * Ex. : la carte posée devant Bob a été écrite par Alice ; ce que Bob a vraiment
 * écrit, le pilier l'a posé devant Charlie. On compare donc l'écran de Bob à
 * l'écran de CHARLIE (le « holder »), que la table peut regarder, et pas à une
 * réponse que personne n'a sous les yeux.
 */
export interface SimilarityComparison {
  /** Index (dans results) de la vraie réponse du joueur désigné : la carte à comparer. */
  comparedIndex: number;
  /** Texte de cette carte. */
  comparedAnswer: string;
  /**
   * Joueur devant qui le pilier a posé cette carte : '' si elle n'a été donnée à
   * personne, l'id du pilier s'il se l'est donnée (mode "Devine ma réponse").
   */
  holderId: string;
  /** Nom de ce joueur (sans objet quand holderId est vide). */
  holderName: string;
}

/**
 * Comparaison de la carte `answerIndex` (cf. SimilarityComparison), source unique
 * du serveur (détection, revalidation) et des clients (texte de la popup, téléphone
 * mis en avant) : le téléphone allumé est toujours celui de la réponse comparée.
 * null si la carte n'a pas de joueur désigné ("Personne"), si elle est bien
 * attribuée (pas de comparaison) ou si la vraie réponse du désigné est introuvable.
 */
export const getSimilarityComparison = (
  results: readonly RevealResult[],
  answerIndex: number,
): SimilarityComparison | null => {
  const card = results[answerIndex];
  if (!card || isPersonneGuess(card)) return null;
  const comparedIndex = results.findIndex(r => r.playerId === card.guessedPlayerId);
  if (comparedIndex < 0 || comparedIndex === answerIndex) return null;
  const compared = results[comparedIndex];
  return {
    comparedIndex,
    comparedAnswer: compared.answer,
    holderId: compared.guessedPlayerId,
    holderName: compared.guessedPlayerName,
  };
};

/**
 * Ordre du reveal (indices de `results`) en tour de table : la carte attribuée à
 * chaque joueur, place par place, en partant du voisin de gauche du pilier. Les écrans
 * s'allument donc de voisin en voisin, et le point de départ change à chaque manche.
 * - La carte que le pilier s'est attribuée (mode "Devine ma réponse") ferme le tour.
 * - Un joueur deviné absent des places passe après le tour, avant le pilier.
 * - Les ciblages "Personne" n'y figurent pas : ils sont révélés en silence.
 * - À rang égal, l'ordre des résultats départage.
 * Calculé par le SERVEUR, une fois, à l'entrée du reveal (`Round.revealOrder`) :
 * les clients suivent cet ordre sans le recalculer.
 */
export const buildRevealOrder = (
  results: readonly RevealResult[],
  leaderId: string,
  seatIds: readonly string[],
): number[] => {
  const turn = tableTurnFrom(seatIds, leaderId);
  const rank = (r: RevealResult): number => {
    if (r.guessedPlayerId === leaderId) return Number.POSITIVE_INFINITY;
    const at = turn.indexOf(r.guessedPlayerId);
    return at < 0 ? turn.length : at;
  };
  return results
    .map((r, i) => ({ i, rank: rank(r) }))
    .filter(({ i }) => !isPersonneGuess(results[i]))
    // Deux rangs infinis donnent NaN, falsy : on retombe sur l'index.
    .sort((a, b) => (a.rank - b.rank) || (a.i - b.i))
    .map(({ i }) => i);
};
