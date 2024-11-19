import { IPlayer } from './IPlayer';

export interface ILobby {
  lobbyCode: string;     
  hostPlayer: IPlayer;     
  players: IPlayer[];              
  gameStarted: boolean;           
  addPlayer(player: IPlayer): void; 
  removePlayer(playerId: string): void; 
  startGame(): void;             
}
