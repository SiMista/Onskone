/**
 * Textes des idées de dessin du tableau blanc (attente du choix de question), FR et EN
 * côte à côte. C'est le SERVEUR qui tire l'idée de la manche (`IRound.drawingIdea`) parmi
 * les ids de `@onskone/shared` (DRAWING_IDEA_IDS) : ce fichier ne fait que les traduire.
 * Typé sur ces ids : un id sans texte ici ne compile pas.
 *
 * Idées volontairement simples (dessinables en 15 s par n'importe qui) + le portrait d'un
 * joueur de la partie. Contrainte vérifiée en test (utils/whiteboard.test.ts) : une ligne
 * en haut du tableau, « Idée de dessin : » + l'idée ≤ 40 caractères (pseudo de 8 lettres).
 */
import type { DrawingIdeaId } from '@onskone/shared';

/** Une idée : un texte, ou (portrait) une fonction du pseudo du joueur à dessiner. */
export type DrawingIdeaText = string | ((name: string) => string);

/** « de Bob » / « d'Alice » : élision devant une voyelle. */
const de = (name: string): string => (/^[aeiouyàâäéèêëîïôöùûüœ]/i.test(name) ? `d'${name}` : `de ${name}`);

export const DRAWING_IDEAS: Readonly<Record<DrawingIdeaId, { fr: DrawingIdeaText; en: DrawingIdeaText }>> = {
  // ----- Animaux -----
  cat: { fr: 'Un chat', en: 'A cat' },
  dog: { fr: 'Un chien', en: 'A dog' },
  fish: { fr: 'Un poisson', en: 'A fish' },
  bird: { fr: 'Un oiseau', en: 'A bird' },
  elephant: { fr: 'Un éléphant', en: 'An elephant' },
  giraffe: { fr: 'Une girafe', en: 'A giraffe' },
  snail: { fr: 'Un escargot', en: 'A snail' },
  turtle: { fr: 'Une tortue', en: 'A turtle' },
  pig: { fr: 'Un cochon', en: 'A pig' },
  rabbit: { fr: 'Un lapin', en: 'A rabbit' },
  snake: { fr: 'Un serpent', en: 'A snake' },
  octopus: { fr: 'Une pieuvre', en: 'An octopus' },
  butterfly: { fr: 'Un papillon', en: 'A butterfly' },
  lion: { fr: 'Un lion', en: 'A lion' },

  // ----- Objets -----
  house: { fr: 'Une maison', en: 'A house' },
  car: { fr: 'Une voiture', en: 'A car' },
  bike: { fr: 'Un vélo', en: 'A bike' },
  boat: { fr: 'Un bateau', en: 'A boat' },
  plane: { fr: 'Un avion', en: 'A plane' },
  rocket: { fr: 'Une fusée', en: 'A rocket' },
  umbrella: { fr: 'Un parapluie', en: 'An umbrella' },
  glasses: { fr: 'Des lunettes', en: 'Glasses' },
  guitar: { fr: 'Une guitare', en: 'A guitar' },
  robot: { fr: 'Un robot', en: 'A robot' },
  castle: { fr: 'Un château', en: 'A castle' },

  // ----- À manger -----
  cake: { fr: 'Un gâteau', en: 'A cake' },
  iceCream: { fr: 'Une glace', en: 'An ice cream' },
  pizza: { fr: 'Une pizza', en: 'A pizza' },

  // ----- Nature et ciel -----
  tree: { fr: 'Un arbre', en: 'A tree' },
  flower: { fr: 'Une fleur', en: 'A flower' },
  rainbow: { fr: 'Un arc-en-ciel', en: 'A rainbow' },
  cloud: { fr: 'Un nuage', en: 'A cloud' },
  star: { fr: 'Une étoile', en: 'A star' },
  heart: { fr: 'Un cœur', en: 'A heart' },
  snowman: { fr: 'Un bonhomme de neige', en: 'A snowman' },

  // ----- Un joueur de la partie (tiré à tour de rôle par le serveur) -----
  portrait: { fr: (n) => `Le portrait ${de(n)}`, en: (n) => `A portrait of ${n}` },
};

/** Les textes d'une langue, par id (pour le dictionnaire). */
export const drawingIdeasFor = (lang: 'fr' | 'en'): Readonly<Record<DrawingIdeaId, DrawingIdeaText>> =>
  Object.fromEntries(Object.entries(DRAWING_IDEAS).map(([id, t]) => [id, t[lang]])) as Record<DrawingIdeaId, DrawingIdeaText>;
