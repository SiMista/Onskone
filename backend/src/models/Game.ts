import {IGame, LeaderboardEntry} from '../types/IGame';
import {IRound} from '../types/IRound';
import {Round} from './Round';
import { GameCard, ILobby, GameStatus } from '@onskone/shared';

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
        const leaderIndex = (roundNumber - 1) % this.lobby.players.length;
        const leader = this.lobby.players[leaderIndex];
        const gameCard = this.getRandomGameCard();

        this.currentRound = new Round(roundNumber, leader, gameCard);
        this.rounds.push(this.currentRound);
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

    getMaxRounds(): number {
        // Chaque joueur doit passer chef une fois
        return this.lobby.players.length;
    }

    isGameOver(): boolean {
        // La partie est terminée quand on a fait autant de rounds que de joueurs
        return this.rounds.length >= this.getMaxRounds();
    }

    getLeaderboard(): LeaderboardEntry[] {
        // Calculer le score total de chaque joueur à travers tous les rounds
        const playerScores: Record<string, number> = {};

        // Initialiser tous les joueurs avec un score de 0
        for (const player of this.lobby.players) {
            playerScores[player.id] = 0;
        }

        // Additionner les scores de chaque round
        for (const round of this.rounds) {
            for (const [playerId, score] of Object.entries(round.scores)) {
                if (playerScores[playerId] !== undefined) {
                    playerScores[playerId] += score;
                }
            }
        }

        // Créer le leaderboard et trier par score décroissant
        const leaderboard: LeaderboardEntry[] = this.lobby.players.map(player => ({
            player,
            score: playerScores[player.id] || 0
        }));

        return leaderboard.sort((a, b) => b.score - a.score);
    }
}