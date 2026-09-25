import { rateLimiters } from '../../utils/rateLimiter.js';
import logger from '../../utils/logger.js';
import { armServerTimer, processTimerExpiration, getServerPhaseDuration } from '../broadcasting.js';
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
        }, ({ lobby, round: currentRound }, data) => {
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

            // Durée calculée par le SERVEUR pour la phase courante, pas celle envoyée
            // par le client. `data.duration` n'est plus qu'indicatif : un client en mode
            // DEBUG (DEBUG_TIMER = 3600) imposait sinon un timer d'une heure à toute la
            // table, et un `startTimer` parti juste avant une transition armait la durée
            // de l'ANCIENNE phase sur la nouvelle. Le serveur connaît déjà la bonne
            // valeur (même source partagée que le front) : il n'a aucune raison de faire
            // confiance au client ici.
            const timerDuration = getServerPhaseDuration(requestedPhase, lobby);
            if (timerDuration <= 0) {
                logger.debug('startTimer ignoré : phase sans timer', { lobbyCode: data.lobbyCode, phase: requestedPhase });
                return;
            }

            // Armer un timeout SERVEUR autoritatif (bookkeeping + setTimeout + broadcast
            // `timerStarted`), mutualisé avec le ré-armement après auto-transition.
            armServerTimer(io, data.lobbyCode, currentRound, timerDuration);
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
            //
            // Mais il faut d'abord vérifier qu'il parle bien de la phase EN COURS.
            // Un pilier mobile throttlé en arrière-plan poste son `timerExpired` au
            // réveil, potentiellement plusieurs phases plus tard ; `timerPhase` ayant
            // pu être réécrit entre-temps par un ré-armement, il ne suffisait pas à
            // l'écarter. On concluait alors la phase courante à l'instant où elle
            // démarrait (ANSWERING annulée, tout le monde en « n'a pas répondu »).
            if (data.phase !== currentRound.phase) {
                logger.debug('timerExpired ignoré : phase obsolète', {
                    lobbyCode: data.lobbyCode,
                    reported: data.phase,
                    current: currentRound.phase,
                });
                return;
            }
            processTimerExpiration(io, data.lobbyCode, lobby, game, currentRound);
        });
    });
}
