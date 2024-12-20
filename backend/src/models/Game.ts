import {IGame} from '../types/IGame';
import {IPlayer} from '../types/IPlayer';
import {IRound} from '../types/IRound';
import {Round} from './Round';
import {GameCard} from "../managers/GameManager";
import {Lobby} from "./Lobby";
import {ILobby} from "../types/ILobby";

export enum GameStatus {
    WAITING,
    IN_PROGRESS,
    FINISHED
}

export class Game implements IGame {
    lobby: ILobby;
    rounds: IRound[] = [];
    currentRound: IRound | null;
    status: GameStatus;
    readonly cards: GameCard[];

    constructor(lobby: ILobby, questionsPool: GameCard[]) {
        this.lobby = lobby;
        this.currentRound = null;
        this.status = GameStatus.WAITING;
        this.cards = questionsPool;
    }

    nextRound(): void {
        if (this.status !== GameStatus.IN_PROGRESS) {
            throw new Error("The game hasn't started or is already finished. Status: " + this.status);
        }
        const roundNumber = this.currentRound ? this.currentRound.roundNumber + 1 : 1;
        const leaderIndex = roundNumber % this.lobby.players.length;
        const leader = this.lobby.players[leaderIndex];
        const gameCard = this.getRandomGameCard();

        this.currentRound = new Round(roundNumber, leader, gameCard);
        this.rounds.push(this.currentRound);

        console.log(`Round ${roundNumber} started with leader: ${leader.name}`);
    }

    getRandomGameCard(): GameCard {
        const items = Array.from(this.cards);
        return items[Math.floor(Math.random() * items.length)];
    }

    start(): void {
        this.status = GameStatus.IN_PROGRESS
    }

    end(): void {
        this.status = GameStatus.FINISHED;
    }
}