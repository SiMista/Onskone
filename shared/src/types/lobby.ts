import { IPlayer } from './player.js';
import { SelectedDecks } from './decks.js';

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
}