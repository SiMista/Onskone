import * as LobbyManager from '../../managers/LobbyManager.js';
import { Player } from '../../models/Player.js';
import { validatePlayerName, validateLobbyCode, validatePlayerId, validateAvatarId, sanitizeInput } from '../../utils/validation.js';
import { rateLimiters } from '../../utils/rateLimiter.js';
import logger from '../../utils/logger.js';
import { HandlerContext } from './types.js';

/**
 * Nettoie les joueurs dont le socket est vraiment déconnecté (pas dans le lobby room)
 * et dont la période de grâce a expiré (pas de timeout actif)
 */
export function cleanupDisconnectedPlayers(
    ctx: HandlerContext,
    lobby: ReturnType<typeof LobbyManager.getLobby>,
    excludePlayerName?: string
): void {
    if (!lobby) return;

    const room = ctx.io.sockets.adapter.rooms.get(lobby.code);
    const connectedSocketIds = room ? Array.from(room) : [];

    const playersToRemove = lobby.players.filter(p =>
        !p.isActive &&
        !connectedSocketIds.includes(p.socketId) &&
        p.name !== excludePlayerName &&
        !ctx.timeoutManager.hasDisconnectTimeout(lobby.code, p.name)
    );

    for (const player of playersToRemove) {
        LobbyManager.removePlayer(lobby, player);
        logger.info(`Joueur déconnecté ${player.name} retiré du lobby ${lobby.code} (période de grâce expirée)`);
    }
}

export function handleCreateLobby(ctx: HandlerContext, data: { playerName: string; avatarId?: number }): void {
    try {
        if (!rateLimiters.createLobby.isAllowed(ctx.socket.id)) {
            ctx.socket.emit('error', { message: 'Trop de requêtes. Veuillez patienter.' });
            return;
        }

        const nameValidation = validatePlayerName(data.playerName);
        if (!nameValidation.isValid) {
            ctx.socket.emit('error', { message: nameValidation.error || 'Nom invalide' });
            return;
        }

        const sanitizedName = sanitizeInput(data.playerName);
        const avatarId = validateAvatarId(data.avatarId);
        const lobbyCode = LobbyManager.create();
        const lobby = LobbyManager.getLobby(lobbyCode);
        const hostPlayer = new Player(sanitizedName, ctx.socket.id, true, avatarId);
        lobby?.addPlayer(hostPlayer);
        ctx.socket.join(lobbyCode);
        ctx.socket.emit('lobbyCreated', { lobbyCode });
        logger.game.created(lobbyCode, sanitizedName);
    } catch (error) {
        logger.error('Error creating lobby', { error: (error as Error).message });
        ctx.socket.emit('error', { message: (error as Error).message });
    }
}

