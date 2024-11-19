import { Lobby } from "../models/Lobby";
import { IPlayer } from "../types/IPlayer";
import { generateLobbyCode } from '../utils/helpers'; 
import { GameManager } from './GameManager';

export class LobbyManager {
    private lobbies: Map<string, Lobby>;
    private gameManager: GameManager;

    constructor(gameManager: GameManager) {
        this.lobbies = new Map();
        this.gameManager = gameManager;
    }

    createLobby(hostPlayer: IPlayer) : void {
        const lobbyCode = generateLobbyCode();
        this.lobbies.set(lobbyCode, new Lobby(lobbyCode, hostPlayer));
    }

    addPlayerToLobby(lobbyCode: string, player: IPlayer) : void {
        const lobby = this.lobbies.get(lobbyCode);
        if (lobby) {
            lobby.addPlayer(player);
        }
        else {
            console.log('Lobby does not exist');
        }
    }

    removePlayerFromLobby(lobbyCode: string, playerId: string) : void {
        const lobby = this.lobbies.get(lobbyCode);
        if (lobby) {
            lobby.removePlayer(playerId);
        }
        else {
            console.log('Lobby does not exist');
        }
    }

    startGame(lobbyCode: string) : void {
        const lobby = this.lobbies.get(lobbyCode);
        if (lobby) {
            lobby.startGame();
            this.gameManager.createGame(lobbyCode, lobby.hostPlayer, lobby.players); // Create a new game with the host player
            console.log(`Game started with code: ${lobbyCode}`);
        }
        else {
            console.log('Lobby does not exist');
        }
    }
}