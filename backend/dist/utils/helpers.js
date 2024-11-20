"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateLobbyCode = generateLobbyCode;
// Generate a lobby code. 6 characters long, uppercase, alphanumeric.
function generateLobbyCode() {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
}
