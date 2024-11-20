"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Round = void 0;
class Round {
    constructor(roundNumber, leader, questions) {
        this.roundNumber = roundNumber;
        this.leader = leader;
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
