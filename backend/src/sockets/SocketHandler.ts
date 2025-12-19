import { randomInt } from 'crypto';
import {Server, Socket} from 'socket.io';
import * as LobbyManager from '../managers/LobbyManager';
import * as GameManager from '../managers/GameManager';
import {Player} from "../models/Player";
import type { ServerToClientEvents, ClientToServerEvents } from '@onskone/shared';
import { GAME_CONSTANTS } from '@onskone/shared';
import { validatePlayerName, validateAnswer, validateLobbyCode, validatePlayerId, sanitizeInput } from '../utils/validation.js';
import { rateLimiters } from '../utils/rateLimiter.js';
import { shuffleArray } from '../utils/helpers.js';
import logger from '../utils/logger.js';

export class SocketHandler {
    private io: Server<ClientToServerEvents, ServerToClientEvents>;
    // Map pour stocker les timeouts de déconnexion (clé: lobbyCode_playerName)
    private disconnectTimeouts: Map<string, NodeJS.Timeout> = new Map();
    // Map pour stocker les timeouts de déconnexion du chef (clé: lobbyCode)
    private leaderDisconnectTimeouts: Map<string, NodeJS.Timeout> = new Map();
    // Set pour empêcher les reconnexions simultanées (clé: lobbyCode_playerName)
    private reconnectionLocks: Set<string> = new Set();
    // Délai de grâce pour la reconnexion (30 secondes)
    private readonly RECONNECT_GRACE_PERIOD = 30000;
    // Délai avant de sauter le round du chef déconnecté (15 secondes - pour le changement d'app mobile)
    private readonly LEADER_DISCONNECT_DELAY = 15000;
    // Délai avant de marquer un joueur comme inactif (5 secondes - pour le changement d'app mobile)
    private readonly INACTIVE_DELAY = 5000;
    // Map pour stocker les timeouts d'inactivité (clé: lobbyCode_playerName)
    private inactiveTimeouts: Map<string, NodeJS.Timeout> = new Map();

    constructor(io: Server<ClientToServerEvents, ServerToClientEvents>) {
        this.io = io;
        this.setupSocketEvents();
    }

    private getDisconnectKey(lobbyCode: string, playerName: string): string {
        return `${lobbyCode}_${playerName}`;
    }

    /**
     * Nettoie les joueurs dont le socket est vraiment déconnecté (pas dans le lobby room)
     * et dont la période de grâce a expiré (pas de timeout actif)
     * Appelé quand quelqu'un rejoint ou quand on démarre une partie
     * @param excludePlayerName - Nom du joueur à exclure du nettoyage (celui qui se reconnecte)
     */
    private cleanupDisconnectedPlayers(lobby: ReturnType<typeof LobbyManager.getLobby>, excludePlayerName?: string): void {
        if (!lobby) return;

        const room = this.io.sockets.adapter.rooms.get(lobby.code);
        const connectedSocketIds = room ? Array.from(room) : [];

        // Trouver les joueurs inactifs dont le socket n'est plus connecté au room
        // ET qui n'ont pas de timeout de reconnexion actif (période de grâce expirée)
        const playersToRemove = lobby.players.filter(p =>
            !p.isActive &&
            !connectedSocketIds.includes(p.socketId) &&
            p.name !== excludePlayerName &&
            // Ne pas supprimer si un timeout de reconnexion est actif (joueur en période de grâce)
            !this.disconnectTimeouts.has(this.getDisconnectKey(lobby.code, p.name))
        );

        for (const player of playersToRemove) {
            // Supprimer le joueur (pas besoin d'annuler le timeout car il n'existe pas)
            LobbyManager.removePlayer(lobby, player);
            logger.info(`Joueur déconnecté ${player.name} retiré du lobby ${lobby.code} (période de grâce expirée)`);
        }
    }

    /**
     * Build reveal results from the current round's answers and guesses
     */
    private buildRevealResults(lobby: ReturnType<typeof LobbyManager.getLobby>, round: { answers: Record<string, string>; guesses: Record<string, string> } | null): Array<{
        playerId: string;
        playerName: string;
        playerAvatarId: number;
        answer: string;
        guessedPlayerId: string;
        guessedPlayerName: string;
        guessedPlayerAvatarId: number;
        correct: boolean;
    }> {
        if (!lobby || !round) return [];

        return Object.entries(round.answers).map(([playerId, answer]) => {
            const guessedPlayerId = round.guesses[playerId];
            const player = lobby.getPlayer(playerId);
            const guessedPlayer = guessedPlayerId ? lobby.getPlayer(guessedPlayerId) : null;

            return {
                playerId,
                playerName: player?.name || 'Unknown',
                playerAvatarId: player?.avatarId ?? 0,
                answer: answer as string,
                guessedPlayerId: guessedPlayerId || '',
                guessedPlayerName: guessedPlayer?.name || 'Non assigné',
                guessedPlayerAvatarId: guessedPlayer?.avatarId ?? 0,
                correct: guessedPlayerId === playerId
            };
        });
    }

    private cancelDisconnectTimeout(lobbyCode: string, playerName: string): void {
        const key = this.getDisconnectKey(lobbyCode, playerName);
        const timeout = this.disconnectTimeouts.get(key);
        if (timeout) {
            clearTimeout(timeout);
            this.disconnectTimeouts.delete(key);
            logger.debug(`Timeout de déconnexion annulé pour ${playerName} dans ${lobbyCode}`);
        }
    }

    private cancelLeaderDisconnectTimeout(lobbyCode: string): void {
        const timeout = this.leaderDisconnectTimeouts.get(lobbyCode);
        if (timeout) {
            clearTimeout(timeout);
            this.leaderDisconnectTimeouts.delete(lobbyCode);
            logger.debug(`Timeout de déconnexion du chef annulé pour ${lobbyCode}`);
        }
    }

    private cancelInactiveTimeout(lobbyCode: string, playerName: string): void {
        const key = this.getDisconnectKey(lobbyCode, playerName);
        const timeout = this.inactiveTimeouts.get(key);
        if (timeout) {
            clearTimeout(timeout);
            this.inactiveTimeouts.delete(key);
            logger.debug(`Timeout d'inactivité annulé pour ${playerName} dans ${lobbyCode}`);
        }
    }

