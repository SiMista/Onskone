import { IPlayer } from './player.js';
import { SelectedDecks } from './decks.js';
import { Locale } from './locale.js';

/** Mode de jeu : en présentiel (locale) ou à distance (remote) */
export type GameMode = 'local' | 'remote';

/**
 * Vitesse de jeu réglée par l'hôte : choisit la table de durées des phases
 * (GAME_CONSTANTS.TIMERS). `debug` = DEV uniquement, refusée par le serveur en prod.
 */
export type GameSpeed = 'fast' | 'normal' | 'debug';

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

  /** Vitesse de jeu (durées des phases) - réglée par l'hôte */
  gameSpeed: GameSpeed;

  /**
   * Joueurs que l'hôte a exclus du rôle de pilier : ils jouent normalement mais ne
   * sont jamais tirés comme pilier. Nombre de manches = joueurs actifs non exclus.
   * Optionnel : absent des serveurs d'avant l'exclusion de piliers.
   */
  excludedLeaderIds?: string[];

  /** Langue du contenu (questions, thèmes) - choisie par l'hôte à la création */
  locale: Locale;
}