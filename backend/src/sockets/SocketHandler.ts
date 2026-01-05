import { randomInt } from 'crypto';
import {Server, Socket} from 'socket.io';
import * as LobbyManager from '../managers/LobbyManager';
import * as GameManager from '../managers/GameManager';
import {Player} from "../models/Player";
import {Lobby} from "../models/Lobby";
import {Round} from "../models/Round";
import {Game} from "../models/Game";
import type { ServerToClientEvents, ClientToServerEvents, IGame } from '@onskone/shared';
import { GAME_CONSTANTS, RoundPhase } from '@onskone/shared';
import { validatePlayerName, validateAnswer, validateLobbyCode, validatePlayerId, validateAvatarId, sanitizeInput } from '../utils/validation.js';
import { rateLimiters } from '../utils/rateLimiter.js';
import { shuffleArray } from '../utils/helpers.js';
import logger from '../utils/logger.js';

export class SocketHandler {
    private io: Server<ClientToServerEvents, ServerToClientEvents>;
    // Map pour stocker les timeouts de déconnexion (clé: lobbyCode_playerName)
    private disconnectTimeouts: Map<string, NodeJS.Timeout> = new Map();
    // Map pour stocker les timeouts de déconnexion du pilier (clé: lobbyCode)
    private leaderDisconnectTimeouts: Map<string, NodeJS.Timeout> = new Map();
    // Set pour empêcher les reconnexions simultanées (clé: lobbyCode_playerName)
    private reconnectionLocks: Set<string> = new Set();
    // Délai de grâce pour la reconnexion (30 secondes)
    private readonly RECONNECT_GRACE_PERIOD = 30000;
    // Délai avant de sauter le round du pilier déconnecté (15 secondes - pour le changement d'app mobile)
    private readonly LEADER_DISCONNECT_DELAY = 15000;
    // Délai avant de marquer un joueur comme inactif (5 secondes - pour le changement d'app mobile)
    private readonly INACTIVE_DELAY = 5000;
    // Map pour stocker les timeouts d'inactivité (clé: lobbyCode_playerName)
    private inactiveTimeouts: Map<string, NodeJS.Timeout> = new Map();
    // Map pour stocker les joueurs kickés temporairement (clé: lobbyCode_playerName, valeur: timestamp d'expiration)
    private kickedPlayers: Map<string, number> = new Map();
    // Durée du blocage après kick (5 minutes)
    private readonly KICK_BLOCK_DURATION = 5 * 60 * 1000;

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
                guessedPlayerName: guessedPlayer?.name || 'Aucun',
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
            logger.debug(`Timeout de déconnexion du pilier annulé pour ${lobbyCode}`);
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
     * Vérifie si un joueur est bloqué (a été kické récemment)
     * Nettoie automatiquement les entrées expirées
     */
    private isPlayerKicked(lobbyCode: string, playerName: string): boolean {
        const key = this.getDisconnectKey(lobbyCode, playerName);
        const expiration = this.kickedPlayers.get(key);

        if (!expiration) return false;

        if (Date.now() > expiration) {
            // Le blocage a expiré, nettoyer l'entrée
            this.kickedPlayers.delete(key);
            return false;
        }

        return true;
    }

