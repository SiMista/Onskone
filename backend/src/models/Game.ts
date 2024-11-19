import { IGame } from '../types/IGame';
import { IPlayer } from '../types/IPlayer';
import { IRound } from '../types/IRound';

export class Game implements IGame {
  gameCode: string;
  hostPlayer: IPlayer;
  players: IPlayer[];
  currentRound: IRound | null;
  status: 'waiting' | 'inProgress' | 'finished';

  constructor(gameCode: string, hostPlayer: IPlayer) {
    this.gameCode = gameCode;
    this.hostPlayer = hostPlayer;
    this.players = [hostPlayer];
    this.currentRound = null;
    this.status = 'waiting';
  }

  startGame(): void {
    this.status = 'inProgress';
  }

  endGame(): void {
    this.status = 'finished';
  }
}