export function handleJoinLobby(ctx: HandlerContext, data: { lobbyCode: string; playerName: string; avatarId?: number }): void {
    try {
        if (!rateLimiters.joinLobby.isAllowed(ctx.socket.id)) {
            ctx.socket.emit('error', { message: 'Trop de requêtes. Veuillez patienter.' });
            return;
        }

        const codeValidation = validateLobbyCode(data.lobbyCode);
        if (!codeValidation.isValid) {
            ctx.socket.emit('error', { message: codeValidation.error || 'Code invalide' });
            return;
        }

        const nameValidation = validatePlayerName(data.playerName);
        if (!nameValidation.isValid) {
            ctx.socket.emit('error', { message: nameValidation.error || 'Nom invalide' });
            return;
        }

        const sanitizedName = sanitizeInput(data.playerName);
        const lobby = LobbyManager.getLobby(data.lobbyCode);
        if (!lobby) {
            ctx.socket.emit('error', { message: 'Salon introuvable' });
            return;
        }

        lobby.updateActivity();
        cleanupDisconnectedPlayers(ctx, lobby, sanitizedName);

        if (ctx.timeoutManager.isPlayerKicked(data.lobbyCode, sanitizedName)) {
            ctx.socket.emit('error', { message: 'Vous avez été expulsé de ce salon' });
            logger.debug(`Joueur ${sanitizedName} bloqué - a été kické du lobby ${data.lobbyCode}`);
            return;
        }

        // Check existing player by socket
        const existingPlayerBySocket = lobby.players.find(p => p.socketId === ctx.socket.id);
        if (existingPlayerBySocket) {
            logger.debug(`Player ${existingPlayerBySocket.name} déjà dans le lobby ${lobby.code}`);
            ctx.timeoutManager.cancelDisconnectTimeout(lobby.code, existingPlayerBySocket.name);
            ctx.timeoutManager.cancelInactiveTimeout(lobby.code, existingPlayerBySocket.name);
            existingPlayerBySocket.isActive = true;
            ctx.socket.join(lobby.code);
            ctx.socket.emit('joinedLobby', { player: existingPlayerBySocket });
            ctx.io.to(lobby.code).emit('updatePlayersList', { players: lobby.players });

            if (lobby.game && lobby.game.status === 'IN_PROGRESS') {
                const gameData = {
                    lobby: { code: lobby.code, players: lobby.players },
                    currentRound: lobby.game.currentRound,
                    status: lobby.game.status,
                    rounds: lobby.game.rounds
                };
                ctx.socket.emit('gameStarted', { game: gameData });
                logger.info(`Partie en cours détectée, envoi gameStarted à ${existingPlayerBySocket.name}`);
            }
            return;
        }

        // Check existing player by name (reconnection)
        const existingPlayerByName = lobby.players.find(p => p.name === sanitizedName);
        if (existingPlayerByName) {
            if (!ctx.timeoutManager.acquireReconnectionLock(lobby.code, sanitizedName)) {
                logger.debug(`Reconnexion déjà en cours pour ${sanitizedName}`);
                ctx.socket.emit('error', { message: 'Reconnexion en cours, veuillez patienter.' });
                return;
            }

            try {
                logger.info(`Player ${sanitizedName} reconnecte au lobby ${lobby.code}`);
                ctx.timeoutManager.cancelDisconnectTimeout(lobby.code, sanitizedName);
                ctx.timeoutManager.cancelInactiveTimeout(lobby.code, sanitizedName);
                existingPlayerByName.socketId = ctx.socket.id;
                existingPlayerByName.isActive = true;

                if (lobby.game?.currentRound?.leader.id === existingPlayerByName.id) {
                    ctx.timeoutManager.cancelLeaderDisconnectTimeout(lobby.code);
                    lobby.game.currentRound.leader.socketId = ctx.socket.id;
                    logger.info(`Chef reconnecté via joinLobby, timeout saut annulé`);
                }

                ctx.socket.join(lobby.code);
                ctx.socket.emit('joinedLobby', { player: existingPlayerByName });
                ctx.io.to(lobby.code).emit('updatePlayersList', { players: lobby.players });

                if (lobby.game && lobby.game.status === 'IN_PROGRESS') {
                    const gameData = {
                        lobby: { code: lobby.code, players: lobby.players },
                        currentRound: lobby.game.currentRound,
                        status: lobby.game.status,
                        rounds: lobby.game.rounds
                    };
                    ctx.socket.emit('gameStarted', { game: gameData });
                    logger.info(`Partie en cours détectée, envoi gameStarted à ${existingPlayerByName.name}`);
                }
            } finally {
                ctx.timeoutManager.releaseReconnectionLock(lobby.code, sanitizedName);
            }
            return;
        }

        // New player
        const avatarId = validateAvatarId(data.avatarId);
        const newPlayer = new Player(sanitizedName, ctx.socket.id, false, avatarId);
        LobbyManager.addPlayer(lobby, newPlayer);

        ctx.socket.join(lobby.code);
        ctx.socket.emit('joinedLobby', { player: newPlayer });
        ctx.io.to(lobby.code).emit('updatePlayersList', { players: lobby.players });
        logger.info(`${sanitizedName} a rejoint le lobby ${lobby.code}`, { playerCount: lobby.players.length });
    } catch (error) {
        logger.error('Error joining lobby', { error: (error as Error).message });
        ctx.socket.emit('error', { message: (error as Error).message });
    }
}