    /**
     * Bloque un joueur après un kick
     */
    private blockKickedPlayer(lobbyCode: string, playerName: string): void {
        const key = this.getDisconnectKey(lobbyCode, playerName);
        this.kickedPlayers.set(key, Date.now() + this.KICK_BLOCK_DURATION);
        logger.debug(`Joueur ${playerName} bloqué du lobby ${lobbyCode} pour ${this.KICK_BLOCK_DURATION / 1000}s`);
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

        // Clean up kicked players list for this lobby
        const kickedToDelete: string[] = [];
        for (const key of this.kickedPlayers.keys()) {
            if (key.startsWith(`${lobbyCode}_`)) {
                kickedToDelete.push(key);
            }
        }
        kickedToDelete.forEach(key => this.kickedPlayers.delete(key));

        // Clean up inactive timeouts for this lobby
        const inactiveToDelete: string[] = [];
        for (const [key, timeout] of this.inactiveTimeouts.entries()) {
            if (key.startsWith(`${lobbyCode}_`)) {
                clearTimeout(timeout);
                inactiveToDelete.push(key);
            }
        }
        inactiveToDelete.forEach(key => this.inactiveTimeouts.delete(key));

        if (keysToDelete.length > 0 || locksToDelete.length > 0 || kickedToDelete.length > 0 || inactiveToDelete.length > 0) {
            logger.debug(`Nettoyage lobby ${lobbyCode}: ${keysToDelete.length} disconnect timeouts, ${inactiveToDelete.length} inactive timeouts, ${locksToDelete.length} locks, ${kickedToDelete.length} kicked`);
        }
    }

    /**
     * Check if the socket is the current round's leader
     * @returns true if socket is leader, false otherwise (also emits error to socket)
     * Note: After this returns true, game and game.currentRound are guaranteed non-null
     */
    private requireLeader(
        socket: Socket<ClientToServerEvents, ServerToClientEvents>,
        game: IGame | null | undefined,
        action: string
    ): boolean {
        if (!game?.currentRound) {
            socket.emit('error', { message: 'Partie ou round introuvable' });
            return false;
        }
        if (socket.id !== game.currentRound.leader.socketId) {
            socket.emit('error', { message: `Seul le pilier peut ${action}` });
            return false;
        }
        return true;
    }

    // ===== TIMER EXPIRATION HANDLERS =====

    /**
     * Handle timer expiration for QUESTION_SELECTION phase
     * Auto-selects a random question if the leader hasn't chosen
     */
    private handleQuestionSelectionTimeout(lobbyCode: string, currentRound: Round): void {
        if (currentRound.selectedQuestion) return; // Already selected

        const proposedCard = currentRound.gameCard;
        if (!proposedCard || proposedCard.questions.length === 0) {
            logger.error('Pas de questions disponibles pour auto-sélection', { lobbyCode });
            return;
        }

        // Choose a random question from the proposed card
        const randomQuestion = proposedCard.questions[randomInt(0, proposedCard.questions.length)];

        currentRound.setSelectedQuestion(randomQuestion);
        currentRound.nextPhase();
        this.io.to(lobbyCode).emit('questionSelected', {
            question: randomQuestion,
            phase: currentRound.phase,
            auto: true
        });
        logger.info(`Question auto-sélectionnée`, { lobbyCode });
    }

    /**
     * Handle timer expiration for ANSWERING phase
     * Adds automatic "no response" answers and moves to GUESSING
     */
    private handleAnsweringTimeout(lobbyCode: string, lobby: Lobby, currentRound: Round): void {
        // Add automatic answers for players who didn't respond
        const respondingPlayers = lobby.players.filter(p => p.id !== currentRound.leader.id);
        for (const player of respondingPlayers) {
            if (!currentRound.answers[player.id]) {
                currentRound.addAnswer(player.id, `__NO_RESPONSE__${player.name} n'a pas répondu à temps`);
                logger.debug(`Réponse auto ajoutée pour ${player.name}`);
            }
        }

        // Move to GUESSING phase
        currentRound.nextPhase();
        this.io.to(lobbyCode).emit('allAnswersSubmitted', {
            phase: currentRound.phase,
            answersCount: Object.keys(currentRound.answers).length,
            forced: true
        });

        // Send shuffled answers to all players
        const answersArray = Object.entries(currentRound.answers).map(([playerId, answer]) => ({
            id: playerId,
            text: answer
        }));
        const shuffledAnswers = shuffleArray(answersArray);
        // Stocker l'ordre des réponses mélangées pour la reconnexion
        currentRound.shuffledAnswerIds = shuffledAnswers.map(a => a.id);
        this.io.to(lobbyCode).emit('shuffledAnswersReceived', {
            answers: shuffledAnswers,
            players: lobby.players.filter(p => p.id !== currentRound.leader.id),
            roundNumber: currentRound.roundNumber
        });
    }

