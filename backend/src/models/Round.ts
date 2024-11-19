import { IRound } from "../types/IRound";

export class Round implements IRound{
    roundNumber: number;
    questions: string[];
    answers: string[];
    scores: Record<string, number>;
    currentQuestionIndex: number;

    constructor(roundNumber: number, questions: string[], answers: string[]){
        this.roundNumber = roundNumber;
        this.questions = questions;
        this.answers = answers;
        this.scores = {};
        this.currentQuestionIndex = 0;
    }

    nextQuestion(): void {
        this.currentQuestionIndex++;
    }

    calculateScores(): void {
        this.scores = {};
        this.answers.forEach((answer, index) => {
            if(answer === this.questions[index]){
                if(this.scores[answer]){
                    this.scores[answer]++;
                } else {
                    this.scores[answer] = 1;
                }
            }
        });
    }
}