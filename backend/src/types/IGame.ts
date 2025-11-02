import { IRound } from './IRound';
import {GameStatus} from "../models/Game";
import {ILobby} from "./ILobby";
import {IPlayer} from "./IPlayer";

export interface LeaderboardEntry {
  player: IPlayer;
  score: number;
}

export interface IGame {
  lobby: ILobby;
  rounds: IRound[];
  currentRound: IRound | null;
  nextRound(): void;
  status: GameStatus;
  start(): void;
  end(): void;
  isGameOver(): boolean;
  getLeaderboard(): LeaderboardEntry[];
  getMaxRounds(): number;
}
