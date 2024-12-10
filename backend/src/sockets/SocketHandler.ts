import { Server, Socket } from 'socket.io';
import { LobbyManager } from '../managers/LobbyManager';
import { GameManager } from '../managers/GameManager';
import { PlayerManager } from '../managers/PlayerManager';

export class SocketHandler {
    private io: Server;

    constructor(io: Server) {
        this.io = io;
        this.setupSocketEvents();
    }

    private setupSocketEvents(): void {
        this.io.on('connection', (socket: Socket) => {
            console.log(`User connected: ${socket.id}`);

            // Event: Create Lobby with player name as host
            socket.on('createLobby', (data) => {
                try {
                    const newPlayer = PlayerManager.createHostPlayer(data.playerName);
                    const lobbyCode = LobbyManager.createLobby(newPlayer);
                    socket.join(lobbyCode);
                    socket.emit('lobbyCreated', { lobbyCode, playerName: data.playerName });
                    console.log(`Lobby created: ${lobbyCode}`);
                } catch (error) {
                    console.error('Error creating lobby:', error);
                    socket.emit('error', { message: (error as Error).message });
                }
            });

            // Event: Join Lobby with player name
            socket.on('joinLobby', (data) => {
                try {
                    const lobby = LobbyManager.getLobby(data.lobbyCode);
                    if (lobby) {
                        const newPlayer = PlayerManager.createPlayer(data.playerName);
                        LobbyManager.addPlayerToLobby(lobby.lobbyCode, newPlayer);
                        socket.join(lobby.lobbyCode);  // Ajouter le socket au lobby
                        // Diffuser à tous les joueurs du lobby que quelqu'un vient de rejoindre
                        this.io.to(lobby.lobbyCode).emit('playerJoined', { players: lobby.players, playerId: newPlayer.id });
                        socket.emit('joinedLobby', { playerId: newPlayer.id });
                        console.log(`${data.playerName} a rejoint le lobby ${lobby.lobbyCode}`);
                    } else {
                        socket.emit('error', { message: 'Lobby not found' });  // Émettre l'erreur au client
                    }
                } catch (error) {
                    console.error('Error joining lobby:', error);
                    socket.emit('error', { message: (error as Error).message });  // Émettre l'erreur au client en cas d'exception
                }
            });

            socket.on('leaveLobby', (data: { lobbyCode: string; playerId: string; }) => {
                try {
                    const lobby = LobbyManager.getLobby(data.lobbyCode);
                    if (lobby) {
                        const player = PlayerManager.getPlayer(data.playerId);
                        if (player) {
                            LobbyManager.removePlayerFromLobby(lobby.lobbyCode, player);
                            socket.leave(lobby.lobbyCode);
                            this.io.to(lobby.lobbyCode).emit('playerLeft', { players: lobby.players });
                            console.log(`${player.name} a quitté le lobby ${lobby.lobbyCode}`);
                        } else {
                            socket.emit('error', { message: 'Player not found' });
                        }
                    } else {
                        socket.emit('error', { message: 'Lobby not found' });
                    }
                } catch (error) {
                    console.error('Error leaving lobby:', error);
                    socket.emit('error', { message: (error as Error).message });
                }
            });

            // Event: Get Lobby Players
            socket.on('getLobbyPlayers', (data) => {
                try {
                    const lobby = LobbyManager.getLobby(data.lobbyCode);
                    console.log('getLobbyPlayers', lobby?.players);
                    if (lobby) {
                        this.io.to(lobby.lobbyCode).emit('playerJoined', { players: lobby.players });
                    } else {
                        socket.emit('error', { message: 'Lobby not found' });
                    }
                } catch (error) {
                    console.error('Error getting lobby players:', error);
                    socket.emit('error', { message: (error as Error).message });
                }
            });

            // Event: Start Game
            socket.on('startGame', (data) => {
                try {
                    const lobby = LobbyManager.getLobby(data.lobbyCode);
                    if (lobby) {
                        const game = GameManager.createGame(lobby);
                        this.io.to(data.lobbyCode).emit('gameStarted', { game });
                    } else {
                        socket.emit('error', { message: 'Lobby not found' });
                    }
                    console.log(`Game started in lobby ${data.lobbyCode}`);
                } catch (error) {
                    console.error('Error starting game:', error);
                    socket.emit('error', { message: (error as Error).message });
                }
            });

            // Event: Next Round
            socket.on('nextRound', (data) => {
                try {
                    const game = GameManager.getGame(data.lobbyCode);
                    if (game) {
                        game.nextRound();
                        this.io.to(data.lobbyCode).emit('roundStarted', { round: game.currentRound });
                        console.log(`Round ${game.currentRound?.roundNumber} started in lobby ${data.lobbyCode}`);
                    } else {
                        socket.emit('error', { message: 'Game not found' });
                    }
                } catch (error) {
                    console.error('Error starting next round:', error);
                    socket.emit('error', { message: (error as Error).message });
                }
            });

            // Event: Submit Answer
            socket.on('submitAnswer', (data) => {
                try {
                    const game = GameManager.getGame(data.lobbyCode);
                    if (game && game.currentRound) {
                        game.currentRound.addAnswer(data.playerId, data.answer);
                        this.io.to(data.lobbyCode).emit('answerSubmitted', { playerId: data.playerId });
                        console.log(`Answer submitted by player ${data.playerId} in lobby ${data.lobbyCode}`);
                    } else {
                        socket.emit('error', { message: 'Game or round not found' });
                    }
                } catch (error) {
                    console.error('Error submitting answer:', error);
                    socket.emit('error', { message: (error as Error).message });
                }
            });

            // Event: Disconnect
            socket.on('disconnect', () => {
                console.log(`User disconnected: ${socket.id}`);
            });
        });
    }
}
