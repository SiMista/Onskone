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

  /**
   * Nombre de manches prévues (piliers possibles au démarrage). Optionnel : absent
   * des serveurs d'avant l'exclusion de piliers.
   */
  totalRounds?: number;

  /**
   * Graine de la partie (entier 32 bits, tiré par le serveur à la création) : ordre des
   * idées de dessin du tableau blanc et des joueurs qu'elles mettent en scène. La même
   * pour tout le salon, nouvelle à chaque partie (sinon une revanche redonnait les mêmes
   * idées). Optionnel : absent des serveurs d'avant.
   */
  drawingSeed?: number;
}