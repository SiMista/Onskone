import * as LobbyManager from '../../managers/LobbyManager';
import { Game } from '../../models/Game';
import { GAME_CONSTANTS, GameStatus } from '@onskone/shared';
import { errMessage } from '../../utils/helpers.js';
import logger from '../../utils/logger.js';
import { serializeRound, serializePlayers, endGame } from '../broadcasting.js';
import { ConnectionRegistry } from '../ConnectionRegistry.js';
import {
    type HandlerContext,
    type IoServer,
    type AppSocket,
} from './context.js';

// Délais de gestion des déconnexions — source de vérité dans shared/src/constants.ts.
const RECONNECT_GRACE_PERIOD = GAME_CONSTANTS.RECONNECT_GRACE_PERIOD_MS;
const LEADER_DISCONNECT_DELAY = GAME_CONSTANTS.LEADER_DISCONNECT_DELAY_MS;
const INACTIVE_DELAY = GAME_CONSTANTS.INACTIVE_DELAY_MS;

/**
 * Marque le joueur comme inactif après INACTIVE_DELAY, sauf s'il s'est reconnecté
 * entre temps (player.isActive). Ne supprime jamais le joueur — c'est purement un
 * marquage d'UI.
 */
function scheduleInactiveTimeout(
    io: IoServer,
    registry: ConnectionRegistry,
    lobbyCode: string,
    playerName: string,
    playerId: string,
): void {
    const inactiveTimeout = setTimeout(() => {
        try {
            registry.deleteInactiveTimeout(lobbyCode, playerName);

            const currentLobby = LobbyManager.getLobby(lobbyCode);
            if (!currentLobby) return;

            const player = currentLobby.players.find(p => p.id === playerId);
            if (!player) return;

            // Si le joueur s'est reconnecté entre temps, ne rien faire.
            if (player.isActive) {
                logger.debug(`Player ${playerName} s'est reconnecté, timeout inactivité ignoré`);
                return;
            }

            player.isActive = false;
            logger.info(`Player ${playerName} marqué inactif après ${INACTIVE_DELAY}ms`);

            io.to(lobbyCode).emit('updatePlayersList', { players: serializePlayers(currentLobby.players) });
        } catch (error) {
            logger.error('Error in inactive timeout', { error: errMessage(error) });
        }
    }, INACTIVE_DELAY);

    registry.setInactiveTimeout(lobbyCode, playerName, inactiveTimeout);
}

/**
 * Le pilier déconnecté dispose d'un court délai (tolérance arrière-plan mobile) ;
 * passé LEADER_DISCONNECT_DELAY sans reconnexion, le round est sauté et soit la
 * partie se termine, soit on enchaîne sur un nouveau pilier.
 */
function scheduleLeaderSkipTimeout(
    io: IoServer,
    registry: ConnectionRegistry,
    lobbyCode: string,
    playerId: string,
    playerName: string,
): void {
    const leaderTimeout = setTimeout(() => {
        try {
            registry.deleteLeaderDisconnectTimeout(lobbyCode);

            // Revérifier que le lobby et le jeu existent toujours
            const currentLobby = LobbyManager.getLobby(lobbyCode);
            const currentGame = currentLobby?.game;
            if (!currentLobby || !currentGame || !currentGame.currentRound) {
                logger.debug(`Lobby/jeu n'existe plus, timeout pilier ignoré`);
                return;
            }

            // Vérifier que c'est toujours le même round et le même pilier
            if (currentGame.currentRound.leader.id !== playerId) {
                logger.debug(`Pilier a changé, timeout ignoré`);
                return;
            }

            // Vérifier que le pilier est toujours inactif (n'a pas reconnecté)
            const leader = currentLobby.players.find(p => p.id === playerId);
            if (leader?.isActive) {
                logger.debug(`Pilier ${playerName} s'est reconnecté, timeout ignoré`);
                return;
            }

            logger.info(`Pilier ${playerName} toujours déconnecté, round sauté`, { lobbyCode });

            io.to(lobbyCode).emit('roundSkipped', {
                skippedLeaderName: playerName,
                reason: 'leader_disconnected'
            });

            // Vérifier s'il reste des joueurs éligibles pour être pilier
            const activePlayers = currentLobby.players.filter(p => p.isActive);
            const eligibleLeaders = currentGame.getEligibleLeaders();

            // Si pas assez de joueurs OU pas de pilier éligible → terminer la partie
            if (activePlayers.length < 2 || eligibleLeaders.length === 0) {
                endGame(io, lobbyCode, currentLobby, currentGame as Game);
            } else {
                // Démarrer le round suivant avec un nouveau pilier
                try {
                    currentGame.nextRound();
                    io.to(lobbyCode).emit('roundStarted', {
                        round: serializeRound(currentGame.currentRound!)!
                    });
                    logger.info(`Nouveau round démarré après déconnexion du pilier`, {
                        lobbyCode,
                        newLeader: currentGame.currentRound!.leader.name
                    });
                } catch (error) {
                    logger.error('Erreur lors du démarrage du round suivant', { error: errMessage(error) });
                    // Terminer la partie si impossible de continuer
                    endGame(io, lobbyCode, currentLobby, currentGame as Game);
                }
            }
        } catch (error) {
            logger.error('Error in leader skip timeout', { error: errMessage(error) });
        }
    }, LEADER_DISCONNECT_DELAY);

    registry.setLeaderDisconnectTimeout(lobbyCode, leaderTimeout);
}

