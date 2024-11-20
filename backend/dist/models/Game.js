"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Game = void 0;
const Round_1 = require("./Round");
class Game {
    constructor(lobbyCode, players, questionsPool) {
        this.lobbyCode = lobbyCode;
        this.players = [];
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
            console.log("The game hasn't started or is already finished.");
            return;
        }
        const roundNumber = this.currentRound ? this.currentRound.roundNumber + 1 : 1;
        const leaderIndex = roundNumber % this.players.length;
        const leader = this.players[leaderIndex];
        const questions = this.questionsPool[Math.floor(Math.random() * this.questionsPool.length)];
        this.currentRound = new Round_1.Round(roundNumber, leader, questions);
        console.log(`Round ${roundNumber} started with leader: ${leader.name}`);
    }
    endGame() {
        this.status = 'finished';
    }
}
exports.Game = Game;
