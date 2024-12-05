"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Lobby = void 0;
class Lobby {
    constructor(lobbyCode) {
        this.lobbyCode = lobbyCode;
        this.players = [];
        this.gameStarted = false;
        this.game = null;
    }
    addPlayer(player) {
        this.players.push(player);
    }
    removePlayer(player) {
        this.players = this.players.filter(p => p.id !== player.id);
    }
    startGame() {
        this.gameStarted = true;
    }
}
exports.Lobby = Lobby;
