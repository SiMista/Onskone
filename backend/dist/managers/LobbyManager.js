"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobbyManager = void 0;
const Lobby_1 = require("../models/Lobby");
const helpers_1 = require("../utils/helpers");
class LobbyManager {
    constructor(gameManager) {
        this.lobbies = new Map();
        this.gameManager = gameManager;
    }
    createLobby() {
        const lobbyCode = (0, helpers_1.generateLobbyCode)();
        this.lobbies.set(lobbyCode, new Lobby_1.Lobby(lobbyCode));
    }
    addPlayerToLobby(lobbyCode, player) {
        const lobby = this.lobbies.get(lobbyCode);
        if (lobby) {
            lobby.addPlayer(player);
        }
        else {
            console.log('Lobby does not exist');
        }
    }
    removePlayerFromLobby(lobbyCode, playerId) {
        const lobby = this.lobbies.get(lobbyCode);
        if (lobby) {
            lobby.removePlayer(playerId);
        }
        else {
            console.log('Lobby does not exist');
        }
    }
    startGame(lobbyCode) {
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
        }
        catch (error) {
            console.error('Error starting game:', error);
            return false;
        }
    }
}
exports.LobbyManager = LobbyManager;
