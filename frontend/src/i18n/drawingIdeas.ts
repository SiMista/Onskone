/**
 * Idées de dessin du tableau blanc (attente du choix de question), FR et EN côte à côte.
 * Fichier fait pour être lu et édité à la main : une ligne = une idée.
 *
 * - Texte simple : idée classique.
 * - `(n) => …` : idée « à nom », n = le pseudo d'un joueur de la partie.
 * - `(a, b) => …` : duo, a et b = deux joueurs différents.
 * Les joueurs sont tirés à tour de rôle, les mêmes pour tout le salon (resolveDrawingIdea).
 *
 * Contraintes (vérifiées en test, utils/whiteboard.test.ts) :
 * - une ligne en haut du tableau : « Idée de dessin : » + l'idée ≤ 40 caractères
 *   (avec un pseudo de 8 lettres en solo, deux de 3 en duo) ;
 * - même forme dans les deux langues (classique, solo ou duo).
 * Ajouter / retirer une idée : n'importe où dans la liste, l'ordre n'a pas d'importance
 * (elles sont mélangées à chaque partie).
 */
import type { DrawingIdea } from '../utils/whiteboard';

/** « de Bob » / « d'Alice » : élision devant une voyelle. */
const de = (name: string): string => (/^[aeiouyàâäéèêëîïôöùûüœ]/i.test(name) ? `d'${name}` : `de ${name}`);

export const DRAWING_IDEAS: readonly { fr: DrawingIdea; en: DrawingIdea }[] = [
  // ----- Classiques -----
  // Absurdes : un truc banal + un détail qui part en vrille, dessinable en 15 s.
  { fr: 'Un dragon qui pue', en: 'A stinky dragon' },
  { fr: 'Un canard armé', en: 'An armed duck' },
  { fr: 'Un dinosaure en skate', en: 'A skateboarding dinosaur' },
  { fr: 'Une pizza géante', en: 'A giant pizza' },
  { fr: 'Un requin en tutu', en: 'A shark in a tutu' },
  { fr: 'Un pigeon en costard', en: 'A pigeon in a suit' },
  { fr: 'Une mamie en jetpack', en: 'A granny with a jetpack' },
  { fr: 'Un gorille en survêt', en: 'A gorilla in a tracksuit' },
  { fr: 'Un crocodile qui dab', en: 'A dabbing crocodile' },
  { fr: 'Un Minion bourré', en: 'A drunk Minion' },
  { fr: 'Un papy catcheur', en: 'A wrestling grandpa' },
  { fr: 'Un papy en jetski', en: 'A grandpa on a jet ski' },
  { fr: 'Le pire tatouage', en: 'The worst tattoo' },
  { fr: 'Spider-Man en tongs', en: 'Spider-Man in flip-flops' },

  // ----- Un joueur (n = son pseudo) -----
  { fr: (n) => `${n} en vacances`, en: (n) => `${n} on holiday` },
  { fr: (n) => `${n} à 80 ans`, en: (n) => `${n} at 80` },
  { fr: (n) => `${n} version bébé`, en: (n) => `Baby ${n}` },
  { fr: (n) => `${n} au réveil`, en: (n) => `${n} waking up` },
  { fr: (n) => `${n} sur un dragon`, en: (n) => `${n} riding a dragon` },
  { fr: (n) => `${n}, star du rock`, en: (n) => `${n} the rock star` },
  { fr: (n) => `Le chien ${de(n)}`, en: (n) => `${n}'s dog` },
  { fr: (n) => `${n} en sumo`, en: (n) => `${n} doing sumo` },
  { fr: (n) => `Le frigo ${de(n)}`, en: (n) => `${n}'s fridge` },
  { fr: (n) => `${n} en sirène`, en: (n) => `${n} as a mermaid` },
  { fr: (n) => `${n} à la muscu`, en: (n) => `${n} at the gym` },
  { fr: (n) => `La voiture ${de(n)}`, en: (n) => `${n}'s car` },
  { fr: (n) => `Le portrait ${de(n)}`, en: (n) => `${n}'s portrait` },

  // ----- Duos (a et b = deux joueurs différents) -----
  { fr: (a, b) => `La fusion ${de(a)} et ${b}`, en: (a, b) => `The fusion of ${a} & ${b}` },
  { fr: (a, b) => `${a} qui combat ${b}`, en: (a, b) => `${a} fighting ${b}` },
  { fr: (a, b) => `${a} et ${b} en prison`, en: (a, b) => `${a} & ${b} in jail` },
  { fr: (a, b) => `${a} et ${b} à vélo`, en: (a, b) => `${a} & ${b} on a bike` },
  { fr: (a, b) => `${a} qui dessine ${b}`, en: (a, b) => `${a} drawing ${b}` },
  { fr: (a, b) => `${a} qui boxe ${b}`, en: (a, b) => `${a} boxing ${b}` },
  { fr: (a, b) => `${a} et ${b} au resto`, en: (a, b) => `${a} & ${b} at dinner` },
];
