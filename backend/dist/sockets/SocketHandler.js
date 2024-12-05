"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketHandler = void 0;
const LobbyManager_1 = require("../managers/LobbyManager");
const GameManager_1 = require("../managers/GameManager");
const PlayerManager_1 = require("../managers/PlayerManager");
class SocketHandler {
    constructor(io) {
        this.io = io;
        this.setupSocketEvents();
    }
    setupSocketEvents() {
        this.io.on('connection', (socket) => {
            console.log(`User connected: ${socket.id}`);
            // Event: Create Lobby
            socket.on('createLobby', (data) => {
                try {
                    const newPlayer = PlayerManager_1.PlayerManager.createHostPlayer(data.player);
                    const lobbyCode = LobbyManager_1.LobbyManager.createLobby(newPlayer);
                    socket.join(lobbyCode);
                    this.io.to(lobbyCode).emit('lobbyCreated', { lobbyCode });
                    console.log(`Lobby created: ${lobbyCode}`);
                }
                catch (error) {
                    console.error('Error creating lobby:', error);
                    socket.emit('error', { message: error.message });
                }
            });
            // Event: Join Lobby
            socket.on('joinLobby', (data) => {
                try {
                    const lobby = LobbyManager_1.LobbyManager.getLobby(data.lobbyCode);
                    if (lobby) {
                        const player = LobbyManager_1.LobbyManager.addPlayerToLobby(data.lobbyCode, data.player);
                        socket.join(data.lobbyCode);
                        this.io.to(data.lobbyCode).emit('playerJoined', { player, players: lobby.players });
                        console.log(`Player joined lobby ${data.lobbyCode}: ${data.player.name}`);
                    }
                    else {
                        socket.emit('error', { message: 'Lobby not found' });
                    }
                }
                catch (error) {
                    console.error('Error joining lobby:', error);
                    socket.emit('error', { message: error.message });
                }
            });
            // Event: Start Game
            socket.on('startGame', (data) => {
                try {
                    const lobby = LobbyManager_1.LobbyManager.getLobby(data.lobbyCode);
                    if (lobby) {
                        const game = GameManager_1.GameManager.createGame(lobby);
                        this.io.to(data.lobbyCode).emit('gameStarted', { game });
                    }
                    else {
                        socket.emit('error', { message: 'Lobby not found' });
                    }
                    console.log(`Game started in lobby ${data.lobbyCode}`);
                }
                catch (error) {
                    console.error('Error starting game:', error);
                    socket.emit('error', { message: error.message });
                }
            });
            // Event: Next Round
            socket.on('nextRound', (data) => {
                var _a;
                try {
                    const game = GameManager_1.GameManager.getGame(data.lobbyCode);
                    if (game) {
                        game.nextRound();
                        this.io.to(data.lobbyCode).emit('roundStarted', { round: game.currentRound });
                        console.log(`Round ${(_a = game.currentRound) === null || _a === void 0 ? void 0 : _a.roundNumber} started in lobby ${data.lobbyCode}`);
                    }
                    else {
                        socket.emit('error', { message: 'Game not found' });
                    }
                }
                catch (error) {
                    console.error('Error starting next round:', error);
                    socket.emit('error', { message: error.message });
                }
            });
            // Event: Submit Answer
            socket.on('submitAnswer', (data) => {
                try {
                    const game = GameManager_1.GameManager.getGame(data.lobbyCode);
                    if (game && game.currentRound) {
                        game.currentRound.addAnswer(data.playerId, data.answer);
                        this.io.to(data.lobbyCode).emit('answerSubmitted', { playerId: data.playerId });
                        console.log(`Answer submitted by player ${data.playerId} in lobby ${data.lobbyCode}`);
                    }
                    else {
                        socket.emit('error', { message: 'Game or round not found' });
                    }
                }
                catch (error) {
                    console.error('Error submitting answer:', error);
                    socket.emit('error', { message: error.message });
                }
            });
            // Event: Disconnect
            socket.on('disconnect', () => {
                console.log(`User disconnected: ${socket.id}`);
            });
        });
    }
}
exports.SocketHandler = SocketHandler;
