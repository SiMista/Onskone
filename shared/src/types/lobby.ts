import { IPlayer } from './player.js';
import { SelectedDecks } from './decks.js';

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
}