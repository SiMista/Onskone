import { IPlayer } from './player.js';
import { SelectedDecks } from './decks.js';
import { Locale } from './locale.js';

/** Mode de jeu : en présentiel (locale) ou à distance (remote) */
export type GameMode = 'local' | 'remote';

/**
 * Lobby (salle d'attente avant le jeu)
 */
export interface ILobby {
  /** Code unique du lobby (6 caractères alphanumériques) */
  code: string;

  /** Liste des joueurs dans le lobby */
  players: IPlayer[];

  /** Decks (catégories/thèmes) sélectionnés par l'hôte pour la partie */
  selectedDecks: SelectedDecks;

  /** Mode de jeu : 'local' (même pièce) ou 'remote' (à distance) */
  gameMode: GameMode;

  /** Mode "Devine ma réponse" : le pilier ne répond pas, un substitut écrit pour lui */
  guessMyAnswerMode: boolean;

  /** Multiplicateur de durée des phases (0.7 → 1.5, défaut 1) - réglé par l'hôte */
  timeMultiplier: number;

  /** Langue du contenu (questions, thèmes) - choisie par l'hôte à la création */
  locale: Locale;
}