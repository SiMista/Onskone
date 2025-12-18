import {Server, Socket} from 'socket.io';
import * as LobbyManager from '../managers/LobbyManager';
import * as GameManager from '../managers/GameManager';
import {Player} from "../models/Player";
import type { ServerToClientEvents, ClientToServerEvents } from '@onskone/shared';
import { GAME_CONSTANTS } from '@onskone/shared';
import { validatePlayerName, validateAnswer, validateLobbyCode, sanitizeInput } from '../utils/validation.js';
import { rateLimiters } from '../utils/rateLimiter.js';
import logger from '../utils/logger.js';

export class SocketHandler {
    private io: Server<ClientToServerEvents, ServerToClientEvents>;
    // Map pour stocker les timeouts de déconnexion (clé: lobbyCode_playerName)
    private disconnectTimeouts: Map<string, NodeJS.Timeout> = new Map();
    // Délai de grâce pour la reconnexion (30 secondes)
    private readonly RECONNECT_GRACE_PERIOD = 30000;

    constructor(io: Server<ClientToServerEvents, ServerToClientEvents>) {
        this.io = io;
        this.setupSocketEvents();
    }

    private getDisconnectKey(lobbyCode: string, playerName: string): string {
        return `${lobbyCode}_${playerName}`;
    }

    /**
     * Build reveal results from the current round's answers and guesses
     */
    private buildRevealResults(lobby: ReturnType<typeof LobbyManager.getLobby>, round: NonNullable<ReturnType<typeof LobbyManager.getLobby>>['game']['currentRound']): Array<{
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
                answer,
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
                        socket.emit('error', { message: 'Lobby not found' });
                        return;
                    }

                    // Update lobby activity
                    lobby.updateActivity();

                    // Vérifie si le joueur avec ce socket.id est déjà dans le lobby
                    const existingPlayerBySocket = lobby.players.find(p => p.socketId === socket.id);
                    if (existingPlayerBySocket) {
                        logger.debug(`Player ${existingPlayerBySocket.name} déjà dans le lobby ${lobby.code}`);
                        // Annuler le timeout de déconnexion s'il existe
                        this.cancelDisconnectTimeout(lobby.code, existingPlayerBySocket.name);
                        existingPlayerBySocket.isActive = true; // Marquer comme actif (rejouer)
                        socket.join(lobby.code);
                        socket.emit('joinedLobby', { player: existingPlayerBySocket });
                        this.io.to(lobby.code).emit('updatePlayersList', { players: lobby.players });
                        return;
                    }

