import * as LobbyManager from '../../managers/LobbyManager';
import { createGame } from '../../managers/GameManager.js';
import { sanitizeSelectedDecks } from '../../data/questionsRepository.js';
import { Player } from '../../models/Player';
import { Lobby } from '../../models/Lobby';
import { GAME_CONSTANTS, GameStatus, DEFAULT_LOCALE, isLocale, ERROR_CODES } from '@onskone/shared';
import { validatePlayerName, validateAvatarId, sanitizeInput } from '../../utils/validation.js';
import { rateLimiters } from '../../utils/rateLimiter.js';
import { errMessage } from '../../utils/helpers.js';
import logger from '../../utils/logger.js';
import { serializeGame, serializeRound, serializePlayer, serializePlayers, emitLobbyDecksState } from '../broadcasting.js';
import {
    type HandlerContext,
    type AppSocket,
    withGuards,
} from './context.js';

/**
 * Applique un réglage de lobby réservé à l'hôte (decks, mode, multiplicateur de temps).
 * Centralise le préambule quasi-identique des 3 handlers de réglages :
 * rate-limit lobbySettings + validation code + lobby + host (message personnalisé) +
 * refus si partie en cours, puis exécute `apply(lobby)`.
 */
function applyHostSetting(
    socket: AppSocket,
    data: { lobbyCode: string },
    hostAction: string,
    apply: (lobby: Lobby) => void,
): void {
    withGuards(
        socket,
        data,
        {
            limiter: rateLimiters.lobbySettings,
            requireLobbyCode: true,
            requireLobby: true,
            requireHostAction: hostAction,
            rejectIfInProgress: true,
        },
        ({ lobby }) => {
            // updateActivity() est appelé DANS chaque closure `apply`, sur le chemin de
            // succès uniquement : pas de bump d'activité quand le réglage est rejeté
            // (ex. 0 deck sélectionné).
            apply(lobby);
        },
    );
}

