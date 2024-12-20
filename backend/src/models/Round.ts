import {IRound} from '../types/IRound';
import {IPlayer} from '../types/IPlayer';
import {GameCard} from "../managers/GameManager";

export class Round implements IRound {
    roundNumber: number;
    leader: IPlayer;
    gameCard: GameCard;
    answers: Record<string, string>; // Réponses des joueurs (clé = ID du joueur)
    scores: Record<string, number>;  // Pas sûr de mettre un système de score

    constructor(roundNumber: number, leader: IPlayer, gameCard: GameCard) {
        this.roundNumber = roundNumber;
        this.leader = leader;
        this.gameCard = gameCard;
        this.answers = {};
        this.scores = {};
    }

    addAnswer(playerId: string, answer: string): void {
        this.answers[playerId] = answer;
    }

    calculateScores(): void {
        // Logique de calcul des scores
    }
}
