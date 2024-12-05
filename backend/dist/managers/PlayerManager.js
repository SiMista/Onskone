"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerManager = void 0;
const Player_1 = require("../models/Player");
var PlayerManager;
(function (PlayerManager) {
    const players = new Map();
    PlayerManager.getPlayers = () => {
        return Array.from(players.values());
    };
    PlayerManager.getPlayer = (id) => {
        return players.get(id);
    };
    PlayerManager.deletePlayer = (id) => {
        players.delete(id);
    };
    PlayerManager.createPlayer = (name) => {
        const player = new Player_1.Player(name);
        players.set(player.id, player);
        return player;
    };
    PlayerManager.createHostPlayer = (name) => {
        const player = new Player_1.Player(name, true); // isHost = true
        players.set(player.id, player);
        return player;
    };
})(PlayerManager || (exports.PlayerManager = PlayerManager = {}));
