"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerManager = void 0;
const Player_1 = require("../models/Player");
class PlayerManager {
    constructor() {
        this.players = new Map();
    }
    createPlayer(id, name) {
        const player = new Player_1.Player(id, name);
        this.players.set(id, player);
    }
    createHostPlayer(id, name) {
        const player = new Player_1.Player(id, name, true); // isHost = true
        this.players.set(id, player);
    }
}
exports.PlayerManager = PlayerManager;
