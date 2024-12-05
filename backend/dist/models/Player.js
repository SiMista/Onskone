"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Player = void 0;
const uuid_1 = require("uuid");
class Player {
    constructor(name, isHost = false) {
        this.id = (0, uuid_1.v4)();
        this.name = name;
        this.isHost = isHost;
        this.score = 0;
    }
}
exports.Player = Player;
