import { Game } from "../models/Game";
import { IPlayer } from "../types/IPlayer";

export class GameManager {
    private games: Map<string, Game>;

    constructor() {
        this.games = new Map();
    }

    createGame(lobbyCode: string, hostPlayer: IPlayer, players: IPlayer[]) : void {
        const game = new Game(lobbyCode, hostPlayer); 
        players.forEach(player => game.addPlayer(player));
        this.games.set(lobbyCode, game);
    }
}