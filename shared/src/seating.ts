/**
 * Tour de table : l'ordre des places autour de la table (ids de joueurs, dans le
 * sens du jeu = horaire) pilote UNIQUEMENT l'ordre du reveal, en partant du voisin
 * de gauche du pilier. Il ne décide pas des piliers (tirés au hasard, `Game.nextRound`).
 *
 * Source de l'ordre des places : `lobby.seatOrder`, tenu par le serveur (un arrivant
 * prend la dernière place, un revenant reprend la sienne, un départ referme le trou
 * sans mélanger les autres). Il ne bouge pas pendant une partie : aucun joueur n'est
 * retiré du salon tant qu'elle est en cours.
 */

/**
 * Ordre des places fiable pour les joueurs présents : `seatOrder` sans doublons ni
 * ids partis, puis les joueurs sans place, dans l'ordre du salon. Garde-fou serveur :
 * le tour de table ne peut ni oublier un joueur ni en compter un fantôme.
 */
export const resolveSeatOrder = (
  seatOrder: readonly string[],
  playerIds: readonly string[],
): string[] => {
  const present = new Set(playerIds);
  const seated: string[] = [];
  const seen = new Set<string>();
  for (const id of seatOrder) {
    if (present.has(id) && !seen.has(id)) {
      seen.add(id);
      seated.push(id);
    }
  }
  return [...seated, ...playerIds.filter(id => !seen.has(id))];
};

/**
 * Les places dans l'ordre du tour, en partant du voisin de gauche du pilier (celui
 * qui le suit dans le sens du jeu, horaire) ; le pilier ferme le tour, en dernier.
 * Pilier absent des places : l'ordre des places tel quel.
 */
export const tableTurnFrom = (seatIds: readonly string[], pilierId: string): string[] => {
  const at = seatIds.indexOf(pilierId);
  if (at < 0) return [...seatIds];
  return [...seatIds.slice(at + 1), ...seatIds.slice(0, at + 1)];
};
