"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Game = void 0;
const Round_1 = require("./Round");
class Game {
    constructor(lobbyCode, questionsPool) {
        this.lobbyCode = lobbyCode;
        this.players = new Array();
        this.currentRound = null;
        this.status = 'waiting';
        this.questionsPool = questionsPool;
    }
    addPlayer(player) {
        this.players.push(player);
    }
    startGame() {
        this.status = 'inProgress';
    }
    nextRound() {
        if (this.status !== 'inProgress') {
            throw new Error("The game hasn't started or is already finished. Status: " + this.status);
        }
        const roundNumber = this.currentRound ? this.currentRound.roundNumber + 1 : 1;
        const leaderIndex = roundNumber % this.players.length;
        const leader = this.players[leaderIndex];
        const [category, questions] = this.getRandomCategoryAndQuestions();
        this.currentRound = new Round_1.Round(roundNumber, leader, [category, questions]);
        console.log(`Round ${roundNumber} started with leader: ${leader.name}`);
    }
    // Get random category and questions
    getRandomCategoryAndQuestions() {
        const categories = Object.keys(this.questionsPool);
        const randomIndex = Math.floor(Math.random() * categories.length);
        const category = categories[randomIndex];
        console.log(category, this.questionsPool[category]);
        return [category, this.questionsPool[category]];
    }
    getQuestionsPool() {
        return this.questionsPool;
    }
    endGame() {
        this.status = 'finished';
    }
}
exports.Game = Game;
