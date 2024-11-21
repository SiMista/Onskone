import { Game } from "../models/Game";
import { ILobby } from "../types/ILobby";

export class GameManager {
    private games: Map<string, Game>;
    private questionsPool: Record<string, string[]>;

    constructor(questionsFilePath: string = '../data/questions.json') {
        this.games = new Map();
        this.questionsPool = this.loadQuestions(questionsFilePath);
    }

    // Load questions from JSON file
    loadQuestions(questionsFilePath: string) : Record<string, string[]> {
        const fs = require('fs');
        const questions = fs.readFileSync(questionsFilePath);
        return JSON.parse(questions);
    }

    // Create a game with players, from lobby
    createGame(lobby: ILobby) : void {
        const game = new Game(lobby.lobbyCode ,lobby.players, this.questionsPool); 
        lobby.players.forEach(player => game.addPlayer(player));
        this.games.set(lobby.lobbyCode, game);
        game.startGame();
    }

    // Get game by lobby code
    getGame(lobbyCode: string) : Game | undefined {
        return this.games.get(lobbyCode);
    }
}