import { IGame } from '../types/IGame';
import { IPlayer } from '../types/IPlayer';
import { IRound } from '../types/IRound';
import { Round } from './Round';

export class Game implements IGame {
  lobbyCode: string;
  players: IPlayer[];
  currentRound: IRound | null;
  status: 'waiting' | 'inProgress' | 'finished';
  private questionsPool: string[][]; // 3 questions per round

  constructor(lobbyCode: string, players: IPlayer[], questionsPool: string[][]) {
    this.lobbyCode = lobbyCode;
    this.players = [];
    this.currentRound = null;
    this.status = 'waiting';
    this.questionsPool = questionsPool;
  }

  addPlayer(player: IPlayer): void {
    this.players.push(player);
  }

  startGame(): void {
    this.status = 'inProgress';
  }

  nextRound(): void {
    if (this.status !== 'inProgress') {
        console.log("The game hasn't started or is already finished.");
        return;
    }
    const roundNumber = this.currentRound ? this.currentRound.roundNumber + 1 : 1;
    const leaderIndex = roundNumber % this.players.length;
    const leader = this.players[leaderIndex];
    const questions = this.questionsPool[Math.floor(Math.random() * this.questionsPool.length)];

    this.currentRound = new Round(roundNumber, leader, questions);
    console.log(`Round ${roundNumber} started with leader: ${leader.name}`);
  }

  endGame(): void {
    this.status = 'finished';
  }
}