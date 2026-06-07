import { IPlayer } from './player.js';
import { IRound } from './round.js';
import { ILobby } from './lobby.js';

/**
 * Statut du jeu
 */
export enum GameStatus {
  /** En attente du démarrage */
  WAITING = 'WAITING',

  /** Partie en cours */
  IN_PROGRESS = 'IN_PROGRESS',

  /** Partie terminée */
  FINISHED = 'FINISHED'
}

/**
 * Entrée du classement
 */
export interface LeaderboardEntry {
  /** Joueur */
  player: IPlayer;

  /** Score total du joueur */
  score: number;
}

/**
 * Jeu
 */
export interface IGame {
  /** Lobby associé au jeu */
  lobby: ILobby;

  /** Liste de tous les rounds joués */
  rounds: IRound[];

  /** Round actuellement en cours */
  currentRound: IRound | null;

  /** Statut du jeu */
  status: GameStatus;
}