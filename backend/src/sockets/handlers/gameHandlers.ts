import * as LobbyManager from '../../managers/LobbyManager.js';
import * as GameManager from '../../managers/GameManager.js';
import { validatePlayerId } from '../../utils/validation.js';
import { rateLimiters } from '../../utils/rateLimiter.js';
import logger from '../../utils/logger.js';
import { HandlerContext } from './types.js';
import { cleanupDisconnectedPlayers } from './lobbyHandlers.js';

export function handleStartGame(ctx: HandlerContext, data: { lobbyCode: string }): void {
    try {
        if (!rateLimiters.gameAction.isAllowed(ctx.socket.id)) {
            ctx.socket.emit('error', { message: 'Trop de requêtes. Veuillez patienter.' });
            return;
        }

        const lobby = LobbyManager.getLobby(data.lobbyCode);
        if (!lobby) {
            ctx.socket.emit('error', { message: 'Salon introuvable' });
            return;
        }

        const host = lobby.players.find(p => p.isHost);
        if (!host || host.socketId !== ctx.socket.id) {
            ctx.socket.emit('error', { message: 'Seul l\'hôte peut lancer la partie' });
            return;
        }

        const activePlayers = lobby.players.filter(p => p.isActive);
        if (activePlayers.length < 3) {
            ctx.socket.emit('error', { message: 'Il faut au moins 3 joueurs pour lancer la partie' });
            return;
        }

        lobby.updateActivity();
        cleanupDisconnectedPlayers(ctx, lobby);

        const activePlayersAfterCleanup = lobby.players.filter(p => p.isActive);
        if (activePlayersAfterCleanup.length < 3) {
            ctx.socket.emit('error', { message: 'Il faut au moins 3 joueurs pour lancer la partie' });
            return;
        }

        const game = GameManager.createGame(lobby);
        lobby.game = game;
        game.nextRound();

        const gameData = {
            lobby: {
                code: lobby.code,
                players: lobby.players
            },
            currentRound: game.currentRound,
            status: game.status,
            rounds: game.rounds
        };

        ctx.io.to(data.lobbyCode).emit('gameStarted', { game: gameData });
        if (game.currentRound) {
            ctx.io.to(data.lobbyCode).emit('roundStarted', { round: game.currentRound });
        }
        logger.game.started(data.lobbyCode, activePlayers.length);
    } catch (error) {
        logger.error('Error starting game', { error: (error as Error).message });
        ctx.socket.emit('error', { message: (error as Error).message });
    }
}

export function handleNextRound(ctx: HandlerContext, data: { lobbyCode: string }): void {
    try {
        if (!rateLimiters.gameAction.isAllowed(ctx.socket.id)) {
            ctx.socket.emit('error', { message: 'Trop de requêtes. Veuillez patienter.' });
            return;
        }

        const lobby = LobbyManager.getLobby(data.lobbyCode);
        const game = lobby?.game;
        if (!game) {
            ctx.socket.emit('error', { message: 'Partie introuvable' });
            return;
        }

        if (game.currentRound && ctx.socket.id !== game.currentRound.leader.socketId) {
            ctx.socket.emit('error', { message: 'Seul le pilier peut passer au round suivant' });
            return;
        }

        if (game.isGameOver()) {
            game.end();

            if (lobby) {
                lobby.players.forEach(p => p.isActive = false);
            }

            ctx.io.to(data.lobbyCode).emit('gameEnded', {
                leaderboard: game.getLeaderboard(),
                rounds: game.rounds
            });
            logger.game.ended(data.lobbyCode);
            return;
        }

        game.nextRound();
        if (game.currentRound) {
            ctx.io.to(data.lobbyCode).emit('roundStarted', { round: game.currentRound });
            logger.game.roundStarted(data.lobbyCode, game.currentRound.roundNumber, game.currentRound.leader.name);
        }
    } catch (error) {
        logger.error('Error starting next round', { error: (error as Error).message });
        ctx.socket.emit('error', { message: (error as Error).message });
    }
}

