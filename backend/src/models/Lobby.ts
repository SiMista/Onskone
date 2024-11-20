import { ILobby } from '../types/ILobby';
import { IPlayer } from '../types/IPlayer';

export class Lobby implements ILobby {
  lobbyCode: string;
  players: IPlayer[];
  gameStarted: boolean;

  constructor(lobbyCode: string) {
    this.lobbyCode = lobbyCode;
    this.players = [];
    this.gameStarted = false;
  }

  addPlayer(player: IPlayer): void {
    this.players.push(player);
  }

  removePlayer(playerId: string): void {
    this.players = this.players.filter(player => player.id !== playerId);
  }

  startGame(): void {
    this.gameStarted = true;
  }
}