export function registerLobbyHandlers(socket: AppSocket, ctx: HandlerContext): void {
    const { io, registry } = ctx;

    // Event: Create Lobby with player name as host
    // withGuards pour le rate-limit + try/catch interne. La validation de playerName
    // et la création du lobby (pas de lobby préexistant à résoudre) restent dans le
    // corps — aucune garde requireLobby* ne s'applique à un createLobby.
    socket.on('createLobby', (data) => {
        withGuards(socket, data, {
            limiter: rateLimiters.createLobby,
        }, (_resolved, data) => {
            // Sanitize PUIS valider le résultat : un nom vidé/raccourci par la sanitisation
            // ne doit pas passer une validation faite sur l'input brut.
            const sanitizedName = sanitizeInput(data.playerName);
            const nameValidation = validatePlayerName(sanitizedName);
            if (!nameValidation.isValid) {
                socket.emit('error', { message: nameValidation.error || 'Nom invalide', code: ERROR_CODES.INVALID });
                return;
            }

            const avatarId = validateAvatarId(data.avatarId);
            const locale = isLocale(data.locale) ? data.locale : DEFAULT_LOCALE;
            const lobbyCode = LobbyManager.create(locale);
            const lobby = LobbyManager.getLobby(lobbyCode);
            const hostPlayer = new Player(sanitizedName, socket.id, true, avatarId);
            lobby?.addPlayer(hostPlayer);
            if (lobby && (data.gameMode === 'local' || data.gameMode === 'remote')) {
                lobby.gameMode = data.gameMode;
            }
            socket.join(lobbyCode);
            // reconnectToken émis UNIQUEMENT au socket du host (secret de reconnexion).
            socket.emit('lobbyCreated', { lobbyCode, reconnectToken: hostPlayer.reconnectToken });
            emitLobbyDecksState(io, socket, lobby!);
            logger.game.created(lobbyCode, sanitizedName);
        });
    });

    // Event: Join Lobby with player name
    // withGuards : rate-limit + lobbyCode + try/catch interne. La validation de
    // playerName (spécifique) reste dans le corps AVANT le check lobby pour préserver
    // l'ordre des erreurs (nom invalide avant "Salon introuvable"). On ne peut donc
    // pas utiliser requireLobby (qui émettrait avant la validation du nom).
    socket.on('joinLobby', (data) => {
        withGuards(socket, data, {
            limiter: rateLimiters.joinLobby,
            requireLobbyCode: true,
        }, ({ lobby }, data) => {
            // Sanitize PUIS valider le résultat (cf. createLobby).
            const sanitizedName = sanitizeInput(data.playerName);
            const nameValidation = validatePlayerName(sanitizedName);
            if (!nameValidation.isValid) {
                socket.emit('error', { message: nameValidation.error || 'Nom invalide', code: ERROR_CODES.INVALID });
                return;
            }

            if (!lobby) {
                socket.emit('error', { message: 'Salon introuvable', code: ERROR_CODES.NOT_FOUND });
                return;
            }

            // Update lobby activity
            lobby.updateActivity();

            // Nettoyer les joueurs vraiment déconnectés (ceux qui ont quitté l'onglet)
            // IMPORTANT: Exclure le joueur qui se reconnecte pour ne pas le supprimer
            ctx.cleanupDisconnectedPlayers(lobby, sanitizedName);

            // Vérifier si le joueur a été kické récemment
            if (registry.isPlayerKicked(data.lobbyCode, sanitizedName)) {
                socket.emit('error', { message: 'Vous avez été expulsé de ce salon', code: ERROR_CODES.KICKED });
                logger.debug(`Joueur ${sanitizedName} bloqué - a été kické du lobby ${data.lobbyCode}`);
                return;
            }

            // Vérifie si le joueur avec ce socket.id est déjà dans le lobby
            const existingPlayerBySocket = lobby.players.find(p => p.socketId === socket.id);
            if (existingPlayerBySocket) {
                logger.debug(`Player ${existingPlayerBySocket.name} déjà dans le lobby ${lobby.code}`);
                // Annuler les timeouts de déconnexion et d'inactivité s'ils existent
                registry.cancelDisconnectTimeout(lobby.code, existingPlayerBySocket.name);
                registry.cancelInactiveTimeout(lobby.code, existingPlayerBySocket.name);
                existingPlayerBySocket.isActive = true; // Marquer comme actif (rejouer)
                socket.join(lobby.code);
                socket.emit('joinedLobby', { player: serializePlayer(existingPlayerBySocket), reconnectToken: existingPlayerBySocket.reconnectToken });
                emitLobbyDecksState(io, socket, lobby);
                io.to(lobby.code).emit('updatePlayersList', { players: serializePlayers(lobby.players) });

                // Si une partie est en cours, envoyer gameStarted pour rediriger vers la page de jeu
                if (lobby.game && lobby.game.status === 'IN_PROGRESS') {
                    socket.emit('gameStarted', { game: serializeGame(lobby) });
                    logger.info(`Partie en cours détectée, envoi gameStarted à ${existingPlayerBySocket.name}`);
                }
                return;
            }

            // Vérifie si un joueur avec ce nom existe déjà (reconnexion après refresh)
            const existingPlayerByName = lobby.players.find(p => p.name === sanitizedName);
            if (existingPlayerByName) {
                // Chemin sûr : le client présente un reconnectToken qui correspond au
                // secret du joueur cible → reconnexion prouvée, on contourne la garde de
                // liveness (le slot lui appartient légitimement même si l'ancien socket
                // n'est pas encore tombé).
                const tokenMatches = !!data.reconnectToken
                    && data.reconnectToken === existingPlayerByName.reconnectToken;

                if (!tokenMatches) {
                    // Pas de token (ou token erroné) : le joueur cible possède un secret
                    // défini, donc une reconnexion non prouvée n'est jamais autorisée à
                    // reprendre le slot — ni pendant la fenêtre de déconnexion. Les noms
                    // sont publics (getLobbyInfo/updatePlayersList) : sans ce refus, un
                    // attaquant rejoignant sous le nom de l'hôte/pilier récupérerait son
                    // socketId — donc ses privilèges (host/leader takeover).
                    socket.emit('error', { message: 'Reconnexion non autorisée', code: ERROR_CODES.CONFLICT });
                    logger.warn('Prise de contrôle par nom refusée (token de reconnexion absent/invalide)', {
                        lobbyCode: lobby.code,
                        name: sanitizedName,
                        attackerSocketId: socket.id,
                        tokenProvided: !!data.reconnectToken,
                    });
                    return;
                }

                // Défense secondaire (garde de liveness conservée) : même avec un token
                // valide, on ne devrait pas reprendre un slot dont le socket est encore
                // bien vivant — sinon double-onglet du même joueur s'arracherait le socket.
                const existingSocket = io.sockets.sockets.get(existingPlayerByName.socketId);
                if (existingSocket && existingSocket.connected && existingSocket.id !== socket.id) {
                    socket.emit('error', { message: 'Ce nom est déjà utilisé dans ce salon', code: ERROR_CODES.CONFLICT });
                    logger.warn('Reconnexion refusée (joueur encore connecté malgré token valide)', {
                        lobbyCode: lobby.code,
                        name: sanitizedName,
                        attackerSocketId: socket.id,
                    });
                    return;
                }

                // Vérifier si une reconnexion est déjà en cours
                if (registry.hasReconnectionLock(lobby.code, sanitizedName)) {
                    logger.debug(`Reconnexion déjà en cours pour ${sanitizedName}`);
                    socket.emit('error', { message: 'Reconnexion en cours, veuillez patienter.', code: ERROR_CODES.CONFLICT });
                    return;
                }

                // Acquérir le lock
                registry.acquireReconnectionLock(lobby.code, sanitizedName);

                try {
                    // C'est une reconnexion - mettre à jour le socketId
                    logger.info(`Player ${sanitizedName} reconnecte au lobby ${lobby.code}`);
                    // Annuler les timeouts de déconnexion et d'inactivité s'ils existent
                    registry.cancelDisconnectTimeout(lobby.code, sanitizedName);
                    registry.cancelInactiveTimeout(lobby.code, sanitizedName);
                    existingPlayerByName.socketId = socket.id;
                    existingPlayerByName.isActive = true; // Marquer comme actif (rejouer)

                    // Si c'est le pilier du round actuel, annuler le timeout de saut de round
                    if (lobby.game?.currentRound?.leader.id === existingPlayerByName.id) {
                        registry.cancelLeaderDisconnectTimeout(lobby.code);
                        lobby.game.currentRound.leader.socketId = socket.id;
                        logger.info(`Pilier reconnecté via joinLobby, timeout saut annulé`);
                    }

                    socket.join(lobby.code);
                    socket.emit('joinedLobby', { player: serializePlayer(existingPlayerByName), reconnectToken: existingPlayerByName.reconnectToken });
                    emitLobbyDecksState(io, socket, lobby);
                    io.to(lobby.code).emit('updatePlayersList', { players: serializePlayers(lobby.players) });

                    // Si une partie est en cours, envoyer gameStarted pour rediriger vers la page de jeu
                    if (lobby.game && lobby.game.status === 'IN_PROGRESS') {
                        socket.emit('gameStarted', { game: serializeGame(lobby) });
                        logger.info(`Partie en cours détectée, envoi gameStarted à ${existingPlayerByName.name}`);
                    }
                } finally {
                    // Relâcher le lock
                    registry.releaseReconnectionLock(lobby.code, sanitizedName);
                }
                return;
            }

            // Vérifier si une partie est déjà en cours (empêcher les nouveaux joueurs de rejoindre)
            if (lobby.game && lobby.game.status === 'IN_PROGRESS') {
                socket.emit('gameAlreadyStarted', { message: 'La partie a déjà été lancée' });
                logger.info(`Nouveau joueur ${sanitizedName} refusé - partie déjà en cours dans ${lobby.code}`);
                return;
            }

            // Nouveau joueur
            const avatarId = validateAvatarId(data.avatarId);
            const newPlayer = new Player(sanitizedName, socket.id, false, avatarId);
            LobbyManager.addPlayer(lobby, newPlayer);

            socket.join(lobby.code);
            // reconnectToken émis UNIQUEMENT au socket du nouveau joueur (secret de reconnexion).
            socket.emit('joinedLobby', { player: serializePlayer(newPlayer), reconnectToken: newPlayer.reconnectToken });
            emitLobbyDecksState(io, socket, lobby);
            io.to(lobby.code).emit('updatePlayersList', { players: serializePlayers(lobby.players) });
            logger.info(`${sanitizedName} a rejoint le lobby ${lobby.code}`, { playerCount: lobby.players.length });
        });
    });

    // Get lobby info (for invite links)
    socket.on('getLobbyInfo', (data: { lobbyCode: string }) => {
        try {
            // Rate limiting
            if (!rateLimiters.general.isAllowed(socket.id)) {
                socket.emit('lobbyInfo', { exists: false });
                return;
            }

            const lobby = LobbyManager.getLobby(data.lobbyCode);
            if (!lobby) {
                socket.emit('lobbyInfo', { exists: false });
                return;
            }
            const host = lobby.players.find(p => p.isHost);
            socket.emit('lobbyInfo', {
                exists: true,
                hostName: host?.name || null
            });
        } catch (error) {
            logger.error('Error getting lobby info', { error: errMessage(error) });
            socket.emit('lobbyInfo', { exists: false });
        }
    });

    // Update selected decks (host only)
    socket.on('updateSelectedDecks', (data) => {
        try {
            applyHostSetting(socket, data, 'modifier les decks', (lobby) => {
                const sanitized = sanitizeSelectedDecks(data.selected || {}, lobby.locale);
                const totalSelected = Object.values(sanitized).reduce((acc, arr) => acc + arr.length, 0);
                if (totalSelected === 0) {
                    socket.emit('error', { message: 'Au moins un thème doit être sélectionné', code: ERROR_CODES.INVALID });
                    return;
                }

                lobby.selectedDecks = sanitized;
                lobby.updateActivity();

                emitLobbyDecksState(io, null, lobby);
            });
        } catch (error) {
            logger.error('Error updating selected decks', { error: errMessage(error) });
            socket.emit('error', { message: 'Une erreur inattendue est survenue', code: ERROR_CODES.INTERNAL });
        }
    });

    // Update Guess My Answer Mode (host only)
    socket.on('updateGuessMyAnswerMode', (data) => {
        try {
            applyHostSetting(socket, data, 'modifier ce mode', (lobby) => {
                lobby.guessMyAnswerMode = !!data.guessMyAnswerMode;
                lobby.updateActivity();

                emitLobbyDecksState(io, null, lobby);
                io.to(lobby.code).emit('guessMyAnswerModeUpdated', {
                    guessMyAnswerMode: lobby.guessMyAnswerMode,
                });
            });
        } catch (error) {
            logger.error('Error updating guess my answer mode', { error: errMessage(error) });
            socket.emit('error', { message: 'Une erreur inattendue est survenue', code: ERROR_CODES.INTERNAL });
        }
    });

    // Update phase time multiplier (host only)
    socket.on('updateTimeMultiplier', (data) => {
        try {
            applyHostSetting(socket, data, 'modifier ce réglage', (lobby) => {
                // Snap à l'un des 3 niveaux autorisés (le plus proche), fallback DEFAULT si NaN.
                const raw = Number(data.timeMultiplier);
                const levels = GAME_CONSTANTS.TIME_MULTIPLIER_LEVELS;
                lobby.timeMultiplier = Number.isFinite(raw)
                    ? levels.reduce((best, lvl) => (Math.abs(lvl - raw) < Math.abs(best - raw) ? lvl : best), levels[0])
                    : GAME_CONSTANTS.TIME_MULTIPLIER_DEFAULT;
                lobby.updateActivity();

                emitLobbyDecksState(io, null, lobby);
                io.to(lobby.code).emit('timeMultiplierUpdated', {
                    timeMultiplier: lobby.timeMultiplier,
                });
            });
        } catch (error) {
            logger.error('Error updating time multiplier', { error: errMessage(error) });
            socket.emit('error', { message: 'Une erreur inattendue est survenue', code: ERROR_CODES.INTERNAL });
        }
    });

    // Check player name before joining lobby
    // withGuards : rate-limit + lobbyCode + try/catch interne. La validation de
    // playerName (spécifique) reste dans le corps, AVANT le lookup lobby, pour
    // préserver l'ordre des erreurs (nom invalide avant "Salon introuvable").
    socket.on('checkPlayerName', (data) => {
        withGuards(socket, data, {
            limiter: rateLimiters.general,
            requireLobbyCode: true,
        }, ({ lobby }, data) => {
            // Sanitize PUIS valider le résultat (cf. createLobby).
            const sanitizedName = sanitizeInput(data.playerName);
            const nameValidation = validatePlayerName(sanitizedName);
            if (!nameValidation.isValid) {
                socket.emit('error', { message: nameValidation.error || 'Nom invalide', code: ERROR_CODES.INVALID });
                return;
            }

            if (!lobby) {
                socket.emit('error', { message: 'Salon introuvable', code: ERROR_CODES.NOT_FOUND });
                return;
            }
            if (lobby.players.find(p => p.name === sanitizedName)) {
                socket.emit('playerNameExists', { playerName: sanitizedName });
            } else {
                socket.emit('playerNameValid');
            }
        });
    });

    // Leave Lobby
    socket.on('leaveLobby', (data: { lobbyCode: string; currentPlayerId: string; }) => {
        withGuards(socket, data, {
            limiter: rateLimiters.general,
            requireLobbyCode: true,
            requirePlayerId: 'currentPlayerId',
            requireLobby: true,
        }, ({ lobby }, data) => {
            logger.debug('leaveLobby', { playerId: data.currentPlayerId, lobbyCode: data.lobbyCode });
            const player = lobby.getPlayer(data.currentPlayerId);
            if (!player) {
                socket.emit('error', { message: 'Joueur introuvable', code: ERROR_CODES.NOT_FOUND });
                return;
            }

            // Vérifier que le socket correspond au joueur (anti-usurpation)
            if (player.socketId !== socket.id) {
                logger.warn(`Tentative d'usurpation leaveLobby: socket ${socket.id} essaie de quitter pour ${player.name}`);
                socket.emit('error', { message: 'Action non autorisée', code: ERROR_CODES.FORBIDDEN });
                return;
            }

            const lobbyCode = lobby.code;
            const isLobbyRemoved = LobbyManager.removePlayer(lobby, player);
            io.to(lobbyCode).emit('updatePlayersList', { players: serializePlayers(lobby.players) });
            logger.info(`${player.name} a quitté le lobby ${lobbyCode}`);
            if (isLobbyRemoved) {
                registry.cleanupLobbyResources(lobbyCode);
                socket.leave(lobbyCode);
                logger.info(`Lobby ${lobbyCode} supprimé`);
            }
        });
    });

    // Kick Player from Lobby
    // withGuards fournit rate-limit + lobbyCode + playerId + lobby + host (via
    // requireHostAction, `host` récupéré du ResolvedGuards). Le corps garde son
    // PROPRE try/catch : son message INTERNAL est SPÉCIFIQUE ('Erreur lors de
    // l'expulsion du joueur') et doit être préservé — le catch interne générique de
    // withGuards ne se déclenche donc jamais ici (le inner catch absorbe tout).
    socket.on('kickPlayer', (data) => {
        withGuards(socket, data, {
            limiter: rateLimiters.kickPlayer,
            requireLobbyCode: true,
            requirePlayerId: 'playerId',
            requireLobby: true,
            requireHostAction: 'expulser des joueurs',
        }, ({ lobby, host }, { lobbyCode, playerId }) => {
            try {
                const kickedPlayer = lobby.getPlayer(playerId);
                if (!kickedPlayer) {
                    socket.emit('error', { message: 'Joueur introuvable', code: ERROR_CODES.NOT_FOUND });
                    return;
                }

                // L'hôte ne peut pas se kick lui-même
                if (kickedPlayer.isHost) {
                    socket.emit('error', { message: 'Impossible d\'expulser l\'hôte', code: ERROR_CODES.FORBIDDEN });
                    return;
                }

                // Pendant qu'une partie est en cours, on refuse TOUT kick :
                // retirer un joueur de lobby.players lui ferait perdre ses scores au
                // calcul du leaderboard (getLeaderboard itère sur lobby.players), et
                // kicker le pilier gèlerait le round. Le host devra attendre la fin de
                // partie ; un joueur déconnecté reste géré par le mécanisme d'inactivité.
                if (lobby.game?.status === GameStatus.IN_PROGRESS) {
                    socket.emit('error', { message: 'Impossible d\'expulser un joueur pendant une partie. Attends la fin de la partie.', code: ERROR_CODES.GAME_IN_PROGRESS });
                    return;
                }

                // Sauvegarder les infos avant suppression
                const kickedSocketId = kickedPlayer.socketId;
                const kickedPlayerName = kickedPlayer.name;

                // Annuler tous les timeouts associés au joueur
                registry.cancelDisconnectTimeout(lobbyCode, kickedPlayerName);
                registry.cancelInactiveTimeout(lobbyCode, kickedPlayerName);

                // Bloquer le joueur pour empêcher la reconnexion immédiate
                registry.blockKickedPlayer(lobbyCode, kickedPlayerName);

                // Retirer le joueur du lobby
                lobby.removePlayer(kickedPlayer);

                // Notifier le joueur kické AVANT de le retirer de la room
                io.to(kickedSocketId).emit('kickedFromLobby', { hostName: host!.name });

                // Retirer le socket de la room Socket.IO
                const kickedSocket = io.sockets.sockets.get(kickedSocketId);
                if (kickedSocket) {
                    kickedSocket.leave(lobbyCode);
                    logger.debug(`Socket ${kickedSocketId} retiré de la room ${lobbyCode}`);
                }

                // Mettre à jour la liste des joueurs pour les autres
                io.to(lobbyCode).emit('updatePlayersList', { players: serializePlayers(lobby.players) });

                logger.info(`Player ${kickedPlayerName} expulsé du lobby ${lobbyCode}`);
            } catch (error) {
                logger.error('Error kicking player', { error: errMessage(error) });
                socket.emit('error', { message: 'Erreur lors de l\'expulsion du joueur', code: ERROR_CODES.INTERNAL });
            }
        });
    });

    // Promote Player to Host
    socket.on('promotePlayer', (data) => {
        withGuards(socket, data, {
            limiter: rateLimiters.gameAction,
            requireLobbyCode: true,
            requirePlayerId: 'playerId',
            requireLobby: true,
            requireHostAction: 'promouvoir des joueurs',
        }, ({ lobby }, { lobbyCode, playerId }) => {
            const playerToPromote = lobby.getPlayer(playerId);
            if (!playerToPromote) {
                socket.emit('error', { message: 'Joueur introuvable', code: ERROR_CODES.NOT_FOUND });
                return;
            }

            // Ne peut pas se promouvoir soi-même (déjà hôte)
            if (playerToPromote.isHost) {
                socket.emit('error', { message: 'Ce joueur est déjà l\'hôte', code: ERROR_CODES.CONFLICT });
                return;
            }

            // Promote player to host
            lobby.setHost(playerToPromote);
            io.to(lobbyCode).emit('updatePlayersList', { players: serializePlayers(lobby.players) });
            logger.info(`Player ${playerToPromote.name} promu hôte dans ${lobbyCode}`);
        });
    });

    // Start Game
    socket.on('startGame', (data) => {
        withGuards(socket, data, {
            limiter: rateLimiters.gameAction,
            requireLobbyCode: true,
            requireLobby: true,
            requireHostAction: 'lancer la partie',
        }, ({ lobby }, data) => {
            // Vérifier qu'il y a assez de joueurs
            const activePlayers = lobby.players.filter(p => p.isActive);
            if (activePlayers.length < 3) {
                socket.emit('error', { message: 'Il faut au moins 3 joueurs pour lancer la partie', code: ERROR_CODES.INVALID });
                return;
            }

            // Update lobby activity
            lobby.updateActivity();

            // Nettoyer les joueurs vraiment déconnectés avant de démarrer
            ctx.cleanupDisconnectedPlayers(lobby);

            // Revérifier le nombre de joueurs après le nettoyage
            const activePlayersAfterCleanup = lobby.players.filter(p => p.isActive);
            if (activePlayersAfterCleanup.length < 3) {
                socket.emit('error', { message: 'Il faut au moins 3 joueurs pour lancer la partie', code: ERROR_CODES.INVALID });
                return;
            }

            const game = createGame(lobby);
            lobby.game = game; // Assigner le jeu au lobby

            // Démarrer le premier round automatiquement
            game.nextRound();

            // Envoyer les événements aux clients
            io.to(data.lobbyCode).emit('gameStarted', { game: serializeGame(lobby) });
            if (game.currentRound) {
                io.to(data.lobbyCode).emit('roundStarted', { round: serializeRound(game.currentRound)! });
            }
            logger.game.started(data.lobbyCode, activePlayers.length);
        });
    });
}
