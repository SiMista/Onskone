import { IPlayer } from '../types/IPlayer';

export class Player implements IPlayer {
  id: string;
  name: string;
  isHost: boolean;
  score: number;

  constructor(id: string, name: string, isHost: boolean = false) {
    this.id = id;
    this.name = name;
    this.isHost = isHost;
    this.score = 0;
  }
}