export function handleGetGameResults(ctx: HandlerContext, data: { lobbyCode: string }): void {
    try {
        if (!rateLimiters.general.isAllowed(ctx.socket.id)) {
            ctx.socket.emit('error', { message: 'Trop de requêtes. Veuillez patienter.' });
            return;
        }

        const lobby = LobbyManager.getLobby(data.lobbyCode);
        const game = lobby?.game;
        if (!game) {
            ctx.socket.emit('error', { message: 'Partie introuvable' });
            return;
        }

        ctx.socket.emit('gameEnded', {
            leaderboard: game.getLeaderboard(),
            rounds: game.rounds
        });
    } catch (error) {
        logger.error('Error getting game results', { error: (error as Error).message });
        ctx.socket.emit('error', { message: (error as Error).message });
    }
}

export function handleGetGameState(ctx: HandlerContext, data: { lobbyCode: string; playerId?: string }): void {
    try {
        if (!rateLimiters.general.isAllowed(ctx.socket.id)) {
            ctx.socket.emit('error', { message: 'Trop de requêtes. Veuillez patienter.' });
            return;
        }

        if (data.playerId) {
            const playerIdValidation = validatePlayerId(data.playerId);
            if (!playerIdValidation.isValid) {
                ctx.socket.emit('error', { message: playerIdValidation.error || 'ID joueur invalide' });
                return;
            }
        }

        const lobby = LobbyManager.getLobby(data.lobbyCode);
        const game = lobby?.game;
        if (!game) {
            ctx.socket.emit('error', { message: 'Partie introuvable' });
            return;
        }

        // Reconnection handling
        if (data.playerId) {
            const player = lobby.players.find(p => p.id === data.playerId);
            if (player) {
                if (ctx.timeoutManager.hasReconnectionLock(lobby.code, player.name)) {
                    logger.debug(`Reconnexion game déjà en cours pour ${player.name}`);
                } else {
                    if (ctx.timeoutManager.acquireReconnectionLock(lobby.code, player.name)) {
                        try {
                            const oldSocketId = player.socketId;
                            player.socketId = ctx.socket.id;
                            player.isActive = true;
                            ctx.socket.join(lobby.code);

                            ctx.timeoutManager.cancelAllPlayerTimeouts(lobby.code, player.name);

                            logger.info(`Player ${player.name} reconnected to game`, {
                                lobbyCode: data.lobbyCode,
                                oldSocketId,
                                newSocketId: ctx.socket.id
                            });

                            if (game.currentRound && game.currentRound.leader.id === data.playerId) {
                                game.currentRound.leader.socketId = ctx.socket.id;
                                ctx.timeoutManager.cancelLeaderDisconnectTimeout(lobby.code);
                                logger.info(`Leader socketId updated for round ${game.currentRound.roundNumber}`);
                            }

                            ctx.io.to(lobby.code).emit('updatePlayersList', { players: lobby.players });
                        } finally {
                            ctx.timeoutManager.releaseReconnectionLock(lobby.code, player.name);
                        }
                    }
                }
            }
        }

        const gameData = {
            lobby: {
                code: lobby.code,
                players: lobby.players
            },
            currentRound: game.currentRound,
            status: game.status,
            rounds: game.rounds
        };

        const reconnectionData: {
            answeredPlayerIds: string[];
            myAnswer?: string;
            currentGuesses?: Record<string, string>;
            relancesUsed?: number;
        } = {
            answeredPlayerIds: game.currentRound ? Object.keys(game.currentRound.answers) : []
        };

        if (data.playerId && game.currentRound?.answers[data.playerId]) {
            reconnectionData.myAnswer = game.currentRound.answers[data.playerId];
        }

        if (game.currentRound?.currentGuesses) {
            reconnectionData.currentGuesses = game.currentRound.currentGuesses;
        }

        if (game.currentRound?.relancesUsed !== undefined) {
            reconnectionData.relancesUsed = game.currentRound.relancesUsed;
        }

        ctx.socket.emit('gameState', {
            game: gameData,
            players: lobby.players,
            leaderboard: game.getLeaderboard(),
            reconnectionData
        });
    } catch (error) {
        logger.error('Error getting game state', { error: (error as Error).message });
        ctx.socket.emit('error', { message: (error as Error).message });
    }
}
