import { Game } from "../models/Game";
import { ILobby } from "../types/ILobby";

export namespace GameManager {
    const games: Map<string, Game> = new Map();

    // Load questions from JSON file
    const loadQuestions = (questionsFilePath: string) : Record<string, string[]> => {
        const fs = require('fs');
        const questions = fs.readFileSync(questionsFilePath);
        return JSON.parse(questions);
    }

    let questionsPool: Record<string, string[]> = loadQuestions('./src/data/questions.json'); // Carré vu que c'est syncrhone, S/o Philippe

    // Create a game with players, from lobby
    export const createGame = (lobby: ILobby) : Game => {
        const game = new Game(lobby.lobbyCode, questionsPool); 
        lobby.players.forEach(player => game.addPlayer(player));
        games.set(lobby.lobbyCode, game);
        game.startGame();
        return game;
    }

    // Get game by lobby code
    export const getGame = (lobbyCode: string) : Game | undefined => {
        return games.get(lobbyCode);
    }
}