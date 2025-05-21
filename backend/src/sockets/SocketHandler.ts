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
                    const lobbyCode = LobbyManager.create();
                    const lobby = LobbyManager.getLobby(lobbyCode);
                    const hostPlayer = new Player(data.playerName, socket.id, true);
                    lobby?.addPlayer(hostPlayer);
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
                        socket.emit('error', { message: 'Lobby not found' });
                        return;
                    }

                    // Vérifie si le joueur avec ce socket.id est déjà dans le lobby
                    const existingPlayer = lobby.players.find(p => p.socketId === socket.id);
                    if (existingPlayer) {
                        console.log(`Player ${existingPlayer.name} est déjà dans le lobby ${lobby.code} avec le même socket.`);
                        socket.join(lobby.code);
                        socket.emit('joinedLobby', { player: existingPlayer });
                        this.io.to(lobby.code).emit('updatePlayersList', { players: lobby.players });
                        return;
                    }

                    // Vérifie si le nom est déjà utilisé (autre joueur)
                    if (lobby.players.find(p => p.name === data.playerName)) {
                        socket.emit('error', { message: `Le nom "${data.playerName}" est déjà utilisé dans le salon.` });
                        return;
                    }

                    // Nouveau joueur
                    const newPlayer = new Player(data.playerName, socket.id);
                    LobbyManager.addPlayer(lobby, newPlayer);

                    socket.join(lobby.code);
                    socket.emit('joinedLobby', { player: newPlayer });
                    this.io.to(lobby.code).emit('updatePlayersList', { players: lobby.players });
                    console.log(`${data.playerName} a rejoint le lobby ${lobby.code} (${lobby.players.length} joueurs)`);

                } catch (error) {
                    console.error('Error joining lobby:', error);
                    socket.emit('error', { message: (error as Error).message });
                }
            });


            // Check player name before joining lobby
            socket.on('checkPlayerName', (data) => {
                try {
                    const lobby = LobbyManager.getLobby(data.lobbyCode);
                    if (!lobby) {
                        socket.emit('error', {message: 'Lobby not found'});
                        return;
                    }
                    if (lobby.players.find(p => p.name === data.playerName)) {
                        socket.emit('playerNameExists', {playerName: data.playerName});
                    } else {
                        socket.emit('playerNameValid');
                    }
                } catch (error) {
                    console.error('Error checking player name:', error);
                    socket.emit('error', {message: (error as Error).message});
                }
            });

            // Leave Lobby
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

            // Kick Player from Lobby 
            socket.on('kickPlayer', ({ lobbyCode, playerId }) => {
                const lobby = LobbyManager.getLobby(lobbyCode);
                if (!lobby) {
                    socket.emit('error', { message: 'Lobby not found' });
                    return;
                }
                const kickedPlayer = lobby?.getPlayer(playerId);
                if (!kickedPlayer) {
                    socket.emit('error', { message: 'Lobby not found' });
                    return;
                }
                // Remove player from lobby
                lobby.removePlayer(kickedPlayer);
                this.io.to(lobbyCode).emit('updatePlayersList', { players: lobby.players });
                console.log(`Player ${kickedPlayer.name} kicked from lobby ${lobbyCode}`);
                // Notify kicked player
                this.io.to(kickedPlayer.socketId).emit('kickedFromLobby');
            });       
            
            // Promote Player to Host
            socket.on('promotePlayer', ({ lobbyCode, playerId }) => {
                const lobby = LobbyManager.getLobby(lobbyCode);
                if (!lobby) {
                    socket.emit('error', { message: 'Lobby not found' });
                    return;
                }
                const playerToPromote = lobby?.getPlayer(playerId);
                if (!playerToPromote) {
                    socket.emit('error', { message: 'Player not found' });
                    return;
                }
                // Promote player to host
                lobby.setHost(playerToPromote);
                this.io.to(lobbyCode).emit('updatePlayersList', { players: lobby.players });
                console.log(`Player ${playerToPromote.name} promoted to host in lobby ${lobbyCode}`);
            });

            // Start Game
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

            // Next Round
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
