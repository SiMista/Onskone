import { IPlayer } from './IPlayer';
import { IRound } from './IRound';

export interface IGame {
  gameCode: string;                
  hostPlayer: IPlayer;              
  players: IPlayer[];               
  currentRound: IRound | null;      
  status: 'waiting' | 'inProgress' | 'finished'; 
  startGame(): void;             
  endGame(): void;              
}
