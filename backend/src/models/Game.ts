import { IGame } from '../types/IGame';
import { IPlayer } from '../types/IPlayer';
import { IRound } from '../types/IRound';
import { Round } from './Round';

export class Game implements IGame {
  lobbyCode: string;
  players: IPlayer[];
  currentRound: IRound | null;
  status: 'waiting' | 'inProgress' | 'finished';
  private questionsPool: Record<string, string[]>;

  constructor(lobbyCode: string, questionsPool: Record<string, string[]>) {
    this.lobbyCode = lobbyCode;
    this.players = new Array<IPlayer>();
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
      throw new Error("The game hasn't started or is already finished. Status: " + this.status);
    }
    const roundNumber = this.currentRound ? this.currentRound.roundNumber + 1 : 1;
    const leaderIndex = roundNumber % this.players.length;
    const leader = this.players[leaderIndex];
    const [category, questions] = this.getRandomCategoryAndQuestions();

    this.currentRound = new Round(roundNumber, leader, [category, questions]);
    console.log(`Round ${roundNumber} started with leader: ${leader.name}`);
  }

  // Get random category and questions
  getRandomCategoryAndQuestions(): [string, string[]] {
    const categories = Object.keys(this.questionsPool);
    const randomIndex = Math.floor(Math.random() * categories.length);
    const category = categories[randomIndex];
    console.log(category, this.questionsPool[category]);
    return [category, this.questionsPool[category]];
  }

  getQuestionsPool(): Record<string, string[]> {
    return this.questionsPool;
  }

  endGame(): void {
    this.status = 'finished';
  }
}