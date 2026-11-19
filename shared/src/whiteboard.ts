/**
 * Tableau blanc partagé : pendant que le pilier choisit sa question, les autres
 * joueurs dessinent ensemble sur le même tableau. Contrat front ↔ back.
 *
 * - Format FIXE (ASPECT_RATIO) sur tous les écrans : sinon un dessin fait sur un
 *   téléphone en portrait serait coupé sur un écran en paysage.
 * - Points en entiers 0..RESOLUTION sur chaque axe, à plat : [x0, y0, x1, y1, …].
 * - Une couleur par joueur, tirée au hasard par le serveur et gardée toute la partie
 *   (index dans la palette du front, distinct d'un joueur à l'autre). Pas de choix de
 *   couleur ni de taille de stylo : c'est voulu.
 * - Le serveur garde les traits de la manche (un revenant retrouve le dessin) et les
 *   jette en quittant QUESTION_SELECTION : nouvelle manche, tableau vide.
 */
export const WHITEBOARD = {
  RESOLUTION: 1000,
  /** Largeur / hauteur du tableau. */
  ASPECT_RATIO: 3 / 4,
  /**
   * Couleurs de stylo : une distincte par joueur, donc ≥ GAME_CONSTANTS.MAX_PLAYERS. Pas
   * plus : chaque couleur en plus serait un quasi-doublon d'une autre.
   */
  COLOR_COUNT: 15,
  /**
   * Les PRIMARY_COLOR_COUNT premières couleurs de la palette sont les plus franches,
   * nettement distinctes deux à deux : tirées en priorité. Les suivantes (nuances proches
   * d'une franche : turquoise ~ vert, magenta ~ rose…) ne sortent qu'au-delà.
   */
  PRIMARY_COLOR_COUNT: 8,
  // Limites (en points x,y), appliquées par le serveur ; le client les respecte aussi
  // pour ne pas dessiner chez lui ce que personne ne verrait.
  MAX_POINTS_PER_CHUNK: 64,
  /** Découpage invisible d'un long geste (le client enchaîne sur un nouveau trait). */
  MAX_POINTS_PER_STROKE: 600,
  /**
   * Encre d'un joueur pour la manche. LARGE exprès : un point tous les 4/1000 du
   * tableau, soit ~250 points par trait d'un bord à l'autre, donc ~160 traits pleine
   * largeur. On doit pouvoir gribouiller et colorier toute la phase sans tomber à sec.
   */
  MAX_POINTS_PER_PLAYER: 40000,
  /**
   * Garde-fou mémoire du serveur, pas une règle de jeu : l'encre de MAX_PLAYERS joueurs
   * (15 × MAX_POINTS_PER_PLAYER), donc jamais atteint avant l'encre perso de chacun.
   * Pas de limite en nombre de traits : les points la bornent déjà (≥ 1 point par
   * trait), et une limite commune laissait un joueur qui tapote bloquer toute la table.
   */
  MAX_POINTS_TOTAL: 600000,
  /**
   * Traits annulés par un seul `whiteboardUndo`. Un geste plus long (découpé en traits
   * de MAX_POINTS_PER_STROKE) part en plusieurs envois.
   */
  MAX_STROKES_PER_UNDO: 16,
} as const;

/** Id local d'un trait, choisi par le client qui le dessine. */
export const isWhiteboardLocalId = (v: unknown): v is string =>
  typeof v === 'string' && /^[a-z0-9]{1,12}$/i.test(v);

/** Id d'un trait dans la manche : unique car la couleur l'est (une par joueur). */
export const whiteboardStrokeId = (color: number, localId: string): string => `${color}.${localId}`;

export interface WhiteboardStroke {
  /** `whiteboardStrokeId(color, id local)`. */
  id: string;
  /** Couleur du stylo de son auteur (index de palette). */
  color: number;
  /** Points à plat [x0, y0, x1, y1, …], entiers 0..RESOLUTION. */
  points: number[];
}
