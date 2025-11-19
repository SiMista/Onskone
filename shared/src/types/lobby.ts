import { IPlayer } from './player.js';

/**
 * Lobby (salle d'attente avant le jeu)
 */
export interface ILobby {
  /** Code unique du lobby (6 caractères alphanumériques) */
  code: string;

  /** Liste des joueurs dans le lobby */
  players: IPlayer[];
}