export function handleGetLobbyInfo(ctx: HandlerContext, data: { lobbyCode: string }): void {
    try {
        if (!rateLimiters.general.isAllowed(ctx.socket.id)) {
            ctx.socket.emit('lobbyInfo', { exists: false });
            return;
        }

        const lobby = LobbyManager.getLobby(data.lobbyCode);
        if (!lobby) {
            ctx.socket.emit('lobbyInfo', { exists: false });
            return;
        }
        const host = lobby.players.find(p => p.isHost);
        ctx.socket.emit('lobbyInfo', {
            exists: true,
            hostName: host?.name || null
        });
    } catch (error) {
        logger.error('Error getting lobby info', { error: (error as Error).message });
        ctx.socket.emit('lobbyInfo', { exists: false });
    }
}

export function handleCheckPlayerName(ctx: HandlerContext, data: { lobbyCode: string; playerName: string }): void {
    try {
        if (!rateLimiters.general.isAllowed(ctx.socket.id)) {
            ctx.socket.emit('error', { message: 'Trop de requêtes. Veuillez patienter.' });
            return;
        }

        const codeValidation = validateLobbyCode(data.lobbyCode);
        if (!codeValidation.isValid) {
            ctx.socket.emit('error', { message: codeValidation.error || 'Code invalide' });
            return;
        }

        const nameValidation = validatePlayerName(data.playerName);
        if (!nameValidation.isValid) {
            ctx.socket.emit('error', { message: nameValidation.error || 'Nom invalide' });
            return;
        }

        const sanitizedName = sanitizeInput(data.playerName);
        const lobby = LobbyManager.getLobby(data.lobbyCode);
        if (!lobby) {
            ctx.socket.emit('error', { message: 'Salon introuvable' });
            return;
        }
        if (lobby.players.find(p => p.name === sanitizedName)) {
            ctx.socket.emit('playerNameExists', { playerName: sanitizedName });
        } else {
            ctx.socket.emit('playerNameValid');
        }
    } catch (error) {
        logger.error('Error checking player name', { error: (error as Error).message });
        ctx.socket.emit('error', { message: (error as Error).message });
    }
}

export function handleLeaveLobby(ctx: HandlerContext, data: { lobbyCode: string; currentPlayerId: string }): void {
    try {
        if (!rateLimiters.general.isAllowed(ctx.socket.id)) {
            ctx.socket.emit('error', { message: 'Trop de requêtes. Veuillez patienter.' });
            return;
        }

        const playerIdValidation = validatePlayerId(data.currentPlayerId);
        if (!playerIdValidation.isValid) {
            ctx.socket.emit('error', { message: playerIdValidation.error || 'ID joueur invalide' });
            return;
        }

        const lobby = LobbyManager.getLobby(data.lobbyCode);
        if (!lobby) {
            ctx.socket.emit('error', { message: 'Salon introuvable' });
            return;
        }

        logger.debug('leaveLobby', { playerId: data.currentPlayerId, lobbyCode: data.lobbyCode });
        const player = lobby.getPlayer(data.currentPlayerId);
        if (!player) {
            ctx.socket.emit('error', { message: 'Joueur introuvable' });
            return;
        }

        if (player.socketId !== ctx.socket.id) {
            logger.warn(`Tentative d'usurpation leaveLobby: socket ${ctx.socket.id} essaie de quitter pour ${player.name}`);
            ctx.socket.emit('error', { message: 'Action non autorisée' });
            return;
        }

        const lobbyCode = lobby.code;
        const isLobbyRemoved = LobbyManager.removePlayer(lobby, player);
        ctx.io.to(lobbyCode).emit('updatePlayersList', { players: lobby.players });
        logger.info(`${player.name} a quitté le lobby ${lobbyCode}`);
        if (isLobbyRemoved) {
            ctx.timeoutManager.cleanupLobbyResources(lobbyCode);
            ctx.socket.leave(lobbyCode);
            logger.info(`Lobby ${lobbyCode} supprimé`);
        }
    } catch (error) {
        logger.error('Error leaving lobby', { error: (error as Error).message });
        ctx.socket.emit('error', { message: (error as Error).message });
    }
}

