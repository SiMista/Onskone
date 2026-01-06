import * as LobbyManager from '../../managers/LobbyManager.js';
import logger from '../../utils/logger.js';
import { TypedServer } from './types.js';
import { TimeoutManager } from './TimeoutManager.js';

/**
 * Handle socket disconnect event with reconnection grace period
 */
export function handleDisconnect(
    io: TypedServer,
    socketId: string,
    reason: string,
    timeoutManager: TimeoutManager
): void {
    logger.socket.disconnect(socketId, reason);

    const lobbies = LobbyManager.getLobbies();

    lobbies.forEach((lobby) => {
        const disconnectedPlayer = lobby.players.find(p => p.socketId === socketId);

        if (disconnectedPlayer) {
            logger.info(`Player ${disconnectedPlayer.name} déconnecté du lobby ${lobby.code}`);

            const lobbyCode = lobby.code;
            const playerName = disconnectedPlayer.name;
            const playerId = disconnectedPlayer.id;

            // Cancel existing inactive timeout
            timeoutManager.cancelInactiveTimeout(lobbyCode, playerName);

            // Create timeout to mark player as inactive after delay
            timeoutManager.setInactiveTimeout(lobbyCode, playerName, () => {
                const currentLobby = LobbyManager.getLobby(lobbyCode);
                if (!currentLobby) return;

                const player = currentLobby.players.find(p => p.id === playerId);
                if (!player) return;

                if (player.isActive) {
                    logger.debug(`Player ${playerName} s'est reconnecté, timeout inactivité ignoré`);
                    return;
                }

                player.isActive = false;
                logger.info(`Player ${playerName} marqué inactif après ${timeoutManager.INACTIVE_DELAY}ms`);

                io.to(lobbyCode).emit('updatePlayersList', { players: currentLobby.players });
            });

            // === GAME IN PROGRESS HANDLING ===
            const game = lobby.game;
            if (game && game.currentRound && game.status === 'IN_PROGRESS') {
                const currentRound = game.currentRound;

                // CASE 1: Disconnected player is the current leader
                if (currentRound.leader.id === disconnectedPlayer.id) {
                    logger.info(`Chef ${disconnectedPlayer.name} déconnecté, délai avant saut de round`, { lobbyCode });

                    timeoutManager.cancelLeaderDisconnectTimeout(lobbyCode);

                    const leaderName = disconnectedPlayer.name;
                    const leaderId = disconnectedPlayer.id;

                    timeoutManager.setLeaderDisconnectTimeout(lobbyCode, () => {
                        const currentLobby = LobbyManager.getLobby(lobbyCode);
                        const currentGame = currentLobby?.game;
                        if (!currentLobby || !currentGame || !currentGame.currentRound) {
                            logger.debug(`Lobby/jeu n'existe plus, timeout pilier ignoré`);
                            return;
                        }

                        if (currentGame.currentRound.leader.id !== leaderId) {
                            logger.debug(`Chef a changé, timeout ignoré`);
                            return;
                        }

                        const leader = currentLobby.players.find(p => p.id === leaderId);
                        if (leader?.isActive) {
                            logger.debug(`Chef ${leaderName} s'est reconnecté, timeout ignoré`);
                            return;
                        }

                        logger.info(`Chef ${leaderName} toujours déconnecté, round sauté`, { lobbyCode });

                        io.to(lobbyCode).emit('roundSkipped', {
                            skippedLeaderName: leaderName,
                            reason: 'leader_disconnected'
                        });

                        const activePlayers = currentLobby.players.filter(p => p.isActive);
                        const previousLeaderIds = new Set(currentGame.rounds.map(r => r.leader.id));
                        const eligibleLeaders = activePlayers.filter(p => !previousLeaderIds.has(p.id));

                        if (activePlayers.length < 2 || eligibleLeaders.length === 0) {
                            currentGame.end();
                            currentLobby.players.forEach(p => p.isActive = false);
                            io.to(lobbyCode).emit('gameEnded', {
                                leaderboard: currentGame.getLeaderboard(),
                                rounds: currentGame.rounds
                            });
                            logger.game.ended(lobbyCode);
                        } else {
                            try {
                                currentGame.nextRound();
                                io.to(lobbyCode).emit('roundStarted', {
                                    round: currentGame.currentRound!
                                });
                                logger.info(`Nouveau round démarré après déconnexion du pilier`, {
                                    lobbyCode,
                                    newLeader: currentGame.currentRound!.leader.name
                                });
                            } catch (error) {
                                logger.error('Erreur lors du démarrage du round suivant', { error: (error as Error).message });
                                currentGame.end();
                                currentLobby.players.forEach(p => p.isActive = false);
                                io.to(lobbyCode).emit('gameEnded', {
                                    leaderboard: currentGame.getLeaderboard(),
                                    rounds: currentGame.rounds
                                });
                            }
                        }
                    });
                }
                // CASE 2: Disconnected player should respond
                // We don't do anything immediately - the ANSWERING phase timer will handle NO_RESPONSE
            }

            // Create timeout to remove player after grace period
            timeoutManager.cancelDisconnectTimeout(lobbyCode, playerName);

            timeoutManager.setDisconnectTimeout(lobbyCode, playerName, () => {
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
                        timeoutManager.cleanupLobbyResources(lobbyCode);
                        logger.info(`Lobby ${lobbyCode} supprimé (vide)`);
                    } else {
                        io.to(lobbyCode).emit('updatePlayersList', { players: currentLobby.players });
                    }
                }
            });
        }
    });
}
