"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameManager = void 0;
const Game_1 = require("../models/Game");
var GameManager;
(function (GameManager) {
    const games = new Map();
    // Load questions from JSON file
    const loadQuestions = (questionsFilePath) => {
        const fs = require('fs');
        const questions = fs.readFileSync(questionsFilePath);
        return JSON.parse(questions);
    };
    let questionsPool = loadQuestions('./src/data/questions.json'); // Carré vu que c'est syncrhone, S/o Philippe
    // Create a game with players, from lobby
    GameManager.createGame = (lobby) => {
        const game = new Game_1.Game(lobby.lobbyCode, questionsPool);
        lobby.players.forEach(player => game.addPlayer(player));
        games.set(lobby.lobbyCode, game);
        game.startGame();
        return game;
    };
    // Get game by lobby code
    GameManager.getGame = (lobbyCode) => {
        return games.get(lobbyCode);
    };
})(GameManager || (exports.GameManager = GameManager = {}));
