"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobbyManager = void 0;
const Lobby_1 = require("../models/Lobby");
const GameManager_1 = require("./GameManager");
const helpers_1 = require("../utils/helpers");
var LobbyManager;
(function (LobbyManager) {
    const lobbies = new Map();
    // Create a lobby using a player and add it to the lobbies map and return lobby code
    LobbyManager.createLobby = (player) => {
        if (!player.isHost) { // Vérifie si le joueur a le statut "host"
            throw new Error("Player is not authorized to create a lobby.");
        }
        const lobbyCode = (0, helpers_1.generateLobbyCode)();
        const lobby = new Lobby_1.Lobby(lobbyCode);
        lobby.addPlayer(player);
        lobbies.set(lobbyCode, lobby);
        return lobbyCode;
    };
    LobbyManager.addPlayerToLobby = (lobbyCode, player) => {
        const lobby = lobbies.get(lobbyCode);
        if (!lobby) {
            throw new Error("Lobby does not exist.");
        }
        lobby.addPlayer(player);
    };
    LobbyManager.removePlayerFromLobby = (lobbyCode, player) => {
        const lobby = lobbies.get(lobbyCode);
        if (lobby) {
            if (lobby.players.length === 1) { // Remove lobby if last player leaves
                lobbies.delete(lobbyCode);
                return;
            }
            if (player.isHost) { // Change host if host leaves
                lobby.removePlayer(player);
                lobby.players[0].isHost = true;
            }
        }
        else {
            console.log('Lobby does not exist');
        }
    };
    LobbyManager.startGame = (lobbyCode) => {
        const lobby = lobbies.get(lobbyCode);
        if (!lobby) {
            console.log('Lobby does not exist');
            return false;
        }
        if (lobby.gameStarted) {
            console.log('Game already started for this lobby.');
            return false;
        }
        if (lobby.players.length <= 2) {
            console.log('Not enough players to start the game.');
            return false;
        }
        try {
            lobby.startGame();
            const game = GameManager_1.GameManager.createGame(lobby);
            lobby.game = game;
            console.log(`Game started with code: ${lobbyCode}`);
            return true;
        }
        catch (error) {
            console.error('Error starting game:', error);
            return false;
        }
    };
    LobbyManager.getLobby = (lobbyCode) => {
        return lobbies.get(lobbyCode);
    };
})(LobbyManager || (exports.LobbyManager = LobbyManager = {}));
