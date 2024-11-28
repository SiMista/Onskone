import { Server, Socket } from 'socket.io';
import { LobbyManager } from '../managers/LobbyManager';

export class SocketHandler {
    private io : Server;

    constructor(io: Server) {
        this.io = io;

        this.setupSocketEvents(); // Fonction qui gère les événements des sockets
    }

    private setupSocketEvents(): void {
        this.io.on('connection', (socket: Socket) => {
            console.log(`User connected: ${socket.id}`);

            // Event: Create Lobby with player
            socket.on('createLobby', (data) => {
                const lobbyCode = LobbyManager.createLobby(data.player);
                socket.join(lobbyCode);
                this.io.to(lobbyCode).emit('lobbyCreated', { lobbyCode });
                console.log(`Lobby created: ${lobbyCode}`);
            });

            // Event: Join Lobby with player and lobby code
            socket.on('joinLobby', (data) => {
                const lobby = this.lobbyManager.getLobby(data.lobbyCode);
                if (lobby) {
                    const player = this.lobbyManager.addPlayerToLobby(data.lobbyCode, data.player);
                    socket.join(data.lobbyCode);
                    this.io.to(data.lobbyCode).emit('playerJoined', { player, players: lobby.players });
                    console.log(`Player joined lobby ${data.lobbyCode}: ${data.player.name}`);
                } else {
                    socket.emit('error', { message: 'Lobby not found' });
                }
            });

            // Event: Start Game
            socket.on('startGame', (data) => {
                try {
                    this.lobbyManager.startGame(data.lobbyCode);
                    this.io.to(data.lobbyCode).emit('gameStarted');
                    console.log(`Game started in lobby ${data.lobbyCode}`);
                } catch (error) {
                    console.error('Error starting game:', error);
                    socket.emit('error', { message: error.message });
                }
            });

            // Event: Next Round
            socket.on('nextRound', (data) => {
                const game = this.gameManager.getGame(data.lobbyCode);
                if (game) {
                    try {
                        game.nextRound();
                        const currentRound = game.currentRound;
                        this.io.to(data.lobbyCode).emit('roundStarted', currentRound);
                        console.log(`Round ${currentRound?.roundNumber} started in lobby ${data.lobbyCode}`);
                    } catch (error) {
                        console.error('Error starting next round:', error);
                        socket.emit('error', { message: error.message });
                    }
                } else {
                    socket.emit('error', { message: 'Game not found' });
                }
            });

            socket.emit("submitAnswer", { lobbyCode: "ABC", playerId: "123", answer: "My answer" });
            // Event: Submit Answer
            socket.on('submitAnswer', (data) => {
                const game = this.gameManager.getGame(data.lobbyCode);
                
                if (game && game.currentRound) {
                    game.currentRound.addAnswer(data.playerId, data.answer);
                    this.io.to(data.lobbyCode).emit('answerSubmitted', { playerId: data.playerId });
                    console.log(`Answer submitted by player ${data.playerId} in lobby ${data.lobbyCode}`);
                } else {
                    socket.emit('error', { message: 'Game or round not found' });
                }
            });

            // Event: Disconnect
            socket.on('disconnect', () => {
                console.log(`User disconnected: ${socket.id}`);
            });
        });
    }
}