                    // Vérifie si un joueur avec ce nom existe déjà (reconnexion après refresh)
                    const existingPlayerByName = lobby.players.find(p => p.name === sanitizedName);
                    if (existingPlayerByName) {
                        // C'est une reconnexion - mettre à jour le socketId
                        logger.info(`Player ${sanitizedName} reconnecte au lobby ${lobby.code}`);
                        // Annuler le timeout de déconnexion s'il existe
                        this.cancelDisconnectTimeout(lobby.code, sanitizedName);
                        existingPlayerByName.socketId = socket.id;
                        existingPlayerByName.isActive = true; // Marquer comme actif (rejouer)

                        socket.join(lobby.code);
                        socket.emit('joinedLobby', { player: existingPlayerByName });
                        this.io.to(lobby.code).emit('updatePlayersList', { players: lobby.players });
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
                    // Validate player name
                    const nameValidation = validatePlayerName(data.playerName);
                    if (!nameValidation.isValid) {
                        socket.emit('error', { message: nameValidation.error || 'Nom invalide' });
                        return;
                    }

                    const sanitizedName = sanitizeInput(data.playerName);
                    const lobby = LobbyManager.getLobby(data.lobbyCode);
                    if (!lobby) {
                        socket.emit('error', {message: 'Lobby not found'});
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
                    const lobby = LobbyManager.getLobby(data.lobbyCode);
                    if (!lobby) {
                        socket.emit('error', {message: 'Lobby not found'});
                        return;
                    }
                    logger.debug('leaveLobby', { playerId: data.currentPlayerId, lobbyCode: data.lobbyCode });
                    const player = lobby.getPlayer(data.currentPlayerId);
                    if (!player) {
                        socket.emit('error', {message: 'Player not found'});
                        return;
                    }
                    const isLobbyRemoved = LobbyManager.removePlayer(lobby, player);
                    this.io.to(lobby.code).emit('updatePlayersList', {players: lobby.players});
                    logger.info(`${player.name} a quitté le lobby ${lobby.code}`);
                    if (isLobbyRemoved) {
                        socket.leave(lobby.code);
                        logger.info(`Lobby ${lobby.code} supprimé`);
                    }

                } catch (error) {
                    logger.error('Error leaving lobby', { error: (error as Error).message });
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

                // Vérifier que c'est l'hôte qui fait la demande
                const host = lobby.players.find(p => p.isHost);
                if (!host || host.socketId !== socket.id) {
                    socket.emit('error', { message: 'Only the host can kick players' });
                    return;
                }

                const kickedPlayer = lobby.getPlayer(playerId);
                if (!kickedPlayer) {
                    socket.emit('error', { message: 'Player not found' });
                    return;
                }

                // L'hôte ne peut pas se kick lui-même
                if (kickedPlayer.isHost) {
                    socket.emit('error', { message: 'Cannot kick the host' });
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
                const lobby = LobbyManager.getLobby(lobbyCode);
                if (!lobby) {
                    socket.emit('error', { message: 'Lobby not found' });
                    return;
                }

                // Vérifier que c'est l'hôte actuel qui fait la demande
                const currentHost = lobby.players.find(p => p.isHost);
                if (!currentHost || currentHost.socketId !== socket.id) {
                    socket.emit('error', { message: 'Only the host can promote players' });
                    return;
                }

                const playerToPromote = lobby.getPlayer(playerId);
                if (!playerToPromote) {
                    socket.emit('error', { message: 'Player not found' });
                    return;
                }

                // Ne peut pas se promouvoir soi-même (déjà hôte)
                if (playerToPromote.isHost) {
                    socket.emit('error', { message: 'Player is already the host' });
                    return;
                }

                // Promote player to host
                lobby.setHost(playerToPromote);
                this.io.to(lobbyCode).emit('updatePlayersList', { players: lobby.players });
                logger.info(`Player ${playerToPromote.name} promu hôte dans ${lobbyCode}`);
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
                        socket.emit('error', {message: 'Lobby not found'});
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
                    const lobby = LobbyManager.getLobby(data.lobbyCode);
                    const game = lobby?.game;
                    if (!game || !game.currentRound) {
                        socket.emit('error', {message: 'Game or round not found'});
                        return;
                    }

                    // Vérifier que c'est bien le chef qui demande
                    if (socket.id !== game.currentRound.leader.socketId) {
                        socket.emit('error', {message: 'Only the leader can request questions'});
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
                    const lobby = LobbyManager.getLobby(data.lobbyCode);
                    const game = lobby?.game;
                    if (!game || !game.currentRound) {
                        socket.emit('error', {message: 'Game or round not found'});
                        return;
                    }

                    // Vérifier que c'est bien le chef qui sélectionne
                    if (socket.id !== game.currentRound.leader.socketId) {
                        socket.emit('error', {message: 'Only the leader can select a question'});
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
                    const lobby = LobbyManager.getLobby(data.lobbyCode);
                    const game = lobby?.game;
                    if (!game) {
                        socket.emit('error', {message: 'Game not found'});
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
                    const lobby = LobbyManager.getLobby(data.lobbyCode);
                    const game = lobby?.game;
                    if (!game) {
                        socket.emit('error', {message: 'Game not found'});
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
                    const lobby = LobbyManager.getLobby(data.lobbyCode);
                    const game = lobby?.game;
                    if (!game) {
                        socket.emit('error', {message: 'Game not found'});
                        return;
                    }

                    // Reconnexion: mettre à jour le socketId du joueur
                    if (data.playerId) {
                        const player = lobby.players.find(p => p.id === data.playerId);
                        if (player) {
                            const oldSocketId = player.socketId;
                            player.socketId = socket.id;
                            player.isActive = true;
                            socket.join(lobby.code);
                            logger.info(`Player ${player.name} reconnected to game`, {
                                lobbyCode: data.lobbyCode,
                                oldSocketId,
                                newSocketId: socket.id
                            });

                            // Si c'est le leader du round actuel, mettre à jour son socketId
                            if (game.currentRound && game.currentRound.leader.id === data.playerId) {
                                game.currentRound.leader.socketId = socket.id;
                                logger.info(`Leader socketId updated for round ${game.currentRound.roundNumber}`);
                            }

                            // Notifier les autres joueurs
                            this.io.to(lobby.code).emit('updatePlayersList', { players: lobby.players });
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
                        socket.emit('error', {message: 'Game not found'});
                        return;
                    }

                    // Update lobby activity
                    lobby?.updateActivity();
                    if (!game.currentRound) {
                        socket.emit('error', {message: 'Round not found'});
                        return;
                    }
                    const player = lobby.getPlayer(data.playerId);
                    if (!player) {
                        socket.emit('error', {message: 'Player not found'});
                        return;
                    }

                    // Vérifier que le joueur n'est pas le chef (le chef ne répond pas)
                    if (player.id === game.currentRound.leader.id) {
                        socket.emit('error', {message: 'The leader cannot submit an answer'});
                        return;
                    }

                    // Ajouter la réponse
                    game.currentRound.addAnswer(data.playerId, sanitizedAnswer);

                    // Notifier tous les joueurs qu'une réponse a été soumise
                    this.io.to(data.lobbyCode).emit('playerAnswered', {
                        playerId: data.playerId,
                        totalAnswers: Object.keys(game.currentRound.answers).length,
                        expectedAnswers: lobby.players.length - 1 // Tous sauf le chef
                    });

                    logger.debug(`Réponse soumise par ${player.name}`, { lobbyCode: data.lobbyCode, answers: Object.keys(game.currentRound.answers).length });

                    // Vérifier si tous les joueurs (sauf le chef) ont répondu
                    const expectedAnswers = lobby.players.length - 1;
                    const actualAnswers = Object.keys(game.currentRound.answers).length;

                    if (actualAnswers >= expectedAnswers) {
                        // Tous les joueurs ont répondu, passer à la phase GUESSING
                        game.currentRound.nextPhase();
                        this.io.to(data.lobbyCode).emit('allAnswersSubmitted', {
                            phase: game.currentRound.phase,
                            answersCount: actualAnswers
                        });

                        // Automatiquement envoyer les réponses mélangées à tous les joueurs
                        const answersArray = Object.entries(game.currentRound.answers).map(([playerId, answer]) => ({
                            id: playerId,
                            text: answer
                        }));
                        const shuffledAnswers = answersArray.sort(() => Math.random() - 0.5);
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
                    const lobby = LobbyManager.getLobby(data.lobbyCode);
                    const game = lobby?.game;
                    if (!game || !game.currentRound) {
                        socket.emit('error', {message: 'Game or round not found'});
                        return;
                    }

                    // Créer un tableau de réponses avec leurs IDs (playerId)
                    const answersArray = Object.entries(game.currentRound.answers).map(([playerId, answer]) => ({
                        id: playerId,
                        text: answer
                    }));

                    // Mélanger les réponses (shuffle)
                    const shuffledAnswers = answersArray.sort(() => Math.random() - 0.5);

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
                    const lobby = LobbyManager.getLobby(data.lobbyCode);
                    const game = lobby?.game;
                    if (!game || !game.currentRound) {
                        socket.emit('error', {message: 'Game or round not found'});
                        return;
                    }

                    // Vérifier que c'est bien le chef qui déplace
                    if (socket.id !== game.currentRound.leader.socketId) {
                        socket.emit('error', {message: 'Only the leader can update guesses'});
                        return;
                    }

                    // Mettre à jour l'état intermédiaire du drag & drop
                    game.currentRound.updateCurrentGuess(data.answerId, data.playerId);

                    // BROADCASTER à TOUS les joueurs en temps réel (y compris le chef)
                    this.io.to(data.lobbyCode).emit('guessUpdated', {
                        answerId: data.answerId,
                        playerId: data.playerId,
                        currentGuesses: game.currentRound.currentGuesses
                    });
                } catch (error) {
                    logger.error('Error updating guess', { error: (error as Error).message });
                    socket.emit('error', {message: (error as Error).message});
                }
            });

            // Submit Guesses (Chef valide ses choix finaux)
            socket.on('submitGuesses', (data) => {
                try {
                    const lobby = LobbyManager.getLobby(data.lobbyCode);
                    const game = lobby?.game;
                    if (!game || !game.currentRound) {
                        socket.emit('error', {message: 'Game or round not found'});
                        return;
                    }

                    // Vérifier que c'est bien le chef qui valide
                    if (socket.id !== game.currentRound.leader.socketId) {
                        socket.emit('error', {message: 'Only the leader can submit guesses'});
                        return;
                    }

                    // Filtrer les guesses non assignés (null ou undefined)
                    const validGuesses = Object.fromEntries(
                        Object.entries(data.guesses).filter(([_, playerId]) => playerId !== null && playerId !== undefined)
                    );

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
                    const lobby = LobbyManager.getLobby(data.lobbyCode);
                    const game = lobby?.game;
                    if (!game || !game.currentRound) {
                        socket.emit('error', {message: 'Game or round not found'});
                        return;
                    }

                    // Vérifier que c'est bien le chef qui révèle
                    if (socket.id !== game.currentRound.leader.socketId) {
                        socket.emit('error', {message: 'Only the leader can reveal answers'});
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
                    const lobby = LobbyManager.getLobby(data.lobbyCode);
                    const game = lobby?.game;
                    if (!game || !game.currentRound) {
                        socket.emit('error', {message: 'Game or round not found'});
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
                    const lobby = LobbyManager.getLobby(data.lobbyCode);
                    const game = lobby?.game;
                    if (!game || !game.currentRound) {
                        socket.emit('error', {message: 'Game or round not found'});
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
                                const randomQuestion = proposedCard.questions[Math.floor(Math.random() * proposedCard.questions.length)];

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
                            const shuffledAnswers = answersArray.sort(() => Math.random() - 0.5);
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

                        // Marquer le joueur comme inactif (au lieu de le supprimer immédiatement)
                        disconnectedPlayer.isActive = false;

                        // Notifier les autres joueurs
                        this.io.to(lobby.code).emit('updatePlayersList', { players: lobby.players });

                        // Créer un timeout pour supprimer le joueur après le délai de grâce
                        const key = this.getDisconnectKey(lobby.code, disconnectedPlayer.name);

                        // Annuler un éventuel timeout existant
                        this.cancelDisconnectTimeout(lobby.code, disconnectedPlayer.name);

                        const timeout = setTimeout(() => {
                            // Vérifier si le joueur est toujours inactif
                            const currentLobby = LobbyManager.getLobby(lobby.code);
                            if (!currentLobby) return;

                            const playerToRemove = currentLobby.players.find(p => p.name === disconnectedPlayer.name && !p.isActive);
                            if (playerToRemove) {
                                logger.info(`Période de grâce expirée, suppression de ${playerToRemove.name}`);

                                const isLobbyRemoved = LobbyManager.removePlayer(currentLobby, playerToRemove);

                                if (isLobbyRemoved) {
                                    logger.info(`Lobby ${lobby.code} supprimé (vide)`);
                                } else {
                                    this.io.to(lobby.code).emit('updatePlayersList', { players: currentLobby.players });
                                }
                            }

                            this.disconnectTimeouts.delete(key);
                        }, this.RECONNECT_GRACE_PERIOD);

                        this.disconnectTimeouts.set(key, timeout);
                    }
                });
            });

        });
    }
}
