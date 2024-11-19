import { ILobby } from '../types/ILobby';
import { IPlayer } from '../types/IPlayer';

export class Lobby implements ILobby {
  lobbyCode: string;
  hostPlayer: IPlayer;
  players: IPlayer[];
  gameStarted: boolean;

  constructor(lobbyCode: string, hostPlayer: IPlayer) {
    this.lobbyCode = lobbyCode;
    this.hostPlayer = hostPlayer;
    this.players = [hostPlayer];
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