    /**
     * Clean up all disconnect timeouts and reconnection locks for a specific lobby
     */
    private cleanupLobbyResources(lobbyCode: string): void {
        // Clean up all disconnect timeouts for this lobby
        const keysToDelete: string[] = [];
        for (const [key, timeout] of this.disconnectTimeouts.entries()) {
            if (key.startsWith(`${lobbyCode}_`)) {
                clearTimeout(timeout);
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => this.disconnectTimeouts.delete(key));

        // Clean up leader disconnect timeout for this lobby
        this.cancelLeaderDisconnectTimeout(lobbyCode);

        // Clean up all reconnection locks for this lobby
        const locksToDelete: string[] = [];
        for (const key of this.reconnectionLocks) {
            if (key.startsWith(`${lobbyCode}_`)) {
                locksToDelete.push(key);
            }
        }
        locksToDelete.forEach(key => this.reconnectionLocks.delete(key));

        if (keysToDelete.length > 0 || locksToDelete.length > 0) {
            logger.debug(`Nettoyage lobby ${lobbyCode}: ${keysToDelete.length} timeouts, ${locksToDelete.length} locks`);
        }
    }

    private setupSocketEvents(): void {
        this.io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
            logger.socket.connect(socket.id);
            // Event: Create Lobby with player name as host
            socket.on('createLobby', (data) => {
                try {
                    // Rate limiting
                    if (!rateLimiters.createLobby.isAllowed(socket.id)) {
                        socket.emit('error', { message: 'Trop de requêtes. Veuillez patienter.' });
                        return;
                    }

                    // Validate player name
                    const nameValidation = validatePlayerName(data.playerName);
                    if (!nameValidation.isValid) {
                        socket.emit('error', { message: nameValidation.error || 'Nom invalide' });
                        return;
                    }

                    const sanitizedName = sanitizeInput(data.playerName);
                    // Valider avatarId
                    const avatarId = typeof data.avatarId === 'number'
                        && data.avatarId >= GAME_CONSTANTS.MIN_AVATAR_ID
                        && data.avatarId <= GAME_CONSTANTS.MAX_AVATAR_ID
                        ? Math.floor(data.avatarId)
                        : GAME_CONSTANTS.MIN_AVATAR_ID;
                    const lobbyCode = LobbyManager.create();
                    const lobby = LobbyManager.getLobby(lobbyCode);
                    const hostPlayer = new Player(sanitizedName, socket.id, true, avatarId);
                    lobby?.addPlayer(hostPlayer);
                    socket.join(lobbyCode);
                    socket.emit('lobbyCreated', {lobbyCode});
                    logger.game.created(lobbyCode, sanitizedName);
                } catch (error) {
                    logger.error('Error creating lobby', { error: (error as Error).message });
                    socket.emit('error', {message: (error as Error).message});
                }
            });
            // Event: Join Lobby with player name
            socket.on('joinLobby', (data) => {
                try {
                    // Rate limiting
                    if (!rateLimiters.joinLobby.isAllowed(socket.id)) {
                        socket.emit('error', { message: 'Trop de requêtes. Veuillez patienter.' });
                        return;
                    }

                    // Validate lobby code
                    const codeValidation = validateLobbyCode(data.lobbyCode);
                    if (!codeValidation.isValid) {
                        socket.emit('error', { message: codeValidation.error || 'Code invalide' });
                        return;
                    }

                    // Validate player name
                    const nameValidation = validatePlayerName(data.playerName);
                    if (!nameValidation.isValid) {
                        socket.emit('error', { message: nameValidation.error || 'Nom invalide' });
                        return;
                    }

                    const sanitizedName = sanitizeInput(data.playerName);
                    const lobby = LobbyManager.getLobby(data.lobbyCode);
                    if (!lobby) {
                        socket.emit('error', { message: 'Salon introuvable' });
                        return;
                    }

                    // Update lobby activity
                    lobby.updateActivity();

                    // Nettoyer les joueurs vraiment déconnectés (ceux qui ont quitté l'onglet)
                    // IMPORTANT: Exclure le joueur qui se reconnecte pour ne pas le supprimer
                    this.cleanupDisconnectedPlayers(lobby, sanitizedName);

                    // Vérifie si le joueur avec ce socket.id est déjà dans le lobby
                    const existingPlayerBySocket = lobby.players.find(p => p.socketId === socket.id);
                    if (existingPlayerBySocket) {
                        logger.debug(`Player ${existingPlayerBySocket.name} déjà dans le lobby ${lobby.code}`);
                        // Annuler les timeouts de déconnexion et d'inactivité s'ils existent
                        this.cancelDisconnectTimeout(lobby.code, existingPlayerBySocket.name);
                        this.cancelInactiveTimeout(lobby.code, existingPlayerBySocket.name);
                        existingPlayerBySocket.isActive = true; // Marquer comme actif (rejouer)
                        socket.join(lobby.code);
                        socket.emit('joinedLobby', { player: existingPlayerBySocket });
                        this.io.to(lobby.code).emit('updatePlayersList', { players: lobby.players });
                        return;
                    }

                    // Vérifie si un joueur avec ce nom existe déjà (reconnexion après refresh)
                    const existingPlayerByName = lobby.players.find(p => p.name === sanitizedName);
                    if (existingPlayerByName) {
                        const lockKey = this.getDisconnectKey(lobby.code, sanitizedName);

                        // Vérifier si une reconnexion est déjà en cours
                        if (this.reconnectionLocks.has(lockKey)) {
                            logger.debug(`Reconnexion déjà en cours pour ${sanitizedName}`);
                            socket.emit('error', { message: 'Reconnexion en cours, veuillez patienter.' });
                            return;
                        }

                        // Acquérir le lock
                        this.reconnectionLocks.add(lockKey);

                        try {
                            // C'est une reconnexion - mettre à jour le socketId
                            logger.info(`Player ${sanitizedName} reconnecte au lobby ${lobby.code}`);
                            // Annuler les timeouts de déconnexion et d'inactivité s'ils existent
                            this.cancelDisconnectTimeout(lobby.code, sanitizedName);
                            this.cancelInactiveTimeout(lobby.code, sanitizedName);
                            existingPlayerByName.socketId = socket.id;
                            existingPlayerByName.isActive = true; // Marquer comme actif (rejouer)

                            // Si c'est le chef du round actuel, annuler le timeout de saut de round
                            if (lobby.game?.currentRound?.leader.id === existingPlayerByName.id) {
                                this.cancelLeaderDisconnectTimeout(lobby.code);
                                lobby.game.currentRound.leader.socketId = socket.id;
                                logger.info(`Chef reconnecté via joinLobby, timeout saut annulé`);
                            }

                            socket.join(lobby.code);
                            socket.emit('joinedLobby', { player: existingPlayerByName });
                            this.io.to(lobby.code).emit('updatePlayersList', { players: lobby.players });
                        } finally {
                            // Relâcher le lock
                            this.reconnectionLocks.delete(lockKey);
                        }
                        return;
                    }

                    // Nouveau joueur - valider avatarId
                    const avatarId = typeof data.avatarId === 'number'
                        && data.avatarId >= GAME_CONSTANTS.MIN_AVATAR_ID
                        && data.avatarId <= GAME_CONSTANTS.MAX_AVATAR_ID
                        ? Math.floor(data.avatarId)
                        : GAME_CONSTANTS.MIN_AVATAR_ID;
                    const newPlayer = new Player(sanitizedName, socket.id, false, avatarId);
                    LobbyManager.addPlayer(lobby, newPlayer);

                    socket.join(lobby.code);
                    socket.emit('joinedLobby', { player: newPlayer });
                    this.io.to(lobby.code).emit('updatePlayersList', { players: lobby.players });
                    logger.info(`${sanitizedName} a rejoint le lobby ${lobby.code}`, { playerCount: lobby.players.length });

                } catch (error) {
                    logger.error('Error joining lobby', { error: (error as Error).message });
                    socket.emit('error', { message: (error as Error).message });
                }
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
                    logger.error('Error getting lobby info', { error: (error as Error).message });
                    socket.emit('lobbyInfo', { exists: false });
                }
            });

            // Check player name before joining lobby
            socket.on('checkPlayerName', (data) => {
                try {
                    // Rate limiting
                    if (!rateLimiters.general.isAllowed(socket.id)) {
                        socket.emit('error', { message: 'Trop de requêtes. Veuillez patienter.' });
                        return;
                    }

                    // Validate lobby code
                    const codeValidation = validateLobbyCode(data.lobbyCode);
                    if (!codeValidation.isValid) {
                        socket.emit('error', { message: codeValidation.error || 'Code invalide' });
                        return;
                    }

                    // Validate player name
                    const nameValidation = validatePlayerName(data.playerName);
                    if (!nameValidation.isValid) {
                        socket.emit('error', { message: nameValidation.error || 'Nom invalide' });
                        return;
                    }

                    const sanitizedName = sanitizeInput(data.playerName);
                    const lobby = LobbyManager.getLobby(data.lobbyCode);
                    if (!lobby) {
                        socket.emit('error', {message: 'Salon introuvable'});
                        return;
                    }
                    if (lobby.players.find(p => p.name === sanitizedName)) {
                        socket.emit('playerNameExists', {playerName: sanitizedName});
                    } else {
                        socket.emit('playerNameValid');
                    }
                } catch (error) {
                    logger.error('Error checking player name', { error: (error as Error).message });
                    socket.emit('error', {message: (error as Error).message});
                }
            });

            // Leave Lobby
            socket.on('leaveLobby', (data: { lobbyCode: string; currentPlayerId: string; }) => {
                try {
                    // Rate limiting
                    if (!rateLimiters.general.isAllowed(socket.id)) {
                        socket.emit('error', { message: 'Trop de requêtes. Veuillez patienter.' });
                        return;
                    }

                    // Validate playerId
                    const playerIdValidation = validatePlayerId(data.currentPlayerId);
                    if (!playerIdValidation.isValid) {
                        socket.emit('error', { message: playerIdValidation.error || 'ID joueur invalide' });
                        return;
                    }

                    const lobby = LobbyManager.getLobby(data.lobbyCode);
                    if (!lobby) {
                        socket.emit('error', {message: 'Salon introuvable'});
                        return;
                    }
                    logger.debug('leaveLobby', { playerId: data.currentPlayerId, lobbyCode: data.lobbyCode });
                    const player = lobby.getPlayer(data.currentPlayerId);
                    if (!player) {
                        socket.emit('error', {message: 'Joueur introuvable'});
                        return;
                    }

                    // Vérifier que le socket correspond au joueur (anti-usurpation)
                    if (player.socketId !== socket.id) {
                        logger.warn(`Tentative d'usurpation leaveLobby: socket ${socket.id} essaie de quitter pour ${player.name}`);
                        socket.emit('error', {message: 'Action non autorisée'});
                        return;
                    }

                    const lobbyCode = lobby.code;
                    const isLobbyRemoved = LobbyManager.removePlayer(lobby, player);
                    this.io.to(lobbyCode).emit('updatePlayersList', {players: lobby.players});
                    logger.info(`${player.name} a quitté le lobby ${lobbyCode}`);
                    if (isLobbyRemoved) {
                        this.cleanupLobbyResources(lobbyCode);
                        socket.leave(lobbyCode);
                        logger.info(`Lobby ${lobbyCode} supprimé`);
                    }

                } catch (error) {
                    logger.error('Error leaving lobby', { error: (error as Error).message });
                    socket.emit('error', {message: (error as Error).message});
                }
            });

            // Kick Player from Lobby
            socket.on('kickPlayer', ({ lobbyCode, playerId }) => {
                // Rate limiting
                if (!rateLimiters.kickPlayer.isAllowed(socket.id)) {
                    socket.emit('error', { message: 'Trop de requêtes. Veuillez patienter.' });
                    return;
                }

                // Validate playerId
                const playerIdValidation = validatePlayerId(playerId);
                if (!playerIdValidation.isValid) {
                    socket.emit('error', { message: playerIdValidation.error || 'ID joueur invalide' });
                    return;
                }

                const lobby = LobbyManager.getLobby(lobbyCode);
                if (!lobby) {
                    socket.emit('error', { message: 'Salon introuvable' });
                    return;
                }

                // Vérifier que c'est l'hôte qui fait la demande
                const host = lobby.players.find(p => p.isHost);
                if (!host || host.socketId !== socket.id) {
                    socket.emit('error', { message: 'Seul l\'hôte peut expulser des joueurs' });
                    return;
                }

                const kickedPlayer = lobby.getPlayer(playerId);
                if (!kickedPlayer) {
                    socket.emit('error', { message: 'Joueur introuvable' });
                    return;
                }

                // L'hôte ne peut pas se kick lui-même
                if (kickedPlayer.isHost) {
                    socket.emit('error', { message: 'Impossible d\'expulser l\'hôte' });
                    return;
                }

                // Remove player from lobby
                lobby.removePlayer(kickedPlayer);
                this.io.to(lobbyCode).emit('updatePlayersList', { players: lobby.players });
                logger.info(`Player ${kickedPlayer.name} expulsé du lobby ${lobbyCode}`);
                // Notify kicked player
                this.io.to(kickedPlayer.socketId).emit('kickedFromLobby');
            });       
            
            // Promote Player to Host
            socket.on('promotePlayer', ({ lobbyCode, playerId }) => {
                try {
                    // Rate limiting
                    if (!rateLimiters.gameAction.isAllowed(socket.id)) {
                        socket.emit('error', { message: 'Trop de requêtes. Veuillez patienter.' });
                        return;
                    }

                    // Validate playerId
                    const playerIdValidation = validatePlayerId(playerId);
                    if (!playerIdValidation.isValid) {
                        socket.emit('error', { message: playerIdValidation.error || 'ID joueur invalide' });
                        return;
                    }

                    const lobby = LobbyManager.getLobby(lobbyCode);
                    if (!lobby) {
                        socket.emit('error', { message: 'Salon introuvable' });
                        return;
                    }

                    // Vérifier que c'est l'hôte actuel qui fait la demande
                    const currentHost = lobby.players.find(p => p.isHost);
                    if (!currentHost || currentHost.socketId !== socket.id) {
                        socket.emit('error', { message: 'Seul l\'hôte peut promouvoir des joueurs' });
                        return;
                    }

                    const playerToPromote = lobby.getPlayer(playerId);
                    if (!playerToPromote) {
                        socket.emit('error', { message: 'Joueur introuvable' });
                        return;
                    }

                    // Ne peut pas se promouvoir soi-même (déjà hôte)
                    if (playerToPromote.isHost) {
                        socket.emit('error', { message: 'Ce joueur est déjà l\'hôte' });
                        return;
                    }

                    // Promote player to host
                    lobby.setHost(playerToPromote);
                    this.io.to(lobbyCode).emit('updatePlayersList', { players: lobby.players });
                    logger.info(`Player ${playerToPromote.name} promu hôte dans ${lobbyCode}`);
                } catch (error) {
                    logger.error('Error promoting player', { error: (error as Error).message });
                    socket.emit('error', { message: (error as Error).message });
                }
            });

            // Start Game
            socket.on('startGame', (data) => {
                try {
                    // Rate limiting
                    if (!rateLimiters.gameAction.isAllowed(socket.id)) {
                        socket.emit('error', { message: 'Trop de requêtes. Veuillez patienter.' });
                        return;
                    }

                    const lobby = LobbyManager.getLobby(data.lobbyCode);
                    if (!lobby) {
                        socket.emit('error', {message: 'Salon introuvable'});
                        return;
                    }

                    // Vérifier que c'est l'hôte qui lance la partie
                    const host = lobby.players.find(p => p.isHost);
                    if (!host || host.socketId !== socket.id) {
                        socket.emit('error', { message: 'Seul l\'hôte peut lancer la partie' });
                        return;
                    }

                    // Vérifier qu'il y a assez de joueurs
                    const activePlayers = lobby.players.filter(p => p.isActive);
                    if (activePlayers.length < 3) {
                        socket.emit('error', { message: 'Il faut au moins 3 joueurs pour lancer la partie' });
                        return;
                    }

                    // Update lobby activity
                    lobby.updateActivity();

                    // Nettoyer les joueurs vraiment déconnectés avant de démarrer
                    this.cleanupDisconnectedPlayers(lobby);

                    // Revérifier le nombre de joueurs après le nettoyage
                    const activePlayersAfterCleanup = lobby.players.filter(p => p.isActive);
                    if (activePlayersAfterCleanup.length < 3) {
                        socket.emit('error', { message: 'Il faut au moins 3 joueurs pour lancer la partie' });
                        return;
                    }

                    const game = GameManager.createGame(lobby);
                    lobby.game = game; // Assigner le jeu au lobby

                    // Démarrer le premier round automatiquement
                    game.nextRound();

                    // Créer un objet sérialisable sans référence circulaire
                    const gameData = {
                        lobby: {
                            code: lobby.code,
                            players: lobby.players
                        },
                        currentRound: game.currentRound,
                        status: game.status,
                        rounds: game.rounds
                    };

                    // Envoyer les événements aux clients
                    this.io.to(data.lobbyCode).emit('gameStarted', {game: gameData});
                    if (game.currentRound) {
                        this.io.to(data.lobbyCode).emit('roundStarted', {round: game.currentRound});
                    }
                    logger.game.started(data.lobbyCode, activePlayers.length);
                } catch (error) {
                    logger.error('Error starting game', { error: (error as Error).message });
                    socket.emit('error', {message: (error as Error).message});
                }
            });

            // Request Questions (Chef demande des cartes de questions)
            socket.on('requestQuestions', (data) => {
                try {
                    // Rate limiting
                    if (!rateLimiters.requestQuestions.isAllowed(socket.id)) {
                        socket.emit('error', { message: 'Trop de requêtes. Veuillez patienter.' });
                        return;
                    }

                    const lobby = LobbyManager.getLobby(data.lobbyCode);
                    const game = lobby?.game;
                    if (!game || !game.currentRound) {
                        socket.emit('error', {message: 'Partie ou round introuvable'});
                        return;
                    }

                    // Vérifier que c'est bien le chef qui demande
                    if (socket.id !== game.currentRound.leader.socketId) {
                        socket.emit('error', {message: 'Seul le chef peut demander des questions'});
                        return;
                    }

                    // Si c'est une relance explicite (isRelance: true), incrémenter le compteur
                    if (data.isRelance === true) {
                        game.currentRound.relancesUsed = (game.currentRound.relancesUsed || 0) + 1;
                    }

                    // Si une carte existe déjà et ce n'est pas une relance, c'est une reconnexion → renvoyer la carte existante
                    if (game.currentRound.gameCard?.questions?.length > 0 && data.isRelance !== true) {
                        socket.emit('questionsReceived', { questions: [game.currentRound.gameCard] });
                        logger.debug(`Carte existante renvoyée au leader (reconnexion)`, { lobbyCode: data.lobbyCode });
                        return;
                    }

                    // Envoyer le nombre de cartes demandé (par défaut 3, max 10)
                    const rawCount = typeof data.count === 'number' ? data.count : 3;
                    const count = Math.max(1, Math.min(10, Math.floor(rawCount)));
                    const questions = GameManager.getRandomQuestions(count);

                    // Stocker la première carte dans le Round pour l'auto-sélection
                    if (questions.length > 0) {
                        game.currentRound.gameCard = questions[0];
                    }

                    socket.emit('questionsReceived', { questions });
                    logger.debug(`${count} carte(s) envoyée(s) au leader`, { lobbyCode: data.lobbyCode });
                } catch (error) {
                    logger.error('Error requesting questions', { error: (error as Error).message });
                    socket.emit('error', {message: (error as Error).message});
                }
            });

            // Select Question (Chef sélectionne une question)
            socket.on('selectQuestion', (data) => {
                try {
                    // Rate limiting
                    if (!rateLimiters.selectQuestion.isAllowed(socket.id)) {
                        socket.emit('error', { message: 'Trop de requêtes. Veuillez patienter.' });
                        return;
                    }

                    const lobby = LobbyManager.getLobby(data.lobbyCode);
                    const game = lobby?.game;
                    if (!game || !game.currentRound) {
                        socket.emit('error', {message: 'Partie ou round introuvable'});
                        return;
                    }

                    // Vérifier que c'est bien le chef qui sélectionne
                    if (socket.id !== game.currentRound.leader.socketId) {
                        socket.emit('error', {message: 'Seul le chef peut sélectionner une question'});
                        return;
                    }

                    // Valider que la question sélectionnée est bien une des questions proposées
                    const validQuestion = typeof data.selectedQuestion === 'string'
                        && data.selectedQuestion.length > 0
                        && data.selectedQuestion.length <= 500;

                    if (!validQuestion) {
                        socket.emit('error', {message: 'Question invalide'});
                        return;
                    }

                    // Vérifier que la question fait partie des questions de la carte proposée
                    const gameCard = game.currentRound.gameCard;
                    if (gameCard && gameCard.questions && !gameCard.questions.includes(data.selectedQuestion)) {
                        logger.warn(`Question non autorisée sélectionnée`, { lobbyCode: data.lobbyCode, question: data.selectedQuestion });
                        socket.emit('error', {message: 'Cette question n\'est pas disponible'});
                        return;
                    }

                    // Enregistrer la question sélectionnée et passer à la phase suivante
                    game.currentRound.setSelectedQuestion(data.selectedQuestion);
                    game.currentRound.nextPhase(); // Passe à ANSWERING

                    // Broadcast la question à tous les joueurs
                    this.io.to(data.lobbyCode).emit('questionSelected', {
                        question: data.selectedQuestion,
                        phase: game.currentRound.phase
                    });
                    logger.debug(`Question sélectionnée`, { lobbyCode: data.lobbyCode });
                } catch (error) {
                    logger.error('Error selecting question', { error: (error as Error).message });
                    socket.emit('error', {message: (error as Error).message});
                }
            });

            // Next Round
            socket.on('nextRound', (data) => {
                try {
                    // Rate limiting
                    if (!rateLimiters.gameAction.isAllowed(socket.id)) {
                        socket.emit('error', { message: 'Trop de requêtes. Veuillez patienter.' });
                        return;
                    }

                    const lobby = LobbyManager.getLobby(data.lobbyCode);
                    const game = lobby?.game;
                    if (!game) {
                        socket.emit('error', {message: 'Partie introuvable'});
                        return;
                    }

                    // Vérifier que c'est le leader du round actuel qui demande le prochain round
                    if (game.currentRound && socket.id !== game.currentRound.leader.socketId) {
                        socket.emit('error', {message: 'Seul le chef peut passer au round suivant'});
                        return;
                    }

                    // Vérifier si le jeu est terminé
                    if (game.isGameOver()) {
                        game.end();

                        // Marquer tous les joueurs comme inactifs (ils devront cliquer sur "Rejouer")
                        if (lobby) {
                            lobby.players.forEach(p => p.isActive = false);
                        }

                        this.io.to(data.lobbyCode).emit('gameEnded', {
                            leaderboard: game.getLeaderboard(),
                            rounds: game.rounds
                        });
                        logger.game.ended(data.lobbyCode);
                        return;
                    }

                    // Sinon, passer au round suivant
                    game.nextRound();
                    if (game.currentRound) {
                        this.io.to(data.lobbyCode).emit('roundStarted', {round: game.currentRound});
                        logger.game.roundStarted(data.lobbyCode, game.currentRound.roundNumber, game.currentRound.leader.name);
                    }
                } catch (error) {
                    logger.error('Error starting next round', { error: (error as Error).message });
                    socket.emit('error', {message: (error as Error).message});
                }
            });

            // Get Game Results (pour EndGame qui arrive après)
            socket.on('getGameResults', (data) => {
                try {
                    // Rate limiting
                    if (!rateLimiters.general.isAllowed(socket.id)) {
                        socket.emit('error', { message: 'Trop de requêtes. Veuillez patienter.' });
                        return;
                    }

                    const lobby = LobbyManager.getLobby(data.lobbyCode);
                    const game = lobby?.game;
                    if (!game) {
                        socket.emit('error', {message: 'Partie introuvable'});
                        return;
                    }

                    socket.emit('gameEnded', {
                        leaderboard: game.getLeaderboard(),
                        rounds: game.rounds
                    });
                } catch (error) {
                    logger.error('Error getting game results', { error: (error as Error).message });
                    socket.emit('error', {message: (error as Error).message});
                }
            });

            // Event: Get Game State (pour récupérer l'état actuel du jeu + reconnexion)
            socket.on('getGameState', (data: { lobbyCode: string; playerId?: string }) => {
                try {
                    // Rate limiting
                    if (!rateLimiters.general.isAllowed(socket.id)) {
                        socket.emit('error', { message: 'Trop de requêtes. Veuillez patienter.' });
                        return;
                    }

                    // Validate playerId if provided
                    if (data.playerId) {
                        const playerIdValidation = validatePlayerId(data.playerId);
                        if (!playerIdValidation.isValid) {
                            socket.emit('error', { message: playerIdValidation.error || 'ID joueur invalide' });
                            return;
                        }
                    }

                    const lobby = LobbyManager.getLobby(data.lobbyCode);
                    const game = lobby?.game;
                    if (!game) {
                        socket.emit('error', {message: 'Partie introuvable'});
                        return;
                    }

                    // Reconnexion: mettre à jour le socketId du joueur
                    if (data.playerId) {
                        const player = lobby.players.find(p => p.id === data.playerId);
                        if (player) {
                            const lockKey = this.getDisconnectKey(lobby.code, player.name);

                            // Vérifier si une reconnexion est déjà en cours
                            if (this.reconnectionLocks.has(lockKey)) {
                                logger.debug(`Reconnexion game déjà en cours pour ${player.name}`);
                                // Ne pas bloquer, juste envoyer l'état actuel sans mise à jour
                            } else {
                                // Acquérir le lock
                                this.reconnectionLocks.add(lockKey);

                                try {
                                    const oldSocketId = player.socketId;
                                    player.socketId = socket.id;
                                    player.isActive = true;
                                    socket.join(lobby.code);

                                    // Annuler les timeouts de déconnexion et d'inactivité s'ils existent
                                    this.cancelDisconnectTimeout(lobby.code, player.name);
                                    this.cancelInactiveTimeout(lobby.code, player.name);

                                    logger.info(`Player ${player.name} reconnected to game`, {
                                        lobbyCode: data.lobbyCode,
                                        oldSocketId,
                                        newSocketId: socket.id
                                    });

                                    // Si c'est le leader du round actuel, mettre à jour son socketId
                                    if (game.currentRound && game.currentRound.leader.id === data.playerId) {
                                        game.currentRound.leader.socketId = socket.id;
                                        // Annuler le timeout de saut de round si le chef se reconnecte
                                        this.cancelLeaderDisconnectTimeout(lobby.code);
                                        logger.info(`Leader socketId updated for round ${game.currentRound.roundNumber}`);
                                    }

                                    // Notifier les autres joueurs
                                    this.io.to(lobby.code).emit('updatePlayersList', { players: lobby.players });
                                } finally {
                                    // Relâcher le lock
                                    this.reconnectionLocks.delete(lockKey);
                                }
                            }
                        }
                    }

                    // Créer un objet sérialisable sans référence circulaire
                    const gameData = {
                        lobby: {
                            code: lobby.code,
                            players: lobby.players
                        },
                        currentRound: game.currentRound,
                        status: game.status,
                        rounds: game.rounds
                    };

                    // Données de reconnexion pour restaurer l'état du joueur
                    const reconnectionData: {
                        answeredPlayerIds: string[];
                        myAnswer?: string;
                        currentGuesses?: Record<string, string>;
                        relancesUsed?: number;
                    } = {
                        answeredPlayerIds: game.currentRound ? Object.keys(game.currentRound.answers) : []
                    };

                    // Si le joueur a fourni son ID, envoyer sa réponse s'il en a soumis une
                    if (data.playerId && game.currentRound?.answers[data.playerId]) {
                        reconnectionData.myAnswer = game.currentRound.answers[data.playerId];
                    }

                    // Restaurer les guesses pour la phase GUESSING
                    if (game.currentRound?.currentGuesses) {
                        reconnectionData.currentGuesses = game.currentRound.currentGuesses;
                    }

                    // Restaurer le nombre de relances utilisées pour QUESTION_SELECTION
                    if (game.currentRound?.relancesUsed !== undefined) {
                        reconnectionData.relancesUsed = game.currentRound.relancesUsed;
                    }

                    socket.emit('gameState', {
                        game: gameData,
                        players: lobby.players,
                        leaderboard: game.getLeaderboard(),
                        reconnectionData
                    });
                } catch (error) {
                    logger.error('Error getting game state', { error: (error as Error).message });
                    socket.emit('error', {message: (error as Error).message});
                }
            });

            // Event: Submit Answer
            socket.on('submitAnswer', (data) => {
                try {
                    // Rate limiting
                    if (!rateLimiters.submitAnswer.isAllowed(socket.id)) {
                        socket.emit('error', { message: 'Trop de requêtes. Veuillez patienter.' });
                        return;
                    }

                    // Validate playerId
                    const playerIdValidation = validatePlayerId(data.playerId);
                    if (!playerIdValidation.isValid) {
                        socket.emit('error', { message: playerIdValidation.error || 'ID joueur invalide' });
                        return;
                    }

                    // Validate answer
                    const answerValidation = validateAnswer(data.answer);
                    if (!answerValidation.isValid) {
                        socket.emit('error', { message: answerValidation.error || 'Réponse invalide' });
                        return;
                    }

                    const sanitizedAnswer = sanitizeInput(data.answer);
                    const lobby = LobbyManager.getLobby(data.lobbyCode);
                    const game = lobby?.game;
                    if (!game) {
                        socket.emit('error', {message: 'Partie introuvable'});
                        return;
                    }

                    // Update lobby activity
                    lobby?.updateActivity();
                    if (!game.currentRound) {
                        socket.emit('error', {message: 'Round introuvable'});
                        return;
                    }
                    const player = lobby.getPlayer(data.playerId);
                    if (!player) {
                        socket.emit('error', {message: 'Joueur introuvable'});
                        return;
                    }

                    // Vérifier que le socket correspond au joueur (anti-usurpation)
                    if (player.socketId !== socket.id) {
                        logger.warn(`Tentative d'usurpation: socket ${socket.id} essaie de soumettre pour ${player.name}`);
                        socket.emit('error', {message: 'Action non autorisée'});
                        return;
                    }

                    // Vérifier que le joueur n'a pas déjà répondu
                    if (game.currentRound.answers[data.playerId]) {
                        socket.emit('error', {message: 'Vous avez déjà soumis une réponse'});
                        return;
                    }

                    // Vérifier que le joueur n'est pas le chef (le chef ne répond pas)
                    if (player.id === game.currentRound.leader.id) {
                        socket.emit('error', {message: 'Le chef ne peut pas soumettre de réponse'});
                        return;
                    }

                    // Ajouter la réponse
                    game.currentRound.addAnswer(data.playerId, sanitizedAnswer);

                    // Joueurs actifs qui doivent répondre (tous sauf le chef)
                    const respondingPlayers = lobby.players.filter(p => p.isActive && p.id !== game.currentRound!.leader.id);

                    // Notifier tous les joueurs qu'une réponse a été soumise
                    this.io.to(data.lobbyCode).emit('playerAnswered', {
                        playerId: data.playerId,
                        totalAnswers: Object.keys(game.currentRound.answers).length,
                        expectedAnswers: respondingPlayers.length
                    });

                    logger.debug(`Réponse soumise par ${player.name}`, { lobbyCode: data.lobbyCode, answers: Object.keys(game.currentRound.answers).length });

                    // Vérifier si tous les joueurs ACTIFS (sauf le chef) ont répondu
                    const allActiveAnswered = respondingPlayers.every(p => game.currentRound!.answers[p.id]);

                    if (allActiveAnswered) {
                        // Ajouter NO_RESPONSE pour les joueurs INACTIFS qui n'ont pas répondu
                        const inactivePlayers = lobby.players.filter(p => !p.isActive && p.id !== game.currentRound!.leader.id);
                        for (const inactivePlayer of inactivePlayers) {
                            if (!game.currentRound.answers[inactivePlayer.id]) {
                                game.currentRound.addAnswer(inactivePlayer.id, `__NO_RESPONSE__${inactivePlayer.name} s'est déconnecté`);
                                logger.debug(`Réponse auto ajoutée pour joueur inactif ${inactivePlayer.name}`);
                            }
                        }

                        // Tous les joueurs actifs ont répondu, passer à la phase GUESSING
                        game.currentRound.nextPhase();
                        this.io.to(data.lobbyCode).emit('allAnswersSubmitted', {
                            phase: game.currentRound.phase,
                            answersCount: Object.keys(game.currentRound.answers).length
                        });

                        // Automatiquement envoyer les réponses mélangées à tous les joueurs
                        const answersArray = Object.entries(game.currentRound.answers).map(([playerId, answer]) => ({
                            id: playerId,
                            text: answer
                        }));
                        const shuffledAnswers = shuffleArray(answersArray);
                        this.io.to(data.lobbyCode).emit('shuffledAnswersReceived', {
                            answers: shuffledAnswers,
                            players: lobby.players.filter(p => p.id !== game.currentRound!.leader.id)
                        });

                        logger.info(`Toutes les réponses soumises, passage à GUESSING`, { lobbyCode: data.lobbyCode });
                    }
                } catch (error) {
                    logger.error('Error submitting answer', { error: (error as Error).message });
                    socket.emit('error', {message: (error as Error).message});
                }
            });

            // Request Shuffled Answers (N'importe quel joueur peut demander les réponses mélangées)
            socket.on('requestShuffledAnswers', (data) => {
                try {
                    // Rate limiting
                    if (!rateLimiters.general.isAllowed(socket.id)) {
                        socket.emit('error', { message: 'Trop de requêtes. Veuillez patienter.' });
                        return;
                    }

                    const lobby = LobbyManager.getLobby(data.lobbyCode);
                    const game = lobby?.game;
                    if (!game || !game.currentRound) {
                        socket.emit('error', {message: 'Partie ou round introuvable'});
                        return;
                    }

                    // Créer un tableau de réponses avec leurs IDs (playerId)
                    const answersArray = Object.entries(game.currentRound.answers).map(([playerId, answer]) => ({
                        id: playerId,
                        text: answer
                    }));

                    // Mélanger les réponses (shuffle)
                    const shuffledAnswers = shuffleArray(answersArray);

                    // Envoyer les réponses mélangées à TOUS les joueurs
                    this.io.to(data.lobbyCode).emit('shuffledAnswersReceived', {
                        answers: shuffledAnswers,
                        players: lobby.players.filter(p => p.id !== game.currentRound!.leader.id)
                    });
                } catch (error) {
                    logger.error('Error requesting shuffled answers', { error: (error as Error).message });
                    socket.emit('error', {message: (error as Error).message});
                }
            });

            // Update Guess (Chef déplace une réponse - BROADCAST en temps réel)
            socket.on('updateGuess', (data) => {
                try {
                    // Rate limiting
                    if (!rateLimiters.updateGuess.isAllowed(socket.id)) {
                        socket.emit('error', { message: 'Trop de requêtes. Veuillez patienter.' });
                        return;
                    }

                    const lobby = LobbyManager.getLobby(data.lobbyCode);
                    const game = lobby?.game;
                    if (!game || !game.currentRound) {
                        socket.emit('error', {message: 'Partie ou round introuvable'});
                        return;
                    }

                    // Vérifier que c'est bien le chef qui déplace
                    if (socket.id !== game.currentRound.leader.socketId) {
                        socket.emit('error', {message: 'Seul le chef peut modifier les attributions'});
                        return;
                    }

                    // Mettre à jour l'état intermédiaire du drag & drop
                    game.currentRound.updateCurrentGuess(data.answerId, data.playerId);

                    // BROADCASTER le delta seulement (pas l'état complet pour économiser la bande passante)
                    this.io.to(data.lobbyCode).emit('guessUpdated', {
                        answerId: data.answerId,
                        playerId: data.playerId
                        // Note: currentGuesses retiré - le client reconstruit l'état à partir des deltas
                    });
                } catch (error) {
                    logger.error('Error updating guess', { error: (error as Error).message });
                    socket.emit('error', {message: (error as Error).message});
                }
            });

            // Submit Guesses (Chef valide ses choix finaux)
            socket.on('submitGuesses', (data) => {
                try {
                    // Rate limiting
                    if (!rateLimiters.submitGuesses.isAllowed(socket.id)) {
                        socket.emit('error', { message: 'Trop de requêtes. Veuillez patienter.' });
                        return;
                    }

                    const lobby = LobbyManager.getLobby(data.lobbyCode);
                    const game = lobby?.game;
                    if (!game || !game.currentRound) {
                        socket.emit('error', {message: 'Partie ou round introuvable'});
                        return;
                    }

                    // Vérifier que c'est bien le chef qui valide
                    if (socket.id !== game.currentRound.leader.socketId) {
                        socket.emit('error', {message: 'Seul le chef peut valider les attributions'});
                        return;
                    }

                    // Valider et filtrer les guesses
                    const answerIds = Object.keys(game.currentRound.answers);
                    const playerIds = lobby.players
                        .filter(p => p.id !== game.currentRound!.leader.id)
                        .map(p => p.id);

                    const validGuesses: Record<string, string> = {};
                    for (const [answerId, guessedPlayerId] of Object.entries(data.guesses)) {
                        // Ignorer les guesses null/undefined
                        if (guessedPlayerId === null || guessedPlayerId === undefined) continue;

                        // Vérifier que l'answerId correspond à une vraie réponse
                        if (!answerIds.includes(answerId)) {
                            logger.warn(`Guess invalide: answerId ${answerId} inexistant`);
                            continue;
                        }

                        // Vérifier que le playerId deviné est un joueur valide (pas le chef)
                        if (!playerIds.includes(guessedPlayerId as string)) {
                            logger.warn(`Guess invalide: playerId ${guessedPlayerId} inexistant ou est le chef`);
                            continue;
                        }

                        validGuesses[answerId] = guessedPlayerId as string;
                    }

                    // Enregistrer les attributions finales et calculer les scores
                    game.currentRound.submitGuesses(validGuesses);
                    game.currentRound.calculateScores();

                    // Passer à la phase REVEAL
                    game.currentRound.nextPhase();

                    // Créer les résultats détaillés
                    const results = this.buildRevealResults(lobby, game.currentRound);

                    // Broadcast les résultats à tous
                    this.io.to(data.lobbyCode).emit('revealResults', {
                        phase: game.currentRound.phase,
                        results,
                        scores: game.currentRound.scores,
                        leaderboard: game.getLeaderboard()
                    });

                    logger.info(`Attributions validées`, { lobbyCode: data.lobbyCode, leaderScore: game.currentRound.scores[game.currentRound.leader.id] || 0 });
                } catch (error) {
                    logger.error('Error submitting guesses', { error: (error as Error).message });
                    socket.emit('error', {message: (error as Error).message});
                }
            });

            // Reveal Next Answer (Chef révèle la prochaine réponse)
            socket.on('revealNextAnswer', (data) => {
                try {
                    // Rate limiting
                    if (!rateLimiters.revealAnswer.isAllowed(socket.id)) {
                        socket.emit('error', { message: 'Trop de requêtes. Veuillez patienter.' });
                        return;
                    }

                    const lobby = LobbyManager.getLobby(data.lobbyCode);
                    const game = lobby?.game;
                    if (!game || !game.currentRound) {
                        socket.emit('error', {message: 'Partie ou round introuvable'});
                        return;
                    }

                    // Vérifier que c'est bien le chef qui révèle
                    if (socket.id !== game.currentRound.leader.socketId) {
                        socket.emit('error', {message: 'Seul le chef peut révéler les réponses'});
                        return;
                    }

                    // Incrémenter le compteur de révélations
                    if (game.currentRound.revealedCount === undefined) {
                        game.currentRound.revealedCount = 0;
                    }
                    game.currentRound.revealedCount++;

                    // Broadcaster à tous les joueurs
                    this.io.to(data.lobbyCode).emit('answerRevealed', {
                        revealedIndex: game.currentRound.revealedCount
                    });
                } catch (error) {
                    logger.error('Error revealing answer', { error: (error as Error).message });
                    socket.emit('error', {message: (error as Error).message});
                }
            });

            // Start Timer (Démarrer un timer pour une phase)
            socket.on('startTimer', (data) => {
                try {
                    // Rate limiting
                    if (!rateLimiters.gameAction.isAllowed(socket.id)) {
                        socket.emit('error', { message: 'Trop de requêtes. Veuillez patienter.' });
                        return;
                    }

                    const lobby = LobbyManager.getLobby(data.lobbyCode);
                    const game = lobby?.game;
                    if (!game || !game.currentRound) {
                        socket.emit('error', {message: 'Partie ou round introuvable'});
                        return;
                    }

                    // Vérifier que c'est bien le chef qui démarre le timer
                    if (socket.id !== game.currentRound.leader.socketId) {
                        socket.emit('error', {message: 'Seul le chef peut démarrer le timer'});
                        return;
                    }

                    // Vérifier si un timer est déjà en cours pour CETTE phase (évite reset sur refresh)
                    // Chaque phase a son propre timer, on vérifie aussi la phase
                    const requestedPhase = game.currentRound.phase;
                    if (game.currentRound.timerStartedAt && game.currentRound.timerEnd && game.currentRound.timerDuration && game.currentRound.timerPhase === requestedPhase) {
                        const now = Date.now();
                        const timerEndTime = game.currentRound.timerEnd.getTime();
                        if (now < timerEndTime) {
                            // Timer encore actif pour cette phase - ne pas le reset, juste renvoyer l'état actuel au client
                            logger.debug(`Timer déjà actif pour phase ${requestedPhase}, pas de reset`, { lobbyCode: data.lobbyCode, phase: requestedPhase });
                            socket.emit('timerStarted', {
                                phase: game.currentRound.phase,
                                duration: game.currentRound.timerDuration,
                                startedAt: game.currentRound.timerStartedAt
                            });
                            return;
                        }
                    }

                    // Calculer la fin du timer (en secondes) - validation: 1s minimum, 1h maximum
                    const rawDuration = typeof data.duration === 'number' ? data.duration : 60;
                    const timerDuration = Math.max(1, Math.min(3600, Math.floor(rawDuration)));
                    const startedAt = Date.now();
                    const timerEnd = new Date(startedAt + timerDuration * 1000);

                    // Stocker les infos du timer pour pouvoir les renvoyer sur demande
                    game.currentRound.timerEnd = timerEnd;
                    game.currentRound.timerStartedAt = startedAt;
                    game.currentRound.timerDuration = timerDuration;
                    game.currentRound.timerPhase = game.currentRound.phase; // Pour éviter les conflits entre phases

                    // Broadcaster le démarrage du timer à tous
                    this.io.to(data.lobbyCode).emit('timerStarted', {
                        phase: game.currentRound.phase,
                        duration: timerDuration,
                        startedAt: startedAt
                    });
                    logger.debug(`Timer démarré: ${timerDuration}s`, { lobbyCode: data.lobbyCode, phase: game.currentRound.phase });
                } catch (error) {
                    logger.error('Error starting timer', { error: (error as Error).message });
                    socket.emit('error', {message: (error as Error).message});
                }
            });

            // Request Timer State (Demander l'état actuel du timer - utile pour les navigateurs lents comme Edge)
            socket.on('requestTimerState', (data) => {
                try {
                    // Rate limiting
                    if (!rateLimiters.general.isAllowed(socket.id)) {
                        socket.emit('timerState', null);
                        return;
                    }

                    const lobby = LobbyManager.getLobby(data.lobbyCode);
                    const game = lobby?.game;
                    if (!game || !game.currentRound) {
                        socket.emit('timerState', null);
                        return;
                    }

                    // Vérifier si un timer est actif pour cette phase
                    if (game.currentRound.timerStartedAt && game.currentRound.timerDuration) {
                        // Vérifier si on demande la bonne phase
                        if (data.phase && data.phase !== game.currentRound.phase) {
                            socket.emit('timerState', null);
                            return;
                        }

                        // Vérifier si le timer n'a pas expiré
                        const elapsed = Date.now() - game.currentRound.timerStartedAt;
                        const remaining = game.currentRound.timerDuration * 1000 - elapsed;

                        if (remaining > 0) {
                            socket.emit('timerState', {
                                phase: game.currentRound.phase,
                                duration: game.currentRound.timerDuration,
                                startedAt: game.currentRound.timerStartedAt
                            });
                            return;
                        }
                    }

                    socket.emit('timerState', null);
                } catch (error) {
                    logger.error('Error getting timer state', { error: (error as Error).message });
                    socket.emit('timerState', null);
                }
            });

            // Timer Expired (Le timer a expiré)
            socket.on('timerExpired', (data) => {
                try {
                    // Rate limiting
                    if (!rateLimiters.gameAction.isAllowed(socket.id)) {
                        socket.emit('error', { message: 'Trop de requêtes. Veuillez patienter.' });
                        return;
                    }

                    const lobby = LobbyManager.getLobby(data.lobbyCode);
                    const game = lobby?.game;
                    if (!game || !game.currentRound) {
                        socket.emit('error', {message: 'Partie ou round introuvable'});
                        return;
                    }

                    // Vérifier que c'est bien le chef qui signale l'expiration du timer
                    if (socket.id !== game.currentRound.leader.socketId) {
                        socket.emit('error', {message: 'Seul le chef peut signaler l\'expiration du timer'});
                        return;
                    }

                    const currentPhase = game.currentRound.phase;

                    // Protection contre les doubles appels de timer pour la même phase
                    if (game.currentRound.timerProcessedForPhase === currentPhase) {
                        logger.debug(`Timer déjà traité pour phase ${currentPhase}, ignoré`);
                        return;
                    }

                    logger.info(`Timer expiré`, { lobbyCode: data.lobbyCode, phase: currentPhase });

                    // Gérer l'expiration selon la phase
                    switch (currentPhase) {
                        case 'QUESTION_SELECTION':
                            // Marquer le timer comme traité pour cette phase
                            game.currentRound.timerProcessedForPhase = currentPhase;

                            // Si le chef n'a pas choisi, sélectionner automatiquement une question aléatoire parmi celles proposées
                            if (!game.currentRound.selectedQuestion) {
                                // Utiliser la carte déjà proposée au chef (stockée dans gameCard)
                                const proposedCard = game.currentRound.gameCard;

                                if (!proposedCard || proposedCard.questions.length === 0) {
                                    logger.error('Pas de questions disponibles pour auto-sélection', { lobbyCode: data.lobbyCode });
                                    break;
                                }

                                // Choisir une question au hasard parmi les 3 de la carte proposée
                                const randomQuestion = proposedCard.questions[randomInt(0, proposedCard.questions.length)];

                                game.currentRound.setSelectedQuestion(randomQuestion);
                                game.currentRound.nextPhase();
                                this.io.to(data.lobbyCode).emit('questionSelected', {
                                    question: randomQuestion,
                                    phase: game.currentRound.phase,
                                    auto: true
                                });
                                logger.info(`Question auto-sélectionnée`, { lobbyCode: data.lobbyCode });
                            }
                            // Sinon, la question a déjà été sélectionnée, ne rien faire
                            break;

                        case 'ANSWERING':
                            // Marquer le timer comme traité pour cette phase
                            game.currentRound.timerProcessedForPhase = currentPhase;

                            // Ajouter des réponses automatiques pour les joueurs qui n'ont pas répondu
                            const respondingPlayers = lobby.players.filter(p => p.id !== game.currentRound!.leader.id);
                            for (const player of respondingPlayers) {
                                if (!game.currentRound.answers[player.id]) {
                                    // Ajouter une réponse automatique marquée avec un préfixe spécial
                                    game.currentRound.addAnswer(player.id, `__NO_RESPONSE__${player.name} n'a pas répondu à temps`);
                                    logger.debug(`Réponse auto ajoutée pour ${player.name}`);
                                }
                            }

                            // Passer à la phase GUESSING même si tous n'ont pas répondu
                            game.currentRound.nextPhase();
                            this.io.to(data.lobbyCode).emit('allAnswersSubmitted', {
                                phase: game.currentRound.phase,
                                answersCount: Object.keys(game.currentRound.answers).length,
                                forced: true
                            });

                            // Automatiquement envoyer les réponses mélangées à tous les joueurs
                            const answersArray = Object.entries(game.currentRound.answers).map(([playerId, answer]) => ({
                                id: playerId,
                                text: answer
                            }));
                            const shuffledAnswers = shuffleArray(answersArray);
                            this.io.to(data.lobbyCode).emit('shuffledAnswersReceived', {
                                answers: shuffledAnswers,
                                players: lobby.players.filter(p => p.id !== game.currentRound!.leader.id)
                            });
                            break;

                        case 'GUESSING':
                            // Marquer le timer comme traité pour cette phase
                            game.currentRound.timerProcessedForPhase = currentPhase;

                            // Valider les attributions actuelles et passer à REVEAL
                            // Filtrer les guesses non assignés (null ou undefined)
                            const validGuesses = Object.fromEntries(
                                Object.entries(game.currentRound.currentGuesses).filter(([_, playerId]) => playerId !== null && playerId !== undefined)
                            );
                            game.currentRound.submitGuesses(validGuesses);
                            game.currentRound.calculateScores();
                            game.currentRound.nextPhase();

                            const results = this.buildRevealResults(lobby, game.currentRound);

                            this.io.to(data.lobbyCode).emit('revealResults', {
                                phase: game.currentRound.phase,
                                results,
                                scores: game.currentRound.scores,
                                leaderboard: game.getLeaderboard(),
                                forced: true
                            });
                            break;

                        case 'REVEAL':
                            // Rien à faire, attendre que le chef lance le prochain round
                            break;
                    }
                } catch (error) {
                    logger.error('Error handling timer expiration', { error: (error as Error).message });
                    socket.emit('error', {message: (error as Error).message});
                }
            });

            // ===== DISCONNECT HANDLING =====
            // Marquer le joueur comme inactif avec délai de grâce pour reconnexion
            socket.on('disconnect', (reason) => {
                logger.socket.disconnect(socket.id, reason);

                // Parcourir tous les lobbies pour trouver le joueur déconnecté
                const lobbies = LobbyManager.getLobbies();

                lobbies.forEach((lobby) => {
                    const disconnectedPlayer = lobby.players.find(p => p.socketId === socket.id);

                    if (disconnectedPlayer) {
                        logger.info(`Player ${disconnectedPlayer.name} déconnecté du lobby ${lobby.code}`);

                        const lobbyCode = lobby.code;
                        const playerName = disconnectedPlayer.name;
                        const playerId = disconnectedPlayer.id;

                        // Annuler un éventuel timeout d'inactivité existant
                        this.cancelInactiveTimeout(lobbyCode, playerName);

                        // Créer un timeout pour marquer le joueur comme inactif après un délai
                        const inactiveKey = this.getDisconnectKey(lobbyCode, playerName);
                        const inactiveTimeout = setTimeout(() => {
                            this.inactiveTimeouts.delete(inactiveKey);

                            // Revérifier que le lobby existe
                            const currentLobby = LobbyManager.getLobby(lobbyCode);
                            if (!currentLobby) return;

                            // Retrouver le joueur
                            const player = currentLobby.players.find(p => p.id === playerId);
                            if (!player) return;

                            // Si le joueur s'est reconnecté entre temps, ne rien faire
                            if (player.isActive) {
                                logger.debug(`Player ${playerName} s'est reconnecté, timeout inactivité ignoré`);
                                return;
                            }

                            // Marquer le joueur comme inactif
                            player.isActive = false;
                            logger.info(`Player ${playerName} marqué inactif après ${this.INACTIVE_DELAY}ms`);

                            // Notifier les autres joueurs
                            this.io.to(lobbyCode).emit('updatePlayersList', { players: currentLobby.players });
                        }, this.INACTIVE_DELAY);

                        this.inactiveTimeouts.set(inactiveKey, inactiveTimeout);

                        // === GESTION DU JEU EN COURS ===
                        const game = lobby.game;
                        if (game && game.currentRound && game.status === 'IN_PROGRESS') {
                            const currentRound = game.currentRound;
                            const lobbyCode = lobby.code;

                            // CAS 1: Le joueur déconnecté est le chef actuel
                            // On attend un court délai pour permettre la reconnexion (changement d'app mobile)
                            if (currentRound.leader.id === disconnectedPlayer.id) {
                                logger.info(`Chef ${disconnectedPlayer.name} déconnecté, délai avant saut de round`, { lobbyCode });

                                // Annuler un éventuel timeout existant
                                this.cancelLeaderDisconnectTimeout(lobbyCode);

                                const leaderName = disconnectedPlayer.name;
                                const leaderId = disconnectedPlayer.id;

                                // Attendre LEADER_DISCONNECT_DELAY avant de sauter le round
                                const leaderTimeout = setTimeout(() => {
                                    this.leaderDisconnectTimeouts.delete(lobbyCode);

                                    // Revérifier que le lobby et le jeu existent toujours
                                    const currentLobby = LobbyManager.getLobby(lobbyCode);
                                    const currentGame = currentLobby?.game;
                                    if (!currentLobby || !currentGame || !currentGame.currentRound) {
                                        logger.debug(`Lobby/jeu n'existe plus, timeout chef ignoré`);
                                        return;
                                    }

                                    // Vérifier que c'est toujours le même round et le même chef
                                    if (currentGame.currentRound.leader.id !== leaderId) {
                                        logger.debug(`Chef a changé, timeout ignoré`);
                                        return;
                                    }

                                    // Vérifier que le chef est toujours inactif (n'a pas reconnecté)
                                    const leader = currentLobby.players.find(p => p.id === leaderId);
                                    if (leader?.isActive) {
                                        logger.debug(`Chef ${leaderName} s'est reconnecté, timeout ignoré`);
                                        return;
                                    }

                                    logger.info(`Chef ${leaderName} toujours déconnecté, round sauté`, { lobbyCode });

                                    // Notifier que le round est sauté
                                    this.io.to(lobbyCode).emit('roundSkipped', {
                                        skippedLeaderName: leaderName,
                                        reason: 'leader_disconnected'
                                    });

                                    // Vérifier s'il reste des joueurs éligibles pour être chef
                                    const activePlayers = currentLobby.players.filter(p => p.isActive);
                                    const previousLeaderIds = new Set(currentGame.rounds.map(r => r.leader.id));
                                    const eligibleLeaders = activePlayers.filter(p => !previousLeaderIds.has(p.id));

                                    // Si pas assez de joueurs OU pas de chef éligible → terminer la partie
                                    if (activePlayers.length < 2 || eligibleLeaders.length === 0) {
                                        currentGame.end();
                                        currentLobby.players.forEach(p => p.isActive = false);
                                        this.io.to(lobbyCode).emit('gameEnded', {
                                            leaderboard: currentGame.getLeaderboard(),
                                            rounds: currentGame.rounds
                                        });
                                        logger.game.ended(lobbyCode);
                                    } else {
                                        // Démarrer le round suivant avec un nouveau chef
                                        try {
                                            currentGame.nextRound();
                                            this.io.to(lobbyCode).emit('roundStarted', {
                                                round: currentGame.currentRound!
                                            });
                                            logger.info(`Nouveau round démarré après déconnexion du chef`, {
                                                lobbyCode,
                                                newLeader: currentGame.currentRound!.leader.name
                                            });
                                        } catch (error) {
                                            logger.error('Erreur lors du démarrage du round suivant', { error: (error as Error).message });
                                            // Terminer la partie si impossible de continuer
                                            currentGame.end();
                                            currentLobby.players.forEach(p => p.isActive = false);
                                            this.io.to(lobbyCode).emit('gameEnded', {
                                                leaderboard: currentGame.getLeaderboard(),
                                                rounds: currentGame.rounds
                                            });
                                        }
                                    }
                                }, this.LEADER_DISCONNECT_DELAY);

                                this.leaderDisconnectTimeouts.set(lobbyCode, leaderTimeout);
                            }
                            // CAS 2: Le joueur déconnecté doit répondre
                            // On ne fait RIEN immédiatement - le timer de la phase ANSWERING gérera le NO_RESPONSE
                            // Ceci permet au joueur de se reconnecter (refresh) sans perdre sa place
                            // Note: Le joueur est déjà marqué inactif, ce qui est suffisant pour l'UI
                        }

                        // Créer un timeout pour supprimer le joueur après le délai de grâce
                        const disconnectKey = this.getDisconnectKey(lobbyCode, playerName);

                        // Annuler un éventuel timeout existant
                        this.cancelDisconnectTimeout(lobbyCode, playerName);

                        const timeout = setTimeout(() => {
                            // Toujours supprimer l'entrée du timeout en premier (évite les fuites mémoire)
                            this.disconnectTimeouts.delete(disconnectKey);

                            // Vérifier si le lobby existe encore
                            const currentLobby = LobbyManager.getLobby(lobbyCode);
                            if (!currentLobby) {
                                logger.debug(`Lobby ${lobbyCode} n'existe plus, timeout ignoré`);
                                return;
                            }

                            const playerToRemove = currentLobby.players.find(p => p.name === playerName && !p.isActive);
                            if (playerToRemove) {
                                logger.info(`Période de grâce expirée, suppression de ${playerToRemove.name}`);

                                const isLobbyRemoved = LobbyManager.removePlayer(currentLobby, playerToRemove);

                                if (isLobbyRemoved) {
                                    this.cleanupLobbyResources(lobbyCode);
                                    logger.info(`Lobby ${lobbyCode} supprimé (vide)`);
                                } else {
                                    this.io.to(lobbyCode).emit('updatePlayersList', { players: currentLobby.players });
                                }
                            }
                        }, this.RECONNECT_GRACE_PERIOD);

                        this.disconnectTimeouts.set(disconnectKey, timeout);
                    }
                });
            });

        });
    }
}
