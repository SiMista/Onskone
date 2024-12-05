"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestHelper = void 0;
const LobbyManager_1 = require("../managers/LobbyManager");
const GameManager_1 = require("../managers/GameManager");
const PlayerManager_1 = require("../managers/PlayerManager");
class TestHelper {
    static createLobbyWithPlayers(playerNames = []) {
        const hostPlayer = PlayerManager_1.PlayerManager.createHostPlayer("Host from TestHelper");
        const lobbyCode = LobbyManager_1.LobbyManager.createLobby(hostPlayer);
        const lobby = LobbyManager_1.LobbyManager.getLobby(lobbyCode);
        if (!lobby) {
            throw new Error(`Lobby with code ${lobbyCode} not found`);
        }
        playerNames.forEach(playerName => {
            const player = PlayerManager_1.PlayerManager.createPlayer(playerName);
            lobby.addPlayer(player);
        });
        return lobby;
    }
    static createPlayers(playerNames) {
        return playerNames.map((name) => PlayerManager_1.PlayerManager.createPlayer(name));
    }
    static startGameWithPlayers(playerNames) {
        const lobby = this.createLobbyWithPlayers(playerNames);
        const game = GameManager_1.GameManager.createGame(lobby);
        return game;
    }
}
exports.TestHelper = TestHelper;
