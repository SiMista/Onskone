import { Lobby } from "../models/Lobby";
import { IPlayer } from "../types/IPlayer";
import { GameManager } from './GameManager';
import { generateLobbyCode } from '../utils/helpers'; 

export class LobbyManager {
    private lobbies: Map<string, Lobby>;
    private gameManager: GameManager;

    constructor(gameManager: GameManager) {
        this.lobbies = new Map();
        this.gameManager = gameManager;
    }

    createLobby() : void {
        const lobbyCode = generateLobbyCode();
        this.lobbies.set(lobbyCode, new Lobby(lobbyCode));
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

    startGame(lobbyCode: string) : boolean {
        const lobby = this.lobbies.get(lobbyCode);
        if (!lobby) {
            console.log('Lobby does not exist');
            return false;
        }
        if (lobby.gameStarted) {
            console.log('Game already started for this lobby.');
            return false;
        }
        try {
            lobby.startGame();
            this.gameManager.createGame(lobby); // Create a game with the Game Manager
            console.log(`Game started with code: ${lobbyCode}`);
            return true;
        } catch (error) {
            console.error('Error starting game:', error);
            return false;
        }
    }
}