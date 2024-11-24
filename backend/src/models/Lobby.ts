import { ILobby } from '../types/ILobby';
import { IPlayer } from '../types/IPlayer';
import { IGame } from '../types/IGame';

export class Lobby implements ILobby {
  lobbyCode: string;
  players: IPlayer[];
  gameStarted: boolean;
  game: IGame | null;

  constructor(lobbyCode: string) {
    this.lobbyCode = lobbyCode;
    this.players = [];
    this.gameStarted = false;
    this.game = null;
  }

  addPlayer(player: IPlayer): void {
    this.players.push(player);
  }

  removePlayer(player: IPlayer): void {
    this.players = this.players.filter(p => p.id !== player.id);
  }

  startGame(): void {
    this.gameStarted = true;
  }
}