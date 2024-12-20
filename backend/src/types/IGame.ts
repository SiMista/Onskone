import { IRound } from './IRound';
import {GameStatus} from "../models/Game";
import {ILobby} from "./ILobby";

export interface IGame {
  lobby: ILobby;
  rounds: IRound[];
  currentRound: IRound | null;
  nextRound(): void;
  status: GameStatus;
  start(): void;
  end(): void;
}