    /**
     * Handle timer expiration for GUESSING phase
     * Validates current guesses and moves to REVEAL
     */
    private handleGuessingTimeout(lobbyCode: string, lobby: Lobby, game: Game, currentRound: Round): void {
        // Filter out unassigned guesses
        const validGuesses = Object.fromEntries(
            Object.entries(currentRound.currentGuesses).filter(([_, playerId]) => playerId !== null && playerId !== undefined)
        );
        currentRound.submitGuesses(validGuesses);
        currentRound.calculateScores();
        currentRound.nextPhase();

        const results = this.buildRevealResults(lobby, currentRound);

        this.io.to(lobbyCode).emit('revealResults', {
            phase: currentRound.phase,
            results,
            scores: currentRound.scores,
            leaderboard: game.getLeaderboard(),
            forced: true
        });
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
                    const avatarId = validateAvatarId(data.avatarId);
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

                    // Vérifier si le joueur a été kické récemment
                    if (this.isPlayerKicked(data.lobbyCode, sanitizedName)) {
                        socket.emit('error', { message: 'Vous avez été expulsé de ce salon' });
                        logger.debug(`Joueur ${sanitizedName} bloqué - a été kické du lobby ${data.lobbyCode}`);
                        return;
                    }

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

                        // Si une partie est en cours, envoyer gameStarted pour rediriger vers la page de jeu
                        if (lobby.game && lobby.game.status === 'IN_PROGRESS') {
                            const gameData = {
                                lobby: { code: lobby.code, players: lobby.players },
                                currentRound: lobby.game.currentRound,
                                status: lobby.game.status,
                                rounds: lobby.game.rounds
                            };
                            socket.emit('gameStarted', { game: gameData });
                            logger.info(`Partie en cours détectée, envoi gameStarted à ${existingPlayerBySocket.name}`);
                        }
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

                            // Si c'est le pilier du round actuel, annuler le timeout de saut de round
                            if (lobby.game?.currentRound?.leader.id === existingPlayerByName.id) {
                                this.cancelLeaderDisconnectTimeout(lobby.code);
                                lobby.game.currentRound.leader.socketId = socket.id;
                                logger.info(`Chef reconnecté via joinLobby, timeout saut annulé`);
                            }

                            socket.join(lobby.code);
                            socket.emit('joinedLobby', { player: existingPlayerByName });
                            this.io.to(lobby.code).emit('updatePlayersList', { players: lobby.players });

                            // Si une partie est en cours, envoyer gameStarted pour rediriger vers la page de jeu
                            if (lobby.game && lobby.game.status === 'IN_PROGRESS') {
                                const gameData = {
                                    lobby: { code: lobby.code, players: lobby.players },
                                    currentRound: lobby.game.currentRound,
                                    status: lobby.game.status,
                                    rounds: lobby.game.rounds
                                };
                                socket.emit('gameStarted', { game: gameData });
                                logger.info(`Partie en cours détectée, envoi gameStarted à ${existingPlayerByName.name}`);
                            }
                        } finally {
                            // Relâcher le lock
                            this.reconnectionLocks.delete(lockKey);
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
                try {
                    // Rate limiting
                    if (!rateLimiters.kickPlayer.isAllowed(socket.id)) {
                        socket.emit('error', { message: 'Trop de requêtes. Veuillez patienter.' });
                        return;
                    }

                    // Validate lobbyCode
                    const codeValidation = validateLobbyCode(lobbyCode);
                    if (!codeValidation.isValid) {
                        socket.emit('error', { message: codeValidation.error || 'Code invalide' });
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

                    // Sauvegarder les infos avant suppression
                    const kickedSocketId = kickedPlayer.socketId;
                    const kickedPlayerName = kickedPlayer.name;

                    // Annuler tous les timeouts associés au joueur
                    this.cancelDisconnectTimeout(lobbyCode, kickedPlayerName);
                    this.cancelInactiveTimeout(lobbyCode, kickedPlayerName);

                    // Bloquer le joueur pour empêcher la reconnexion immédiate
                    this.blockKickedPlayer(lobbyCode, kickedPlayerName);

                    // Retirer le joueur du lobby
                    lobby.removePlayer(kickedPlayer);

                    // Notifier le joueur kické AVANT de le retirer de la room
                    this.io.to(kickedSocketId).emit('kickedFromLobby');

                    // Retirer le socket de la room Socket.IO
                    const kickedSocket = this.io.sockets.sockets.get(kickedSocketId);
                    if (kickedSocket) {
                        kickedSocket.leave(lobbyCode);
                        logger.debug(`Socket ${kickedSocketId} retiré de la room ${lobbyCode}`);
                    }

                    // Mettre à jour la liste des joueurs pour les autres
                    this.io.to(lobbyCode).emit('updatePlayersList', { players: lobby.players });

                    logger.info(`Player ${kickedPlayerName} expulsé du lobby ${lobbyCode}`);
                } catch (error) {
                    logger.error('Error kicking player', { error: (error as Error).message });
                    socket.emit('error', { message: 'Erreur lors de l\'expulsion du joueur' });
                }
            });       
            
