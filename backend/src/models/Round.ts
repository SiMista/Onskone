import { IRound } from '../types/IRound';
import { IPlayer } from '../types/IPlayer';

export class Round implements IRound {
    roundNumber: number;
    leader: IPlayer;        // Le joueur qui est le chef
    category: string;       // La catégorie du round
    questions: string[];    // Les 3 questions du round
    answers: Record<string, string>; // Réponses des joueurs (clé = ID du joueur)
    scores: Record<string, number>;  // Scores des joueurs pour ce round

    constructor(roundNumber: number, leader: IPlayer, [category, questions]: [string, string[]]) {
        this.roundNumber = roundNumber;
        this.leader = leader;
        this.category = category;
        this.questions = questions;
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
