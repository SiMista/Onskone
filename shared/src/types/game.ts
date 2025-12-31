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
 * Données d'un round pour les résultats finaux
 */
export interface RoundData {
  /** Numéro du round */
  roundNumber: number;

  /** Chef du round */
  leader: { name: string };

  /** Scores des joueurs pour ce round */
  scores: Record<string, number>;
}

/**
 * Statistiques d'un round
 */
export interface RoundStat {
  /** Numéro du round */
  roundNumber: number;

  /** Nom du pilier */
  leader: string;

  /** Score le plus élevé du round */
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