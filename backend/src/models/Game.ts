import { IGame } from '../types/IGame';
import { IPlayer } from '../types/IPlayer';
import { IRound } from '../types/IRound';

export class Game implements IGame {
  lobbyCode: string;
  hostPlayer: IPlayer;
  players: IPlayer[];
  currentRound: IRound | null;
  status: 'waiting' | 'inProgress' | 'finished';

  constructor(lobbyCode: string, hostPlayer: IPlayer) {
    this.lobbyCode = lobbyCode;
    this.hostPlayer = hostPlayer;
    this.players = [hostPlayer];
    this.currentRound = null;
    this.status = 'waiting';
  }

  addPlayer(player: IPlayer): void {
    this.players.push(player);
  }

  startGame(): void {
    this.status = 'inProgress';
  }

  endGame(): void {
    this.status = 'finished';
  }
}