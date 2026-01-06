import { randomInt } from 'crypto';
import * as LobbyManager from '../../managers/LobbyManager.js';
import { Lobby } from '../../models/Lobby.js';
import { Round } from '../../models/Round.js';
import { Game } from '../../models/Game.js';
import { rateLimiters } from '../../utils/rateLimiter.js';
import { shuffleArray } from '../../utils/helpers.js';
import logger from '../../utils/logger.js';
import { HandlerContext, TypedServer, requireLeader } from './types.js';
import { buildRevealResults } from './roundHandlers.js';

/**
 * Handle timer expiration for QUESTION_SELECTION phase
 * Auto-selects a random question if the leader hasn't chosen
 */
export function handleQuestionSelectionTimeout(io: TypedServer, lobbyCode: string, currentRound: Round): void {
    if (currentRound.selectedQuestion) return;

    const proposedCard = currentRound.gameCard;
    if (!proposedCard || proposedCard.questions.length === 0) {
        logger.error('Pas de questions disponibles pour auto-sélection', { lobbyCode });
        return;
    }

    const randomQuestion = proposedCard.questions[randomInt(0, proposedCard.questions.length)];

    currentRound.setSelectedQuestion(randomQuestion);
    currentRound.nextPhase();
    io.to(lobbyCode).emit('questionSelected', {
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
export function handleAnsweringTimeout(io: TypedServer, lobbyCode: string, lobby: Lobby, currentRound: Round): void {
    const respondingPlayers = lobby.players.filter(p => p.id !== currentRound.leader.id);
    for (const player of respondingPlayers) {
        if (!currentRound.answers[player.id]) {
            currentRound.addAnswer(player.id, `__NO_RESPONSE__${player.name} n'a pas répondu à temps`);
            logger.debug(`Réponse auto ajoutée pour ${player.name}`);
        }
    }

    currentRound.nextPhase();
    io.to(lobbyCode).emit('allAnswersSubmitted', {
        phase: currentRound.phase,
        answersCount: Object.keys(currentRound.answers).length,
        forced: true
    });

    const answersArray = Object.entries(currentRound.answers).map(([playerId, answer]) => ({
        id: playerId,
        text: answer
    }));
    const shuffledAnswers = shuffleArray(answersArray);
    io.to(lobbyCode).emit('shuffledAnswersReceived', {
        answers: shuffledAnswers,
        players: lobby.players.filter(p => p.id !== currentRound.leader.id),
        roundNumber: currentRound.roundNumber
    });
}

/**
 * Handle timer expiration for GUESSING phase
 * Validates current guesses and moves to REVEAL
 */
export function handleGuessingTimeout(io: TypedServer, lobbyCode: string, lobby: Lobby, game: Game, currentRound: Round): void {
    const validGuesses = Object.fromEntries(
        Object.entries(currentRound.currentGuesses).filter(([_, playerId]) => playerId !== null && playerId !== undefined)
    );
    currentRound.submitGuesses(validGuesses);
    currentRound.calculateScores();
    currentRound.nextPhase();

    const results = buildRevealResults(lobby, currentRound);

    io.to(lobbyCode).emit('revealResults', {
        phase: currentRound.phase,
        results,
        scores: currentRound.scores,
        leaderboard: game.getLeaderboard(),
        forced: true
    });
}

export function handleStartTimer(ctx: HandlerContext, data: { lobbyCode: string; duration?: number }): void {
    try {
        if (!rateLimiters.gameAction.isAllowed(ctx.socket.id)) {
            ctx.socket.emit('error', { message: 'Trop de requêtes. Veuillez patienter.' });
            return;
        }

        const lobby = LobbyManager.getLobby(data.lobbyCode);
        const game = lobby?.game;
        if (!requireLeader(ctx.socket, game, 'démarrer le timer')) return;
        const currentRound = game!.currentRound!;

        const requestedPhase = currentRound.phase;
        if (currentRound.timerStartedAt && currentRound.timerEnd && currentRound.timerDuration && currentRound.timerPhase === requestedPhase) {
            const now = Date.now();
            const timerEndTime = currentRound.timerEnd.getTime();
            if (now < timerEndTime) {
                logger.debug(`Timer déjà actif pour phase ${requestedPhase}, pas de reset`, { lobbyCode: data.lobbyCode, phase: requestedPhase });
                ctx.socket.emit('timerStarted', {
                    phase: currentRound.phase,
                    duration: currentRound.timerDuration,
                    startedAt: currentRound.timerStartedAt
                });
                return;
            }
        }

        const rawDuration = typeof data.duration === 'number' ? data.duration : 60;
        const timerDuration = Math.max(1, Math.min(3600, Math.floor(rawDuration)));
        const startedAt = Date.now();
        const timerEnd = new Date(startedAt + timerDuration * 1000);

        currentRound.timerEnd = timerEnd;
        currentRound.timerStartedAt = startedAt;
        currentRound.timerDuration = timerDuration;
        currentRound.timerPhase = currentRound.phase;

        ctx.io.to(data.lobbyCode).emit('timerStarted', {
            phase: currentRound.phase,
            duration: timerDuration,
            startedAt: startedAt
        });
        logger.debug(`Timer démarré: ${timerDuration}s`, { lobbyCode: data.lobbyCode, phase: currentRound.phase });
    } catch (error) {
        logger.error('Error starting timer', { error: (error as Error).message });
        ctx.socket.emit('error', { message: (error as Error).message });
    }
}

export function handleRequestTimerState(ctx: HandlerContext, data: { lobbyCode: string; phase?: string }): void {
    try {
        if (!rateLimiters.general.isAllowed(ctx.socket.id)) {
            ctx.socket.emit('timerState', null);
            return;
        }

        const lobby = LobbyManager.getLobby(data.lobbyCode);
        const game = lobby?.game;
        if (!game || !game.currentRound) {
            ctx.socket.emit('timerState', null);
            return;
        }

        if (game.currentRound.timerStartedAt && game.currentRound.timerDuration) {
            if (data.phase && data.phase !== game.currentRound.phase) {
                ctx.socket.emit('timerState', null);
                return;
            }

            const elapsed = Date.now() - game.currentRound.timerStartedAt;
            const remaining = game.currentRound.timerDuration * 1000 - elapsed;

            if (remaining > 0) {
                ctx.socket.emit('timerState', {
                    phase: game.currentRound.phase,
                    duration: game.currentRound.timerDuration,
                    startedAt: game.currentRound.timerStartedAt
                });
                return;
            }
        }

        ctx.socket.emit('timerState', null);
    } catch (error) {
        logger.error('Error getting timer state', { error: (error as Error).message });
        ctx.socket.emit('timerState', null);
    }
}

export function handleTimerExpired(ctx: HandlerContext, data: { lobbyCode: string }): void {
    try {
        if (!rateLimiters.gameAction.isAllowed(ctx.socket.id)) {
            ctx.socket.emit('error', { message: 'Trop de requêtes. Veuillez patienter.' });
            return;
        }

        const lobby = LobbyManager.getLobby(data.lobbyCode);
        const game = lobby?.game;
        if (!requireLeader(ctx.socket, game, 'signaler l\'expiration du timer')) return;
        const currentRound = game!.currentRound!;

        const currentPhase = currentRound.phase;

        if (currentRound.timerProcessedForPhase === currentPhase) {
            logger.debug(`Timer déjà traité pour phase ${currentPhase}, ignoré`);
            return;
        }

        currentRound.timerProcessedForPhase = currentPhase;

        logger.info(`Timer expiré`, { lobbyCode: data.lobbyCode, phase: currentPhase });
        if (!lobby) return;

        switch (currentPhase) {
            case 'QUESTION_SELECTION':
                handleQuestionSelectionTimeout(ctx.io, data.lobbyCode, currentRound as Round);
                break;
            case 'ANSWERING':
                handleAnsweringTimeout(ctx.io, data.lobbyCode, lobby, currentRound as Round);
                break;
            case 'GUESSING':
                handleGuessingTimeout(ctx.io, data.lobbyCode, lobby, game as Game, currentRound as Round);
                break;
            case 'REVEAL':
                // Nothing to do, wait for leader to start next round
                break;
        }
    } catch (error) {
        logger.error('Error handling timer expiration', { error: (error as Error).message });
        ctx.socket.emit('error', { message: (error as Error).message });
    }
}
