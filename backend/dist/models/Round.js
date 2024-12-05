"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Round = void 0;
class Round {
    constructor(roundNumber, leader, [category, questions]) {
        this.roundNumber = roundNumber;
        this.leader = leader;
        this.category = category;
        this.questions = questions;
        this.answers = {};
        this.scores = {};
    }
    addAnswer(playerId, answer) {
        this.answers[playerId] = answer;
    }
    calculateScores() {
        // Logique de calcul des scores
    }
}
exports.Round = Round;
