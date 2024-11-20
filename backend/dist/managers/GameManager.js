"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameManager = void 0;
const Game_1 = require("../models/Game");
class GameManager {
    constructor(questionsFilePath) {
        this.games = new Map();
        this.questionsPool = this.loadQuestions(questionsFilePath);
    }
    // Load questions from JSON file
    loadQuestions(questionsFilePath) {
        return [];
    }
    // Create a game with the host player and other players, from LobbyManager
    createGame(lobby) {
        const game = new Game_1.Game(lobby.lobbyCode, lobby.players, []);
        lobby.players.forEach(player => game.addPlayer(player));
        this.games.set(lobby.lobbyCode, game);
        game.startGame();
    }
}
exports.GameManager = GameManager;
