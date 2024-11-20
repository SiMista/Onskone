import { Game } from "../models/Game";
import { ILobby } from "../types/ILobby";

export class GameManager {
    private games: Map<string, Game>;
    private questionsPool: string[][];

    constructor(questionsFilePath: string = '../data/questions.json') {
        this.games = new Map();
        this.questionsPool = this.loadQuestions(questionsFilePath);
    }

    // Load questions from JSON file
    loadQuestions(questionsFilePath: string) : string[][] {
        return [];
    }

    // Create a game with the host player and other players, from LobbyManager
    createGame(lobby: ILobby) : void {
        const game = new Game(lobby.lobbyCode ,lobby.players, []); 
        lobby.players.forEach(player => game.addPlayer(player));
        this.games.set(lobby.lobbyCode, game);
        game.startGame();
    }
}