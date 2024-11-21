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
        const game = new Game(lobby.lobbyCode ,lobby.players, []); 
        lobby.players.forEach(player => game.addPlayer(player));
        this.games.set(lobby.lobbyCode, game);
        game.startGame();
    }

    // Get random category and questions
    getRandomCategoryAndQuestions() : [string, string[]] {
        const categories = Object.keys(this.questionsPool);
        const randomIndex = Math.floor(Math.random() * categories.length);
        const category = categories[randomIndex];
        console.log(category, this.questionsPool[category]);
        return [category, this.questionsPool[category]];
    }

    getQuestionsPool() : Record<string, string[]> {
        return this.questionsPool;
    }
}