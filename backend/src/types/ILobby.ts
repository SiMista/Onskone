import { IPlayer } from './IPlayer';

export interface ILobby {
  lobbyCode: string;
  players: IPlayer[];
  gameStarted: boolean;
  addPlayer(player: IPlayer): void;
  removePlayer(player: IPlayer): void;
  startGame(): void;
}
