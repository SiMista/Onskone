import * as LobbyManager from '../../managers/LobbyManager';
import { Game } from '../../models/Game';
import { rateLimiters } from '../../utils/rateLimiter.js';
import { errMessage } from '../../utils/helpers.js';
import logger from '../../utils/logger.js';
import { processTimerExpiration } from '../broadcasting.js';
import {
    type HandlerContext,
    type AppSocket,
    withGuards,
    withLeaderGuards,
} from './context.js';

export function registerTimerHandlers(socket: AppSocket, ctx: HandlerContext): void {
    const { io } = ctx;

    // Start Timer (Démarrer un timer pour une phase)
    socket.on('startTimer', (data) => {
        withLeaderGuards(socket, data, {
            limiter: rateLimiters.gameAction,
            requireLeaderAction: 'démarrer le timer',
        }, ({ round: currentRound }, data) => {
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

            // Stocker les infos du timer pour pouvoir les renvoyer sur demande
            currentRound.timerEnd = new Date(startedAt + timerDuration * 1000);
            currentRound.timerStartedAt = startedAt;
            currentRound.timerDuration = timerDuration;
            currentRound.timerPhase = currentRound.phase; // Pour éviter les conflits entre phases

            // Armer un timeout SERVEUR autoritatif. On ne réinitialise la garde
            // anti-double-traitement que pour une phase qui n'a pas encore été traitée :
            // un re-arm pour la même phase déjà expirée ne doit pas pouvoir la rejouer.
            const armedPhase = currentRound.phase;
            if (currentRound.timerProcessedForPhase !== armedPhase) {
                currentRound.timerProcessedForPhase = null;
            }
            const roundForTimer = currentRound;
            roundForTimer.clearServerTimer();
            roundForTimer.serverTimerHandle = setTimeout(() => {
                roundForTimer.serverTimerHandle = null;
                try {
                    const currentLobby = LobbyManager.getLobby(data.lobbyCode);
                    const currentGame = currentLobby?.game;
                    // Revérifier que c'est toujours le même round (pas déjà passé au suivant)
                    if (
                        !currentLobby ||
                        !currentGame ||
                        currentGame.currentRound !== roundForTimer
                    ) {
                        return;
                    }
                    processTimerExpiration(io, data.lobbyCode, currentLobby, currentGame as Game, roundForTimer);
                } catch (error) {
                    logger.error('Error in server timer expiration', { error: errMessage(error) });
                }
            }, timerDuration * 1000);

            // Broadcaster le démarrage du timer à tous
            io.to(data.lobbyCode).emit('timerStarted', {
                phase: currentRound.phase,
                duration: timerDuration,
                startedAt: startedAt
            });
            logger.debug(`Timer démarré: ${timerDuration}s`, { lobbyCode: data.lobbyCode, phase: currentRound.phase });
        });
    });

    // Request Timer State (Demander l'état actuel du timer - utile pour les navigateurs lents comme Edge)
    // Canal alternatif (onReject) : tout échec de garde émet `timerState null` au lieu
    // d'une erreur standard (rate-limit, partie absente). Les cas plus fins (mauvaise
    // phase, timer expiré, etc.) restent gérés dans le corps en émettant null directement.
    socket.on('requestTimerState', (data) => {
        withGuards(socket, data, {
            limiter: rateLimiters.general,
            requireGame: true,
            onReject: () => socket.emit('timerState', null),
        }, ({ game }, data) => {
            if (!game || !game.currentRound) {
                socket.emit('timerState', null);
                return;
            }

            // Vérifier si un timer est actif pour cette phase
            if (game.currentRound.timerStartedAt && game.currentRound.timerDuration) {
                // Le timer stocké doit appartenir à la phase courante : sans cette garde,
                // un client qui reconnecte recevrait le compte à rebours périmé de la
                // phase précédente. Après une transition, timerPhase conserve l'ancienne
                // phase (différente de la phase courante) tant qu'aucun nouveau timer n'a
                // été démarré, donc cette condition échoue et aucun timer périmé n'est renvoyé.
                if (game.currentRound.timerPhase !== game.currentRound.phase) {
                    socket.emit('timerState', null);
                    return;
                }

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
        });
    });

    // Timer Expired (Le timer a expiré)
    socket.on('timerExpired', (data) => {
        withLeaderGuards(socket, data, {
            limiter: rateLimiters.gameAction,
            requireLeaderAction: 'signaler l\'expiration du timer',
        }, ({ lobby, game, round: currentRound }, data) => {
            // Le timerExpired du pilier reste une optimisation de réactivité :
            // la logique (et ses gardes anti-double-traitement) est centralisée.
            processTimerExpiration(io, data.lobbyCode, lobby, game, currentRound);
        });
    });
}
