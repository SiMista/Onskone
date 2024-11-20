import { IPlayer } from './IPlayer';
import { IRound } from './IRound';

export interface IGame {
  lobbyCode: string;                
  players: IPlayer[];               
  currentRound: IRound | null;      
  status: 'waiting' | 'inProgress' | 'finished'; 
  startGame(): void;             
  endGame(): void;              
}
