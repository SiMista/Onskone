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
            // Event: Create Lobby with player name as host
            socket.on('createLobby', (data) => {
                try {
                    const newPlayer = PlayerManager_1.PlayerManager.createHostPlayer(data.playerName);
                    const lobbyCode = LobbyManager_1.LobbyManager.createLobby(newPlayer);
                    socket.join(lobbyCode);
                    socket.emit('lobbyCreated', { lobbyCode, playerName: data.playerName });
                    socket.emit('joinedLobby', { playerId: newPlayer.id });
                    console.log(`Lobby created: ${lobbyCode}`);
                }
                catch (error) {
                    console.error('Error creating lobby:', error);
                    socket.emit('error', { message: error.message });
                }
            });
            // Event: Join Lobby with player name
            socket.on('joinLobby', (data) => {
                try {
                    const lobby = LobbyManager_1.LobbyManager.getLobby(data.lobbyCode);
                    if (lobby) {
                        const newPlayer = PlayerManager_1.PlayerManager.createPlayer(data.playerName);
                        LobbyManager_1.LobbyManager.addPlayerToLobby(lobby.lobbyCode, newPlayer);
                        socket.join(lobby.lobbyCode); // Ajouter le socket au lobby
                        // Diffuser à tous les joueurs du lobby que quelqu'un vient de rejoindre
                        this.io.to(lobby.lobbyCode).emit('updatePlayersList', { players: lobby.players });
                        socket.emit('joinedLobby', { playerId: newPlayer.id });
                        console.log(`${data.playerName} a rejoint le lobby ${lobby.lobbyCode}`);
                    }
                    else {
                        socket.emit('error', { message: 'Lobby not found' }); // Émettre l'erreur au client
                    }
                }
                catch (error) {
                    console.error('Error joining lobby:', error);
                    socket.emit('error', { message: error.message }); // Émettre l'erreur au client en cas d'exception
                }
            });
            socket.on('leaveLobby', (data) => {
                try {
                    const lobby = LobbyManager_1.LobbyManager.getLobby(data.lobbyCode);
                    if (lobby) {
                        console.log('leaveLobby', data.currentPlayerId, data.lobbyCode);
                        const player = PlayerManager_1.PlayerManager.getPlayer(data.currentPlayerId);
                        if (player) {
                            LobbyManager_1.LobbyManager.removePlayerFromLobby(lobby.lobbyCode, player);
                            socket.leave(lobby.lobbyCode);
                            this.io.to(lobby.lobbyCode).emit('updatePlayersList', { players: lobby.players });
                            console.log(`${player.name} a quitté le lobby ${lobby.lobbyCode}`);
                        }
                        else {
                            socket.emit('error', { message: 'Player not found' });
                        }
                    }
                    else {
                        socket.emit('error', { message: 'Lobby not found' });
                    }
                }
                catch (error) {
                    console.error('Error leaving lobby:', error);
                    socket.emit('error', { message: error.message });
                }
            });
            // Event: Get Lobby Players
            socket.on('getLobbyPlayers', (data) => {
                try {
                    const lobby = LobbyManager_1.LobbyManager.getLobby(data.lobbyCode);
                    console.log('getLobbyPlayers', lobby === null || lobby === void 0 ? void 0 : lobby.players);
                    if (lobby) {
                        this.io.to(lobby.lobbyCode).emit('updatePlayersList', { players: lobby.players });
                    }
                    else {
                        socket.emit('error', { message: 'Lobby not found' });
                    }
                }
                catch (error) {
                    console.error('Error getting lobby players:', error);
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
