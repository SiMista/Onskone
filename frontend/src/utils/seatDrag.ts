/**
 * Règles du glisser des places autour de la table (SeatCircle). Pures, pour être testées.
 *
 * La table est un CERCLE : la place n°1 (en bas) et la dernière sont voisines, il n'y a pas
 * de bord. Traiter l'ordre comme une liste (retirer + réinsérer) en créait un : glisser
 * vers le voisin d'un côté échangeait deux joueurs, vers celui de l'autre côté faisait
 * tourner toute la table.
 */

/** Seuil d'hésitation : il faut dépasser la frontière entre deux places de 15 % d'une place pour basculer. */
export const SEAT_DRAG_HYSTERESIS = 0.15;

/**
 * Position continue d'un point autour de la table, en places : 0 = place n°1 (en bas),
 * croissante dans le sens horaire à l'écran (sens du jeu), dans [0, n).
 */
export const seatPositionAt = (x: number, y: number, center: number, n: number): number => {
  const deg = (Math.atan2(y - center, x - center) * 180) / Math.PI;
  return ((deg - 90 + 720) % 360) / (360 / n);
};

/**
 * Le joueur en place `from` avance de `steps` places dans le sens du jeu (recule si
 * négatif) ; chaque joueur qu'il croise recule d'une place vers sa place de départ. Les
 * autres ne bougent pas, et l'ordre relatif de tout le monde est conservé, comme
 * quelqu'un qui change de chaise autour d'une vraie table, y compris en passant par la place n°1.
 */
export const moveAround = <T,>(ids: readonly T[], from: number, steps: number): T[] => {
  const n = ids.length;
  const next = [...ids];
  if (n < 2) return next;
  const dir = Math.sign(steps);
  let cur = from;
  for (let k = 0; k < Math.abs(steps); k++) {
    const nb = (cur + dir + n) % n;
    [next[cur], next[nb]] = [next[nb], next[cur]];
    cur = nb;
  }
  return next;
};

/**
 * Pendant un glisser : de combien de places (signé, par le chemin le plus court) le joueur
 * glissé, aujourd'hui en place `current`, doit avancer pour rejoindre `position` (cf.
 * seatPositionAt). 0 tant qu'il n'a pas franchi la frontière avec une autre place de plus
 * que `hysteresis` : pas de va-et-vient quand le doigt hésite pile entre deux places.
 */
export const dragSteps = (current: number, position: number, n: number, hysteresis = SEAT_DRAG_HYSTERESIS): number => {
  if (n < 2) return 0;
  // Écart circulaire, ramené dans [-n/2, n/2).
  const diff = ((((position - current) % n) + n + n / 2) % n) - n / 2;
  if (Math.abs(diff) <= 0.5 + hysteresis) return 0;
  return Math.round(diff);
};
