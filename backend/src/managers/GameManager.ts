import { Game } from "../models/Game";
import { ILobby } from "../types/ILobby";

export class GameManager {
    private games: Map<string, Game>;

    constructor() {
        this.games = new Map();
    }

    // Create a game with the host player and other players, from LobbyManager
    createGame(lobby: ILobby) : void {
        const game = new Game(lobby.lobbyCode, lobby.hostPlayer); 
        lobby.players.forEach(player => game.addPlayer(player));
        this.games.set(lobby.lobbyCode, game);
        game.startGame();
    }
}