/**
 * Passé la période de grâce, supprime le joueur toujours déconnecté — sauf si une
 * partie est en cours (on conserve alors ses scores pour le leaderboard final).
 */
function scheduleGracePeriodRemoval(
    io: IoServer,
    registry: ConnectionRegistry,
    lobbyCode: string,
    playerName: string,
): void {
    const timeout = setTimeout(() => {
        try {
            // Toujours supprimer l'entrée du timeout en premier (évite les fuites mémoire)
            registry.deleteDisconnectTimeout(lobbyCode, playerName);

            const currentLobby = LobbyManager.getLobby(lobbyCode);
            if (!currentLobby) {
                logger.debug(`Lobby ${lobbyCode} n'existe plus, timeout ignoré`);
                return;
            }

            const playerToRemove = currentLobby.players.find(p => p.name === playerName && !p.isActive);
            if (playerToRemove) {
                // En pleine partie, on NE supprime PAS le joueur déconnecté :
                // ses réponses/scores sont déjà dans le round, et `getLeaderboard`
                // itère sur `lobby.players`. Le retirer du tableau lui ferait perdre
                // ses points au moment du calcul final. On le laisse en inactif jusqu'à
                // `gameEnded`, où le lobby sera nettoyé normalement.
                if (currentLobby.game?.status === GameStatus.IN_PROGRESS) {
                    logger.info(`Période de grâce expirée pour ${playerToRemove.name}, mais partie en cours : conservation pour le leaderboard`);
                    return;
                }

                logger.info(`Période de grâce expirée, suppression de ${playerToRemove.name}`);

                const isLobbyRemoved = LobbyManager.removePlayer(currentLobby, playerToRemove);

                if (isLobbyRemoved) {
                    registry.cleanupLobbyResources(lobbyCode);
                    logger.info(`Lobby ${lobbyCode} supprimé (vide)`);
                } else {
                    io.to(lobbyCode).emit('updatePlayersList', { players: serializePlayers(currentLobby.players) });
                }
            }
        } catch (error) {
            logger.error('Error in grace period removal timeout', { error: errMessage(error) });
        }
    }, RECONNECT_GRACE_PERIOD);

    registry.setDisconnectTimeout(lobbyCode, playerName, timeout);
}

export function registerDisconnectHandler(socket: AppSocket, ctx: HandlerContext): void {
    const { io, registry } = ctx;

    // Marquer le joueur comme inactif avec délai de grâce pour reconnexion.
    socket.on('disconnect', (reason) => {
        logger.socket.disconnect(socket.id, reason);

        LobbyManager.getLobbies().forEach((lobby) => {
            const disconnectedPlayer = lobby.players.find(p => p.socketId === socket.id);
            if (!disconnectedPlayer) return;

            logger.info(`Player ${disconnectedPlayer.name} déconnecté du lobby ${lobby.code}`);

            const lobbyCode = lobby.code;
            const playerName = disconnectedPlayer.name;
            const playerId = disconnectedPlayer.id;

            // 1) Marquage inactif différé (remplace tout timeout d'inactivité existant).
            registry.cancelInactiveTimeout(lobbyCode, playerName);
            scheduleInactiveTimeout(io, registry, lobbyCode, playerName, playerId);

            // 2) Si le déconnecté est le pilier en cours, armer le saut de round différé.
            //    Les autres rôles (joueurs qui doivent répondre) sont couverts par le
            //    timer de la phase ANSWERING (NO_RESPONSE) : rien à faire ici.
            const game = lobby.game;
            if (game && game.currentRound && game.status === 'IN_PROGRESS'
                && game.currentRound.leader.id === playerId) {
                logger.info(`Pilier ${playerName} déconnecté, délai avant saut de round`, { lobbyCode });
                registry.cancelLeaderDisconnectTimeout(lobbyCode);
                scheduleLeaderSkipTimeout(io, registry, lobbyCode, playerId, playerName);
            }

            // 3) Suppression après la période de grâce (remplace tout timeout existant).
            registry.cancelDisconnectTimeout(lobbyCode, playerName);
            scheduleGracePeriodRemoval(io, registry, lobbyCode, playerName);
        });
    });
}
