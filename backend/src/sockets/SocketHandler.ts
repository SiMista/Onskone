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
                    const existingPlayerBySocket = lobby.players.find(p => p.socketId === socket.id);
                    if (existingPlayerBySocket) {
                        console.log(`Player ${existingPlayerBySocket.name} est déjà dans le lobby ${lobby.code} avec le même socket.`);
                        socket.join(lobby.code);
                        socket.emit('joinedLobby', { player: existingPlayerBySocket });
                        this.io.to(lobby.code).emit('updatePlayersList', { players: lobby.players });
                        return;
                    }

                    // Vérifie si un joueur avec ce nom existe déjà (reconnexion après refresh)
                    const existingPlayerByName = lobby.players.find(p => p.name === data.playerName);
                    if (existingPlayerByName) {
                        // C'est une reconnexion - mettre à jour le socketId
                        console.log(`Player ${data.playerName} reconnecte au lobby ${lobby.code}. Mise à jour du socket ID.`);
                        existingPlayerByName.socketId = socket.id;

                        socket.join(lobby.code);
                        socket.emit('joinedLobby', { player: existingPlayerByName });
                        this.io.to(lobby.code).emit('updatePlayersList', { players: lobby.players });
                        console.log(`${data.playerName} s'est reconnecté au lobby ${lobby.code} (${lobby.players.length} joueurs)`);
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
                const kickedPlayer = lobby.getPlayer(playerId);
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
                const playerToPromote = lobby.getPlayer(playerId);
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
                    lobby.game = game; // Assigner le jeu au lobby

                    // Démarrer le premier round automatiquement
                    game.nextRound();

                    // Créer un objet sérialisable sans référence circulaire
                    const gameData = {
                        currentRound: game.currentRound,
                        status: game.status,
                        rounds: game.rounds
                    };

                    // Envoyer les événements aux clients
                    this.io.to(data.lobbyCode).emit('gameStarted', {game: gameData});
                    this.io.to(data.lobbyCode).emit('roundStarted', {round: game.currentRound});
                    console.log(`Game started in lobby ${data.lobbyCode} - Round 1 started with leader: ${game.currentRound?.leader.name}`);
                } catch (error) {
                    console.error('Error starting game:', error);
                    socket.emit('error', {message: (error as Error).message});
                }
            });

            // Request Questions (Chef demande 3 questions)
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

                    // Envoyer 3 GameCards aléatoires au chef (incluant celui déjà assigné)
                    const questions = GameManager.getRandomQuestions(3);
                    socket.emit('questionsReceived', {questions});
                    console.log(`Questions sent to leader in lobby ${data.lobbyCode}`);
                } catch (error) {
                    console.error('Error requesting questions:', error);
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
                    console.log(`Question selected in lobby ${data.lobbyCode}: ${data.selectedQuestion}`);
                } catch (error) {
                    console.error('Error selecting question:', error);
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
                        this.io.to(data.lobbyCode).emit('gameEnded', {
                            leaderboard: game.getLeaderboard(),
                            rounds: game.rounds
                        });
                        console.log(`Game ended in lobby ${data.lobbyCode}`);
                        return;
                    }

                    // Sinon, passer au round suivant
                    game.nextRound();
                    this.io.to(data.lobbyCode).emit('roundStarted', {round: game.currentRound});
                    console.log(`Round ${game.currentRound?.roundNumber} started in lobby ${data.lobbyCode}`);
                } catch (error) {
                    console.error('Error starting next round:', error);
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
                    console.error('Error getting game results:', error);
                    socket.emit('error', {message: (error as Error).message});
                }
            });

            // Event: Get Game State (pour récupérer l'état actuel du jeu)
            socket.on('getGameState', (data) => {
                try {
                    const lobby = LobbyManager.getLobby(data.lobbyCode);
                    const game = lobby?.game;
                    if (!game) {
                        socket.emit('error', {message: 'Game not found'});
                        return;
                    }

                    // Créer un objet sérialisable sans référence circulaire
                    const gameData = {
                        currentRound: game.currentRound,
                        status: game.status,
                        rounds: game.rounds
                    };

                    socket.emit('gameState', {
                        game: gameData,
                        players: lobby.players,
                        leaderboard: game.getLeaderboard()
                    });
                } catch (error) {
                    console.error('Error getting game state:', error);
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

                    // Vérifier que le joueur n'est pas le chef (le chef ne répond pas)
                    if (player.id === game.currentRound.leader.id) {
                        socket.emit('error', {message: 'The leader cannot submit an answer'});
                        return;
                    }

                    // Ajouter la réponse
                    game.currentRound.addAnswer(data.playerId, data.answer);

                    // Notifier tous les joueurs qu'une réponse a été soumise
                    this.io.to(data.lobbyCode).emit('playerAnswered', {
                        playerId: data.playerId,
                        totalAnswers: Object.keys(game.currentRound.answers).length,
                        expectedAnswers: lobby.players.length - 1 // Tous sauf le chef
                    });

                    console.log(`Answer submitted by player ${player.name} in lobby ${data.lobbyCode} (${Object.keys(game.currentRound.answers).length}/${lobby.players.length - 1})`);

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
                        console.log(`All answers submitted in lobby ${data.lobbyCode}. Moving to GUESSING phase.`);
                    }
                } catch (error) {
                    console.error('Error submitting answer:', error);
                    socket.emit('error', {message: (error as Error).message});
                }
            });

            // Request Shuffled Answers (Chef demande les réponses mélangées)
            socket.on('requestShuffledAnswers', (data) => {
                try {
                    const lobby = LobbyManager.getLobby(data.lobbyCode);
                    const game = lobby?.game;
                    if (!game || !game.currentRound) {
                        socket.emit('error', {message: 'Game or round not found'});
                        return;
                    }

                    // Vérifier que c'est bien le chef qui demande
                    if (socket.id !== game.currentRound.leader.socketId) {
                        socket.emit('error', {message: 'Only the leader can request answers'});
                        return;
                    }

                    // Créer un tableau de réponses avec leurs IDs (playerId)
                    const answersArray = Object.entries(game.currentRound.answers).map(([playerId, answer]) => ({
                        id: playerId,
                        text: answer
                    }));

                    // Mélanger les réponses (shuffle)
                    const shuffledAnswers = answersArray.sort(() => Math.random() - 0.5);

                    // Envoyer les réponses mélangées à TOUS les joueurs (pas seulement le chef)
                    this.io.to(data.lobbyCode).emit('shuffledAnswersReceived', {
                        answers: shuffledAnswers,
                        players: lobby.players.filter(p => p.id !== game.currentRound!.leader.id)
                    });

                    console.log(`Shuffled answers sent to all players in lobby ${data.lobbyCode}`);
                } catch (error) {
                    console.error('Error requesting shuffled answers:', error);
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

                    console.log(`Guess updated in lobby ${data.lobbyCode}: answer ${data.answerId} -> player ${data.playerId}`);
                } catch (error) {
                    console.error('Error updating guess:', error);
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

                    // Enregistrer les attributions finales et calculer les scores
                    game.currentRound.submitGuesses(data.guesses);
                    game.currentRound.calculateScores();

                    // Passer à la phase REVEAL
                    game.currentRound.nextPhase();

                    // Créer les résultats détaillés
                    const results = Object.entries(game.currentRound.answers).map(([playerId, answer]) => {
                        const guessedPlayerId = game.currentRound!.guesses[playerId];
                        const player = lobby.getPlayer(playerId);
                        const guessedPlayer = guessedPlayerId ? lobby.getPlayer(guessedPlayerId) : null;

                        return {
                            playerId,
                            playerName: player?.name,
                            answer,
                            guessedPlayerId,
                            guessedPlayerName: guessedPlayer?.name,
                            correct: guessedPlayerId === playerId
                        };
                    });

                    // Broadcast les résultats à tous
                    this.io.to(data.lobbyCode).emit('revealResults', {
                        phase: game.currentRound.phase,
                        results,
                        scores: game.currentRound.scores,
                        leaderboard: game.getLeaderboard()
                    });

                    console.log(`Guesses submitted in lobby ${data.lobbyCode}. Leader scored: ${game.currentRound.scores[game.currentRound.leader.id] || 0}`);
                } catch (error) {
                    console.error('Error submitting guesses:', error);
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

                    // Calculer la fin du timer (en secondes)
                    const timerDuration = data.duration || 60; // Par défaut 60 secondes
                    const timerEnd = new Date(Date.now() + timerDuration * 1000);
                    game.currentRound.timerEnd = timerEnd;

                    // Broadcaster le démarrage du timer à tous
                    this.io.to(data.lobbyCode).emit('timerStarted', {
                        phase: game.currentRound.phase,
                        duration: timerDuration,
                        timerEnd: timerEnd.toISOString()
                    });

                    console.log(`Timer started for ${timerDuration}s in lobby ${data.lobbyCode} (phase: ${game.currentRound.phase})`);
                } catch (error) {
                    console.error('Error starting timer:', error);
                    socket.emit('error', {message: (error as Error).message});
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
                    console.log(`Timer expired in lobby ${data.lobbyCode} (phase: ${currentPhase})`);

                    // Gérer l'expiration selon la phase
                    switch (currentPhase) {
                        case 'QUESTION_SELECTION':
                            // Si le chef n'a pas choisi, sélectionner automatiquement la première question
                            if (!game.currentRound.selectedQuestion && game.currentRound.gameCard.questions.length > 0) {
                                game.currentRound.setSelectedQuestion(game.currentRound.gameCard.questions[0]);
                                game.currentRound.nextPhase();
                                this.io.to(data.lobbyCode).emit('questionSelected', {
                                    question: game.currentRound.selectedQuestion,
                                    phase: game.currentRound.phase,
                                    auto: true
                                });
                            }
                            break;

                        case 'ANSWERING':
                            // Passer à la phase GUESSING même si tous n'ont pas répondu
                            game.currentRound.nextPhase();
                            this.io.to(data.lobbyCode).emit('allAnswersSubmitted', {
                                phase: game.currentRound.phase,
                                answersCount: Object.keys(game.currentRound.answers).length,
                                forced: true
                            });
                            break;

                        case 'GUESSING':
                            // Valider les attributions actuelles et passer à REVEAL
                            game.currentRound.submitGuesses(game.currentRound.currentGuesses);
                            game.currentRound.calculateScores();
                            game.currentRound.nextPhase();

                            const results = Object.entries(game.currentRound.answers).map(([playerId, answer]) => {
                                const guessedPlayerId = game.currentRound!.guesses[playerId];
                                const player = lobby.getPlayer(playerId);
                                const guessedPlayer = guessedPlayerId ? lobby.getPlayer(guessedPlayerId) : null;

                                return {
                                    playerId,
                                    playerName: player?.name,
                                    answer,
                                    guessedPlayerId,
                                    guessedPlayerName: guessedPlayer?.name,
                                    correct: guessedPlayerId === playerId
                                };
                            });

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
                    console.error('Error handling timer expiration:', error);
                    socket.emit('error', {message: (error as Error).message});
                }
            });

        });
    }
}