            // Promote Player to Host
            socket.on('promotePlayer', ({ lobbyCode, playerId }) => {
                try {
                    // Rate limiting
                    if (!rateLimiters.gameAction.isAllowed(socket.id)) {
                        socket.emit('error', { message: 'Trop de requêtes. Veuillez patienter.' });
                        return;
                    }

                    // Validate lobbyCode
                    const codeValidation = validateLobbyCode(lobbyCode);
                    if (!codeValidation.isValid) {
                        socket.emit('error', { message: codeValidation.error || 'Code invalide' });
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
                    if (!this.requireLeader(socket, game, 'demander des questions')) return;
                    // After requireLeader, game and game.currentRound are guaranteed non-null
                    const currentRound = game!.currentRound!;

                    // Si c'est une relance explicite (isRelance: true), vérifier la limite et incrémenter
                    if (data.isRelance === true) {
                        const currentRelances = currentRound.relancesUsed || 0;
                        if (currentRelances >= GAME_CONSTANTS.DEFAULT_CARD_RELANCES) {
                            socket.emit('error', { message: `Nombre maximum de relances atteint (${GAME_CONSTANTS.DEFAULT_CARD_RELANCES})` });
                            return;
                        }
                        currentRound.relancesUsed = currentRelances + 1;
                    }

                    // Si une carte existe déjà et ce n'est pas une relance, c'est une reconnexion → renvoyer la carte existante
                    if (currentRound.gameCard?.questions?.length > 0 && data.isRelance !== true) {
                        socket.emit('questionsReceived', { questions: [currentRound.gameCard] });
                        logger.debug(`Carte existante renvoyée au leader (reconnexion)`, { lobbyCode: data.lobbyCode });
                        return;
                    }

                    // Envoyer le nombre de cartes demandé (par défaut 1, max 10)
                    const rawCount = typeof data.count === 'number' ? data.count : 1;
                    const count = Math.max(1, Math.min(10, Math.floor(rawCount)));

                    // Exclure les cartes déjà montrées pour éviter les doublons lors des relances
                    const excludeCards = currentRound.shownGameCards || [];
                    const questions = GameManager.getRandomQuestions(count, excludeCards);

                    // Stocker la première carte dans le Round pour l'auto-sélection
                    // et l'ajouter aux cartes déjà montrées
                    if (questions.length > 0) {
                        currentRound.gameCard = questions[0];
                        // Ajouter toutes les nouvelles cartes aux cartes déjà montrées
                        if (!currentRound.shownGameCards) {
                            currentRound.shownGameCards = [];
                        }
                        currentRound.shownGameCards.push(...questions);
                    }

                    socket.emit('questionsReceived', { questions });
                    logger.debug(`${count} carte(s) envoyée(s) au leader (${excludeCards.length} exclues)`, { lobbyCode: data.lobbyCode });
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
                    if (!this.requireLeader(socket, game, 'sélectionner une question')) return;
                    const currentRound = game!.currentRound!;

                    // Valider que la question sélectionnée est bien une des questions proposées
                    const validQuestion = typeof data.selectedQuestion === 'string'
                        && data.selectedQuestion.length > 0
                        && data.selectedQuestion.length <= 500;

                    if (!validQuestion) {
                        socket.emit('error', {message: 'Question invalide'});
                        return;
                    }

                    // Vérifier que la question fait partie des questions de la carte proposée
                    const gameCard = currentRound.gameCard;
                    if (gameCard && gameCard.questions && !gameCard.questions.includes(data.selectedQuestion)) {
                        logger.warn(`Question non autorisée sélectionnée`, { lobbyCode: data.lobbyCode, question: data.selectedQuestion });
                        socket.emit('error', {message: 'Cette question n\'est pas disponible'});
                        return;
                    }

                    // Enregistrer la question sélectionnée et passer à la phase suivante
                    currentRound.setSelectedQuestion(data.selectedQuestion);
                    currentRound.nextPhase(); // Passe à ANSWERING

                    // Broadcast la question à tous les joueurs
                    this.io.to(data.lobbyCode).emit('questionSelected', {
                        question: data.selectedQuestion,
                        phase: currentRound.phase
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
                        socket.emit('error', {message: 'Seul le pilier peut passer au round suivant'});
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
                                        // Annuler le timeout de saut de round si le pilier se reconnecte
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
                        revealResults?: Array<{
                            playerId: string;
                            playerName: string;
                            playerAvatarId: number;
                            answer: string;
                            guessedPlayerId: string;
                            guessedPlayerName: string;
                            guessedPlayerAvatarId: number;
                            correct: boolean;
                        }>;
                        revealedIndices?: number[];
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

                    // Restaurer les résultats pour la phase REVEAL
                    if (game.currentRound && game.currentRound.phase === RoundPhase.REVEAL) {
                        reconnectionData.revealResults = this.buildRevealResults(lobby, game.currentRound);
                        reconnectionData.revealedIndices = game.currentRound.revealedIndices || [];
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
                    // Rate limiting avec multiple keys (socket.id + lobbyCode_playerId pour éviter bypass sur reconnexion)
                    const rateLimitKeys = [socket.id];
                    if (data.lobbyCode && data.playerId) {
                        rateLimitKeys.push(`${data.lobbyCode}_${data.playerId}_submitAnswer`);
                    }
                    if (!rateLimiters.submitAnswer.isAllowedMultiple(rateLimitKeys)) {
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

                    // Vérifier que le joueur n'est pas le pilier (le pilier ne répond pas)
                    if (player.id === game.currentRound.leader.id) {
                        socket.emit('error', {message: 'Le pilier ne peut pas soumettre de réponse'});
                        return;
                    }

                    // Ajouter la réponse
                    game.currentRound.addAnswer(data.playerId, sanitizedAnswer);

                    // Joueurs actifs qui doivent répondre (tous sauf le pilier)
                    const respondingPlayers = lobby.players.filter(p => p.isActive && p.id !== game.currentRound!.leader.id);

                    // Notifier tous les joueurs qu'une réponse a été soumise
                    this.io.to(data.lobbyCode).emit('playerAnswered', {
                        playerId: data.playerId,
                        totalAnswers: Object.keys(game.currentRound.answers).length,
                        expectedAnswers: respondingPlayers.length
                    });

                    logger.debug(`Réponse soumise par ${player.name}`, { lobbyCode: data.lobbyCode, answers: Object.keys(game.currentRound.answers).length });

                    // Vérifier si tous les joueurs ACTIFS (sauf le pilier) ont répondu
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
                        // Stocker l'ordre des réponses mélangées pour la reconnexion
                        game.currentRound.shuffledAnswerIds = shuffledAnswers.map(a => a.id);
                        this.io.to(data.lobbyCode).emit('shuffledAnswersReceived', {
                            answers: shuffledAnswers,
                            players: lobby.players.filter(p => p.id !== game.currentRound!.leader.id),
                            roundNumber: game.currentRound.roundNumber
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

                    let orderedAnswers: { id: string; text: string }[];

                    // Utiliser l'ordre stocké si disponible (reconnexion), sinon mélanger
                    if (game.currentRound.shuffledAnswerIds && game.currentRound.shuffledAnswerIds.length > 0) {
                        // Reconstruire les réponses dans l'ordre stocké
                        const answersMap = new Map(answersArray.map(a => [a.id, a]));
                        orderedAnswers = game.currentRound.shuffledAnswerIds
                            .map(id => answersMap.get(id))
                            .filter((a): a is { id: string; text: string } => a !== undefined);
                    } else {
                        // Premier appel - mélanger et stocker l'ordre
                        orderedAnswers = shuffleArray(answersArray);
                        game.currentRound.shuffledAnswerIds = orderedAnswers.map(a => a.id);
                    }

                    // Envoyer les réponses au joueur qui les demande uniquement
                    socket.emit('shuffledAnswersReceived', {
                        answers: orderedAnswers,
                        players: lobby.players.filter(p => p.id !== game.currentRound!.leader.id),
                        roundNumber: game.currentRound.roundNumber
                    });
                } catch (error) {
                    logger.error('Error requesting shuffled answers', { error: (error as Error).message });
                    socket.emit('error', {message: (error as Error).message});
                }
            });

            // Update Guess (Chef déplace une réponse - BROADCAST en temps réel)
            socket.on('updateGuess', (data) => {
                try {
                    // Rate limiting avec multiple keys (socket.id + lobbyCode pour éviter bypass sur reconnexion)
                    const rateLimitKeys = [socket.id];
                    if (data.lobbyCode) {
                        rateLimitKeys.push(`${data.lobbyCode}_leader_updateGuess`);
                    }
                    if (!rateLimiters.updateGuess.isAllowedMultiple(rateLimitKeys)) {
                        socket.emit('error', { message: 'Trop de requêtes. Veuillez patienter.' });
                        return;
                    }

                    const lobby = LobbyManager.getLobby(data.lobbyCode);
                    const game = lobby?.game;
                    if (!this.requireLeader(socket, game, 'modifier les attributions')) return;
                    const currentRound = game!.currentRound!;

                    // Mettre à jour l'état intermédiaire du drag & drop
                    currentRound.updateCurrentGuess(data.answerId, data.playerId);

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
                    // Rate limiting avec multiple keys (socket.id + lobbyCode pour éviter bypass sur reconnexion)
                    const rateLimitKeys = [socket.id];
                    if (data.lobbyCode) {
                        rateLimitKeys.push(`${data.lobbyCode}_leader_submitGuesses`);
                    }
                    if (!rateLimiters.submitGuesses.isAllowedMultiple(rateLimitKeys)) {
                        socket.emit('error', { message: 'Trop de requêtes. Veuillez patienter.' });
                        return;
                    }

                    const lobby = LobbyManager.getLobby(data.lobbyCode);
                    const game = lobby?.game;
                    if (!this.requireLeader(socket, game, 'valider les attributions')) return;
                    if (!lobby) return; // Type narrowing for lobby
                    const currentRound = game!.currentRound!;

                    // Valider et filtrer les guesses
                    const answerIds = Object.keys(currentRound.answers);
                    const playerIds = lobby.players
                        .filter(p => p.id !== currentRound.leader.id)
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

                        // Vérifier que le playerId deviné est un joueur valide (pas le pilier)
                        if (!playerIds.includes(guessedPlayerId as string)) {
                            logger.warn(`Guess invalide: playerId ${guessedPlayerId} inexistant ou est le pilier`);
                            continue;
                        }

                        validGuesses[answerId] = guessedPlayerId as string;
                    }

                    // Enregistrer les attributions finales et calculer les scores
                    currentRound.submitGuesses(validGuesses);
                    currentRound.calculateScores();

                    // Passer à la phase REVEAL
                    currentRound.nextPhase();

                    // Créer les résultats détaillés
                    const results = this.buildRevealResults(lobby, currentRound);

                    // Broadcast les résultats à tous
                    this.io.to(data.lobbyCode).emit('revealResults', {
                        phase: currentRound.phase,
                        results,
                        scores: currentRound.scores,
                        leaderboard: game!.getLeaderboard()
                    });

                    logger.info(`Attributions validées`, { lobbyCode: data.lobbyCode, leaderScore: currentRound.scores[currentRound.leader.id] || 0 });
                } catch (error) {
                    logger.error('Error submitting guesses', { error: (error as Error).message });
                    socket.emit('error', {message: (error as Error).message});
                }
            });

            // Reveal Answer (Chef révèle une réponse spécifique)
            socket.on('revealAnswer', (data: { lobbyCode: string; answerIndex: number }) => {
                try {
                    // Rate limiting
                    if (!rateLimiters.revealAnswer.isAllowed(socket.id)) {
                        socket.emit('error', { message: 'Trop de requêtes. Veuillez patienter.' });
                        return;
                    }

                    const lobby = LobbyManager.getLobby(data.lobbyCode);
                    const game = lobby?.game;
                    if (!this.requireLeader(socket, game, 'révéler les réponses')) return;
                    const currentRound = game!.currentRound!;

                    // Initialiser le Set des indices révélés si nécessaire
                    if (!currentRound.revealedIndices) {
                        currentRound.revealedIndices = [];
                    }

                    // Vérifier que l'index n'a pas déjà été révélé
                    if (currentRound.revealedIndices.includes(data.answerIndex)) {
                        return; // Déjà révélé, ignorer silencieusement
                    }

                    // Ajouter l'index aux révélations
                    currentRound.revealedIndices.push(data.answerIndex);

                    // Broadcaster à tous les joueurs
                    this.io.to(data.lobbyCode).emit('answerRevealed', {
                        revealedIndex: data.answerIndex,
                        revealedIndices: currentRound.revealedIndices
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
                    if (!this.requireLeader(socket, game, 'démarrer le timer')) return;
                    const currentRound = game!.currentRound!;

                    // Vérifier si un timer est déjà en cours pour CETTE phase (évite reset sur refresh)
                    // Chaque phase a son propre timer, on vérifie aussi la phase
                    const requestedPhase = currentRound.phase;
                    if (currentRound.timerStartedAt && currentRound.timerEnd && currentRound.timerDuration && currentRound.timerPhase === requestedPhase) {
                        const now = Date.now();
                        const timerEndTime = currentRound.timerEnd.getTime();
                        if (now < timerEndTime) {
                            // Timer encore actif pour cette phase - ne pas le reset, juste renvoyer l'état actuel au client
                            logger.debug(`Timer déjà actif pour phase ${requestedPhase}, pas de reset`, { lobbyCode: data.lobbyCode, phase: requestedPhase });
                            socket.emit('timerStarted', {
                                phase: currentRound.phase,
                                duration: currentRound.timerDuration,
                                startedAt: currentRound.timerStartedAt
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
                    currentRound.timerEnd = timerEnd;
                    currentRound.timerStartedAt = startedAt;
                    currentRound.timerDuration = timerDuration;
                    currentRound.timerPhase = currentRound.phase; // Pour éviter les conflits entre phases

                    // Broadcaster le démarrage du timer à tous
                    this.io.to(data.lobbyCode).emit('timerStarted', {
                        phase: currentRound.phase,
                        duration: timerDuration,
                        startedAt: startedAt
                    });
                    logger.debug(`Timer démarré: ${timerDuration}s`, { lobbyCode: data.lobbyCode, phase: currentRound.phase });
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
                    if (!this.requireLeader(socket, game, 'signaler l\'expiration du timer')) return;
                    const currentRound = game!.currentRound!;

                    const currentPhase = currentRound.phase;

                    // Protection contre les doubles appels de timer pour la même phase
                    // Note: Cette vérification est thread-safe car Node.js est single-threaded
                    if (currentRound.timerProcessedForPhase === currentPhase) {
                        logger.debug(`Timer déjà traité pour phase ${currentPhase}, ignoré`);
                        return;
                    }

                    // Marquer immédiatement comme traité pour bloquer tout appel concurrent
                    // (même si Node.js est single-threaded, c'est une bonne pratique défensive)
                    currentRound.timerProcessedForPhase = currentPhase;

                    logger.info(`Timer expiré`, { lobbyCode: data.lobbyCode, phase: currentPhase });
                    if (!lobby) return; // Type narrowing for lobby

                    // Handle timer expiration based on current phase
                    switch (currentPhase) {
                        case 'QUESTION_SELECTION':
                            this.handleQuestionSelectionTimeout(data.lobbyCode, currentRound as Round);
                            break;
                        case 'ANSWERING':
                            this.handleAnsweringTimeout(data.lobbyCode, lobby, currentRound as Round);
                            break;
                        case 'GUESSING':
                            this.handleGuessingTimeout(data.lobbyCode, lobby, game as Game, currentRound as Round);
                            break;
                        case 'REVEAL':
                            // Nothing to do, wait for leader to start next round
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

                            // CAS 1: Le joueur déconnecté est le pilier actuel
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
                                        logger.debug(`Lobby/jeu n'existe plus, timeout pilier ignoré`);
                                        return;
                                    }

                                    // Vérifier que c'est toujours le même round et le même pilier
                                    if (currentGame.currentRound.leader.id !== leaderId) {
                                        logger.debug(`Chef a changé, timeout ignoré`);
                                        return;
                                    }

                                    // Vérifier que le pilier est toujours inactif (n'a pas reconnecté)
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

                                    // Vérifier s'il reste des joueurs éligibles pour être pilier
                                    const activePlayers = currentLobby.players.filter(p => p.isActive);
                                    const previousLeaderIds = new Set(currentGame.rounds.map(r => r.leader.id));
                                    const eligibleLeaders = activePlayers.filter(p => !previousLeaderIds.has(p.id));

                                    // Si pas assez de joueurs OU pas de pilier éligible → terminer la partie
                                    if (activePlayers.length < 2 || eligibleLeaders.length === 0) {
                                        currentGame.end();
                                        currentLobby.players.forEach(p => p.isActive = false);
                                        this.io.to(lobbyCode).emit('gameEnded', {
                                            leaderboard: currentGame.getLeaderboard(),
                                            rounds: currentGame.rounds
                                        });
                                        logger.game.ended(lobbyCode);
                                    } else {
                                        // Démarrer le round suivant avec un nouveau pilier
                                        try {
                                            currentGame.nextRound();
                                            this.io.to(lobbyCode).emit('roundStarted', {
                                                round: currentGame.currentRound!
                                            });
                                            logger.info(`Nouveau round démarré après déconnexion du pilier`, {
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
