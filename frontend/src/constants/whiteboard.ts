// Tableau blanc partagé (attente du choix de question), cf. shared/src/whiteboard.ts.

// Une couleur de stylo par joueur : le serveur envoie un INDEX (unique dans la partie),
// le front le peint avec cette palette. Hors tokens volontairement, comme CATEGORY_COLORS :
// nuancier narratif peint sur canvas (qui ne lit pas les variables CSS). Des couleurs
// franches et vraiment différentes les unes des autres (pas de variantes foncées d'une
// même teinte), lisibles sur le tableau blanc. Autant que WHITEBOARD.COLOR_COUNT (test).
// ORDRE = priorité : les WHITEBOARD.PRIMARY_COLOR_COUNT premières, très différentes deux à
// deux, sortent d'abord (cf. Game.getWhiteboardColor) ; les nuances voisines après.
export const WHITEBOARD_COLORS: readonly string[] = [
  // Franches
  '#ff2a2a', // rouge
  '#ff7b00', // orange
  '#ffcc00', // jaune
  '#16c24a', // vert
  '#2a5bff', // bleu
  '#8a3ffc', // violet
  '#ff3d8f', // rose
  '#1f1f1f', // noir
  // Nuances (seulement au-delà de 8 joueurs)
  '#00b4f5', // bleu ciel
  '#c06a2b', // caramel
  '#9e9e9e', // gris
  '#00c9a7', // turquoise
  '#9be000', // citron vert
  '#e62ee6', // magenta
  '#ff9fcf', // rose bonbon
];

export const whiteboardColor = (index: number): string =>
  WHITEBOARD_COLORS[((index % WHITEBOARD_COLORS.length) + WHITEBOARD_COLORS.length) % WHITEBOARD_COLORS.length];

/** Épaisseur du stylo, en fraction de la largeur du tableau (fixe : pas de réglage). */
export const WHITEBOARD_LINE_WIDTH = 0.012;
/** Distance minimale (unités du tableau) entre deux points d'un trait : allège l'envoi. */
export const WHITEBOARD_MIN_POINT_DISTANCE = 4;
/** Cadence d'envoi des points pendant qu'on dessine (ms). */
export const WHITEBOARD_FLUSH_MS = 50;
/**
 * Attente max de la réponse à `getWhiteboard` (ms). Pendant l'attente on dessine en local
 * sans rien envoyer ; passé ce délai (serveur muet : rate limit, socket pas encore
 * rattaché), on envoie quand même.
 */
export const WHITEBOARD_BOARD_WAIT_MS = 3000;

/**
 * Cadre du tableau autour de la zone de dessin (px) : bordure noire + montant alu sur
 * les côtés et en haut, rebord à feutres en bas (ta couleur + Annuler). La zone de
 * dessin garde ainsi le format exact WHITEBOARD.ASPECT_RATIO.
 */
export const WHITEBOARD_FRAME = { border: 2.5, rail: 7, tray: 34 } as const;
/** Place prise par le cadre autour de la zone de dessin (px), en largeur et en hauteur. */
export const WHITEBOARD_FRAME_X = 2 * (WHITEBOARD_FRAME.border + WHITEBOARD_FRAME.rail);
export const WHITEBOARD_FRAME_Y = 2 * WHITEBOARD_FRAME.border + WHITEBOARD_FRAME.rail + WHITEBOARD_FRAME.tray;
/**
 * Débord de l'ombre `stack-shadow` du cadre, à droite et en bas (px) : réservé autour du
 * tableau, sinon l'overflow-hidden de l'écran d'attente la coupe.
 */
export const WHITEBOARD_SHADOW = 9;

// Intro de l'écran d'attente : la consigne s'affiche au centre, monte, puis le tableau apparaît.
// Le temps de lire la consigne ET l'idée de dessin.
export const WHITEBOARD_INTRO_READ_MS = 2400;
export const WHITEBOARD_INTRO_MOVE_MS = 500;