export function handleKickPlayer(ctx: HandlerContext, data: { lobbyCode: string; playerId: string }): void {
    try {
        if (!rateLimiters.kickPlayer.isAllowed(ctx.socket.id)) {
            ctx.socket.emit('error', { message: 'Trop de requêtes. Veuillez patienter.' });
            return;
        }

        const codeValidation = validateLobbyCode(data.lobbyCode);
        if (!codeValidation.isValid) {
            ctx.socket.emit('error', { message: codeValidation.error || 'Code invalide' });
            return;
        }

        const playerIdValidation = validatePlayerId(data.playerId);
        if (!playerIdValidation.isValid) {
            ctx.socket.emit('error', { message: playerIdValidation.error || 'ID joueur invalide' });
            return;
        }

        const lobby = LobbyManager.getLobby(data.lobbyCode);
        if (!lobby) {
            ctx.socket.emit('error', { message: 'Salon introuvable' });
            return;
        }

        const host = lobby.players.find(p => p.isHost);
        if (!host || host.socketId !== ctx.socket.id) {
            ctx.socket.emit('error', { message: 'Seul l\'hôte peut expulser des joueurs' });
            return;
        }

        const kickedPlayer = lobby.getPlayer(data.playerId);
        if (!kickedPlayer) {
            ctx.socket.emit('error', { message: 'Joueur introuvable' });
            return;
        }

        if (kickedPlayer.isHost) {
            ctx.socket.emit('error', { message: 'Impossible d\'expulser l\'hôte' });
            return;
        }

        const kickedSocketId = kickedPlayer.socketId;
        const kickedPlayerName = kickedPlayer.name;

        ctx.timeoutManager.cancelDisconnectTimeout(data.lobbyCode, kickedPlayerName);
        ctx.timeoutManager.cancelInactiveTimeout(data.lobbyCode, kickedPlayerName);
        ctx.timeoutManager.blockKickedPlayer(data.lobbyCode, kickedPlayerName);

        lobby.removePlayer(kickedPlayer);

        ctx.io.to(kickedSocketId).emit('kickedFromLobby');

        const kickedSocket = ctx.io.sockets.sockets.get(kickedSocketId);
        if (kickedSocket) {
            kickedSocket.leave(data.lobbyCode);
            logger.debug(`Socket ${kickedSocketId} retiré de la room ${data.lobbyCode}`);
        }

        ctx.io.to(data.lobbyCode).emit('updatePlayersList', { players: lobby.players });
        logger.info(`Player ${kickedPlayerName} expulsé du lobby ${data.lobbyCode}`);
    } catch (error) {
        logger.error('Error kicking player', { error: (error as Error).message });
        ctx.socket.emit('error', { message: 'Erreur lors de l\'expulsion du joueur' });
    }
}

export function handlePromotePlayer(ctx: HandlerContext, data: { lobbyCode: string; playerId: string }): void {
    try {
        if (!rateLimiters.gameAction.isAllowed(ctx.socket.id)) {
            ctx.socket.emit('error', { message: 'Trop de requêtes. Veuillez patienter.' });
            return;
        }

        const codeValidation = validateLobbyCode(data.lobbyCode);
        if (!codeValidation.isValid) {
            ctx.socket.emit('error', { message: codeValidation.error || 'Code invalide' });
            return;
        }

        const playerIdValidation = validatePlayerId(data.playerId);
        if (!playerIdValidation.isValid) {
            ctx.socket.emit('error', { message: playerIdValidation.error || 'ID joueur invalide' });
            return;
        }

        const lobby = LobbyManager.getLobby(data.lobbyCode);
        if (!lobby) {
            ctx.socket.emit('error', { message: 'Salon introuvable' });
            return;
        }

        const currentHost = lobby.players.find(p => p.isHost);
        if (!currentHost || currentHost.socketId !== ctx.socket.id) {
            ctx.socket.emit('error', { message: 'Seul l\'hôte peut promouvoir des joueurs' });
            return;
        }

        const playerToPromote = lobby.getPlayer(data.playerId);
        if (!playerToPromote) {
            ctx.socket.emit('error', { message: 'Joueur introuvable' });
            return;
        }

        if (playerToPromote.isHost) {
            ctx.socket.emit('error', { message: 'Ce joueur est déjà l\'hôte' });
            return;
        }

        lobby.setHost(playerToPromote);
        ctx.io.to(data.lobbyCode).emit('updatePlayersList', { players: lobby.players });
        logger.info(`Player ${playerToPromote.name} promu hôte dans ${data.lobbyCode}`);
    } catch (error) {
        logger.error('Error promoting player', { error: (error as Error).message });
        ctx.socket.emit('error', { message: (error as Error).message });
    }
}
