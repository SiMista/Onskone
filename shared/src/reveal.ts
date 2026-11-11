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
