/**
 * Idées de dessin du tableau blanc (attente du choix de question). Le SERVEUR tire l'idée
 * de chaque manche (`IRound.drawingIdea`) : tous les téléphones affichent la même, quelle
 * que soit leur version ou la liste des joueurs qu'ils ont en mémoire. Ici, seulement les
 * identifiants ; les textes FR/EN sont côté front (frontend/src/i18n/drawingIdeas.ts, typé
 * sur cette liste : un id sans texte ne compile pas).
 *
 * Ajouter une idée : son id ici + ses textes côté front. Un vieux client qui reçoit un id
 * qu'il ne connaît pas n'affiche simplement pas de bandeau.
 */
export const DRAWING_IDEA_IDS = [
  // Animaux
  'cat', 'dog', 'fish', 'bird', 'elephant', 'giraffe', 'snail', 'turtle', 'pig', 'rabbit',
  'snake', 'octopus', 'butterfly', 'lion',
  // Objets
  'house', 'car', 'bike', 'boat', 'plane', 'rocket', 'umbrella', 'glasses', 'guitar', 'robot',
  'castle',
  // À manger
  'cake', 'iceCream', 'pizza',
  // Nature et ciel
  'tree', 'flower', 'rainbow', 'cloud', 'star', 'heart', 'snowman',
] as const;

/** Le portrait d'un joueur de la partie (son id voyage dans `DrawingIdeaPick.playerId`). */
export const DRAWING_PORTRAIT_ID = 'portrait';

export type DrawingIdeaId = (typeof DRAWING_IDEA_IDS)[number] | typeof DRAWING_PORTRAIT_ID;

/** Idée tirée pour une manche. `id` reste une string : un serveur plus récent peut en envoyer une inconnue. */
export interface DrawingIdeaPick {
  id: string;
  /** Portrait : le joueur à dessiner. */
  playerId?: string;
}

/** Un portrait de joueur par tranche de `DRAWING_PORTRAIT_EVERY` manches, à une place au hasard dans la tranche. */
export const DRAWING_PORTRAIT_EVERY = 3;
