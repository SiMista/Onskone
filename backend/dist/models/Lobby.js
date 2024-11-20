"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Lobby = void 0;
class Lobby {
    constructor(lobbyCode) {
        this.lobbyCode = lobbyCode;
        this.players = [];
        this.gameStarted = false;
    }
    addPlayer(player) {
        this.players.push(player);
    }
    removePlayer(playerId) {
        this.players = this.players.filter(player => player.id !== playerId);
    }
    startGame() {
        this.gameStarted = true;
    }
}
exports.Lobby = Lobby;
