import {Server, Socket} from 'socket.io';
import {LobbyManager} from '../managers/LobbyManager';
import {GameManager} from '../managers/GameManager';
import {Player} from "../models/Player";

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
                    // const hostPlayer = new Player(data.playerName, true);

                    const lobbyCode = LobbyManager.create();
                    socket.join(lobbyCode);
                    socket.emit('lobbyCreated', {lobbyCode});
                    // socket.emit('joinedLobby', {player: hostPlayer});
                    console.log(`Lobby created: ${lobbyCode}`);
                } catch (error) {
                    console.error('Error creating lobby:', error);
                    socket.emit('error', {message: (error as Error).message});
                }
            });

            // Event: Join Lobby with player name
            socket.on('joinLobby', (data) => {
                try {
                    const lobby = LobbyManager.getLobby(data.lobbyCode);

                    if (!lobby) {
                        socket.emit('error', {message: 'Lobby not found'});
                        return;
                    }

                    const newPlayer = new Player(data.playerName);

                    LobbyManager.addPlayer(lobby, newPlayer);
                    // Diffuser à tous les joueurs du lobby que quelqu'un vient de rejoindre
                    socket.join(lobby.code);
                    console.log(`Sending ${lobby.players.map(p => p.id)} to ${socket.id}`);
                    this.io.to(lobby.code).emit('updatePlayersList', {players: lobby.players});
                    socket.emit('joinedLobby', { player: newPlayer });
                    console.log(`${data.playerName} a rejoint le lobby ${lobby.code}`);

                } catch (error) {
                    console.error('Error joining lobby:', error);
                    socket.emit('error', {message: (error as Error).message});
                }
            });

            socket.on('leaveLobby', (data: { lobbyCode: string; currentPlayerId: string; }) => {
                try {
                    const lobby = LobbyManager.getLobby(data.lobbyCode);
                    if (!lobby) {
                        socket.emit('error', {message: 'Lobby not found'});
                        return;
                    }

                    console.log('leaveLobby', data.currentPlayerId, data.lobbyCode);
                    const player = lobby.getPlayer(data.currentPlayerId);

                    if (!player) {
                        socket.emit('error', {message: 'Player not found'});
                        return;
                    }
                    const isLobbyRemoved = LobbyManager.removePlayer(lobby, player);

                    this.io.to(lobby.code).emit('updatePlayersList', {players: lobby.players});
                    console.log(`${player.name} a quitté le lobby ${lobby.code}`);

                    if (isLobbyRemoved) {
                        socket.leave(lobby.code);
                        console.log(`Lobby ${lobby.code} removed`);
                    }

                } catch (error) {
                    console.error('Error leaving lobby:', error);
                    socket.emit('error', {message: (error as Error).message});
                }
            });

            // Event: Get Lobby Players
            socket.on('getLobbyPlayers', (data) => {
                try {
                    const lobby = LobbyManager.getLobby(data.lobbyCode);
                    console.log('getLobbyPlayers', lobby?.players);

                    if (!lobby) {
                        socket.emit('error', {message: 'Lobby not found'});
                        return;
                    }

                    this.io.to(lobby.code).emit('updatePlayersList', {players: lobby.players});

                } catch (error) {
                    console.error('Error getting lobby players:', error);
                    socket.emit('error', {message: (error as Error).message});
                }
            });

            // Event: Start Game
            socket.on('startGame', (data) => {
                try {
                    const lobby = LobbyManager.getLobby(data.lobbyCode);
                    if (!lobby) {
                        socket.emit('error', {message: 'Lobby not found'});
                        return;
                    }

                    const game = GameManager.createGame(lobby);
                    this.io.to(data.lobbyCode).emit('gameStarted', {game});

                    console.log(`Game started in lobby ${data.lobbyCode}`);
                } catch (error) {
                    console.error('Error starting game:', error);
                    socket.emit('error', {message: (error as Error).message});
                }
            });

            // Event: Next Round
            socket.on('nextRound', (data) => {
                try {
                    const lobby = LobbyManager.getLobby(data.lobbyCode);
                    const game = lobby?.game;
                    if (!game) {
                        socket.emit('error', {message: 'Game not found'});
                        return;
                    }

                    game.nextRound();
                    this.io.to(data.lobbyCode).emit('roundStarted', {round: game.currentRound});

                    console.log(`Round ${game.currentRound?.roundNumber} started in lobby ${data.lobbyCode}`);
                } catch (error) {
                    console.error('Error starting next round:', error);
                    socket.emit('error', {message: (error as Error).message});
                }
            });

            // Event: Submit Answer
            socket.on('submitAnswer', (data) => {
                try {
                    const lobby = LobbyManager.getLobby(data.lobbyCode);
                    const game = lobby?.game;
                    if (!game) {
                        socket.emit('error', {message: 'Game not found'});
                        return;
                    }
                    if (!game.currentRound) {
                        socket.emit('error', {message: 'Round not found'});
                        return;
                    }
                    const player = lobby.getPlayer(data.playerId);
                    if (!player) {
                        socket.emit('error', {message: 'Player not found'});
                        return;
                    }
                    game.currentRound.addAnswer(data.playerId, data.answer);
                    this.io.to(data.lobbyCode).emit('answerSubmitted', {playerId: data.playerId});

                    console.log(`Answer submitted by player ${data.playerId} in lobby ${data.lobbyCode}`);
                } catch (error) {
                    console.error('Error submitting answer:', error);
                    socket.emit('error', {message: (error as Error).message});
                }
            });
        });
    }
}
