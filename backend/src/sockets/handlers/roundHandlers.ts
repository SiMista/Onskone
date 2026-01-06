import * as LobbyManager from '../../managers/LobbyManager.js';
import * as GameManager from '../../managers/GameManager.js';
import { GAME_CONSTANTS } from '@onskone/shared';
import { validatePlayerId, validateAnswer, sanitizeInput } from '../../utils/validation.js';
import { rateLimiters } from '../../utils/rateLimiter.js';
import { shuffleArray } from '../../utils/helpers.js';
import logger from '../../utils/logger.js';
import { HandlerContext, requireLeader } from './types.js';

/**
 * Build reveal results from the current round's answers and guesses
 */
export function buildRevealResults(
    lobby: ReturnType<typeof LobbyManager.getLobby>,
    round: { answers: Record<string, string>; guesses: Record<string, string> } | null
): Array<{
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

export function handleRequestQuestions(ctx: HandlerContext, data: { lobbyCode: string; count?: number; isRelance?: boolean }): void {
    try {
        if (!rateLimiters.requestQuestions.isAllowed(ctx.socket.id)) {
            ctx.socket.emit('error', { message: 'Trop de requêtes. Veuillez patienter.' });
            return;
        }

        const lobby = LobbyManager.getLobby(data.lobbyCode);
        const game = lobby?.game;
        if (!requireLeader(ctx.socket, game, 'demander des questions')) return;
        const currentRound = game!.currentRound!;

        if (data.isRelance === true) {
            const currentRelances = currentRound.relancesUsed || 0;
            if (currentRelances >= GAME_CONSTANTS.DEFAULT_CARD_RELANCES) {
                ctx.socket.emit('error', { message: `Nombre maximum de relances atteint (${GAME_CONSTANTS.DEFAULT_CARD_RELANCES})` });
                return;
            }
            currentRound.relancesUsed = currentRelances + 1;
        }

        if (currentRound.gameCard?.questions?.length > 0 && data.isRelance !== true) {
            ctx.socket.emit('questionsReceived', { questions: [currentRound.gameCard] });
            logger.debug(`Carte existante renvoyée au leader (reconnexion)`, { lobbyCode: data.lobbyCode });
            return;
        }

        const rawCount = typeof data.count === 'number' ? data.count : 1;
        const count = Math.max(1, Math.min(10, Math.floor(rawCount)));

        const excludeCards = currentRound.shownGameCards || [];
        const questions = GameManager.getRandomQuestions(count, excludeCards);

        if (questions.length > 0) {
            currentRound.gameCard = questions[0];
            if (!currentRound.shownGameCards) {
                currentRound.shownGameCards = [];
            }
            currentRound.shownGameCards.push(...questions);
        }

        ctx.socket.emit('questionsReceived', { questions });
        logger.debug(`${count} carte(s) envoyée(s) au leader (${excludeCards.length} exclues)`, { lobbyCode: data.lobbyCode });
    } catch (error) {
        logger.error('Error requesting questions', { error: (error as Error).message });
        ctx.socket.emit('error', { message: (error as Error).message });
    }
}

export function handleSelectQuestion(ctx: HandlerContext, data: { lobbyCode: string; selectedQuestion: string }): void {
    try {
        if (!rateLimiters.selectQuestion.isAllowed(ctx.socket.id)) {
            ctx.socket.emit('error', { message: 'Trop de requêtes. Veuillez patienter.' });
            return;
        }

        const lobby = LobbyManager.getLobby(data.lobbyCode);
        const game = lobby?.game;
        if (!requireLeader(ctx.socket, game, 'sélectionner une question')) return;
        const currentRound = game!.currentRound!;

        const validQuestion = typeof data.selectedQuestion === 'string'
            && data.selectedQuestion.length > 0
            && data.selectedQuestion.length <= 500;

        if (!validQuestion) {
            ctx.socket.emit('error', { message: 'Question invalide' });
            return;
        }

        const gameCard = currentRound.gameCard;
        if (gameCard && gameCard.questions && !gameCard.questions.includes(data.selectedQuestion)) {
            logger.warn(`Question non autorisée sélectionnée`, { lobbyCode: data.lobbyCode, question: data.selectedQuestion });
            ctx.socket.emit('error', { message: 'Cette question n\'est pas disponible' });
            return;
        }

        currentRound.setSelectedQuestion(data.selectedQuestion);
        currentRound.nextPhase();

        ctx.io.to(data.lobbyCode).emit('questionSelected', {
            question: data.selectedQuestion,
            phase: currentRound.phase
        });
        logger.debug(`Question sélectionnée`, { lobbyCode: data.lobbyCode });
    } catch (error) {
        logger.error('Error selecting question', { error: (error as Error).message });
        ctx.socket.emit('error', { message: (error as Error).message });
    }
}

export function handleSubmitAnswer(ctx: HandlerContext, data: { lobbyCode: string; playerId: string; answer: string }): void {
    try {
        const rateLimitKeys = [ctx.socket.id];
        if (data.lobbyCode && data.playerId) {
            rateLimitKeys.push(`${data.lobbyCode}_${data.playerId}_submitAnswer`);
        }
        if (!rateLimiters.submitAnswer.isAllowedMultiple(rateLimitKeys)) {
            ctx.socket.emit('error', { message: 'Trop de requêtes. Veuillez patienter.' });
            return;
        }

        const playerIdValidation = validatePlayerId(data.playerId);
        if (!playerIdValidation.isValid) {
            ctx.socket.emit('error', { message: playerIdValidation.error || 'ID joueur invalide' });
            return;
        }

        const answerValidation = validateAnswer(data.answer);
        if (!answerValidation.isValid) {
            ctx.socket.emit('error', { message: answerValidation.error || 'Réponse invalide' });
            return;
        }

        const sanitizedAnswer = sanitizeInput(data.answer);
        const lobby = LobbyManager.getLobby(data.lobbyCode);
        const game = lobby?.game;
        if (!game) {
            ctx.socket.emit('error', { message: 'Partie introuvable' });
            return;
        }

        lobby?.updateActivity();
        if (!game.currentRound) {
            ctx.socket.emit('error', { message: 'Round introuvable' });
            return;
        }
        const player = lobby.getPlayer(data.playerId);
        if (!player) {
            ctx.socket.emit('error', { message: 'Joueur introuvable' });
            return;
        }

        if (player.socketId !== ctx.socket.id) {
            logger.warn(`Tentative d'usurpation: socket ${ctx.socket.id} essaie de soumettre pour ${player.name}`);
            ctx.socket.emit('error', { message: 'Action non autorisée' });
            return;
        }

        if (game.currentRound.answers[data.playerId]) {
            ctx.socket.emit('error', { message: 'Vous avez déjà soumis une réponse' });
            return;
        }

        if (player.id === game.currentRound.leader.id) {
            ctx.socket.emit('error', { message: 'Le pilier ne peut pas soumettre de réponse' });
            return;
        }

        game.currentRound.addAnswer(data.playerId, sanitizedAnswer);

        const respondingPlayers = lobby.players.filter(p => p.isActive && p.id !== game.currentRound!.leader.id);

        ctx.io.to(data.lobbyCode).emit('playerAnswered', {
            playerId: data.playerId,
            totalAnswers: Object.keys(game.currentRound.answers).length,
            expectedAnswers: respondingPlayers.length
        });

        logger.debug(`Réponse soumise par ${player.name}`, { lobbyCode: data.lobbyCode, answers: Object.keys(game.currentRound.answers).length });

        const allActiveAnswered = respondingPlayers.every(p => game.currentRound!.answers[p.id]);

        if (allActiveAnswered) {
            const inactivePlayers = lobby.players.filter(p => !p.isActive && p.id !== game.currentRound!.leader.id);
            for (const inactivePlayer of inactivePlayers) {
                if (!game.currentRound.answers[inactivePlayer.id]) {
                    game.currentRound.addAnswer(inactivePlayer.id, `__NO_RESPONSE__${inactivePlayer.name} s'est déconnecté`);
                    logger.debug(`Réponse auto ajoutée pour joueur inactif ${inactivePlayer.name}`);
                }
            }

            game.currentRound.nextPhase();
            ctx.io.to(data.lobbyCode).emit('allAnswersSubmitted', {
                phase: game.currentRound.phase,
                answersCount: Object.keys(game.currentRound.answers).length
            });

            const answersArray = Object.entries(game.currentRound.answers).map(([playerId, answer]) => ({
                id: playerId,
                text: answer
            }));
            const shuffledAnswers = shuffleArray(answersArray);
            ctx.io.to(data.lobbyCode).emit('shuffledAnswersReceived', {
                answers: shuffledAnswers,
                players: lobby.players.filter(p => p.id !== game.currentRound!.leader.id),
                roundNumber: game.currentRound.roundNumber
            });

            logger.info(`Toutes les réponses soumises, passage à GUESSING`, { lobbyCode: data.lobbyCode });
        }
    } catch (error) {
        logger.error('Error submitting answer', { error: (error as Error).message });
        ctx.socket.emit('error', { message: (error as Error).message });
    }
}

export function handleRequestShuffledAnswers(ctx: HandlerContext, data: { lobbyCode: string }): void {
    try {
        if (!rateLimiters.general.isAllowed(ctx.socket.id)) {
            ctx.socket.emit('error', { message: 'Trop de requêtes. Veuillez patienter.' });
            return;
        }

        const lobby = LobbyManager.getLobby(data.lobbyCode);
        const game = lobby?.game;
        if (!game || !game.currentRound) {
            ctx.socket.emit('error', { message: 'Partie ou round introuvable' });
            return;
        }

        const answersArray = Object.entries(game.currentRound.answers).map(([playerId, answer]) => ({
            id: playerId,
            text: answer
        }));

        const shuffledAnswers = shuffleArray(answersArray);

        ctx.io.to(data.lobbyCode).emit('shuffledAnswersReceived', {
            answers: shuffledAnswers,
            players: lobby.players.filter(p => p.id !== game.currentRound!.leader.id),
            roundNumber: game.currentRound.roundNumber
        });
    } catch (error) {
        logger.error('Error requesting shuffled answers', { error: (error as Error).message });
        ctx.socket.emit('error', { message: (error as Error).message });
    }
}

export function handleUpdateGuess(ctx: HandlerContext, data: { lobbyCode: string; answerId: string; playerId: string | null }): void {
    try {
        const rateLimitKeys = [ctx.socket.id];
        if (data.lobbyCode) {
            rateLimitKeys.push(`${data.lobbyCode}_leader_updateGuess`);
        }
        if (!rateLimiters.updateGuess.isAllowedMultiple(rateLimitKeys)) {
            ctx.socket.emit('error', { message: 'Trop de requêtes. Veuillez patienter.' });
            return;
        }

        const lobby = LobbyManager.getLobby(data.lobbyCode);
        const game = lobby?.game;
        if (!requireLeader(ctx.socket, game, 'modifier les attributions')) return;
        const currentRound = game!.currentRound!;

        currentRound.updateCurrentGuess(data.answerId, data.playerId);

        ctx.io.to(data.lobbyCode).emit('guessUpdated', {
            answerId: data.answerId,
            playerId: data.playerId
        });
    } catch (error) {
        logger.error('Error updating guess', { error: (error as Error).message });
        ctx.socket.emit('error', { message: (error as Error).message });
    }
}

export function handleSubmitGuesses(ctx: HandlerContext, data: { lobbyCode: string; guesses: Record<string, string | null> }): void {
    try {
        const rateLimitKeys = [ctx.socket.id];
        if (data.lobbyCode) {
            rateLimitKeys.push(`${data.lobbyCode}_leader_submitGuesses`);
        }
        if (!rateLimiters.submitGuesses.isAllowedMultiple(rateLimitKeys)) {
            ctx.socket.emit('error', { message: 'Trop de requêtes. Veuillez patienter.' });
            return;
        }

        const lobby = LobbyManager.getLobby(data.lobbyCode);
        const game = lobby?.game;
        if (!requireLeader(ctx.socket, game, 'valider les attributions')) return;
        if (!lobby) return;
        const currentRound = game!.currentRound!;

        const answerIds = Object.keys(currentRound.answers);
        const playerIds = lobby.players
            .filter(p => p.id !== currentRound.leader.id)
            .map(p => p.id);

        const validGuesses: Record<string, string> = {};
        for (const [answerId, guessedPlayerId] of Object.entries(data.guesses)) {
            if (guessedPlayerId === null || guessedPlayerId === undefined) continue;

            if (!answerIds.includes(answerId)) {
                logger.warn(`Guess invalide: answerId ${answerId} inexistant`);
                continue;
            }

            if (!playerIds.includes(guessedPlayerId as string)) {
                logger.warn(`Guess invalide: playerId ${guessedPlayerId} inexistant ou est le pilier`);
                continue;
            }

            validGuesses[answerId] = guessedPlayerId as string;
        }

        currentRound.submitGuesses(validGuesses);
        currentRound.calculateScores();
        currentRound.nextPhase();

        const results = buildRevealResults(lobby, currentRound);

        ctx.io.to(data.lobbyCode).emit('revealResults', {
            phase: currentRound.phase,
            results,
            scores: currentRound.scores,
            leaderboard: game!.getLeaderboard()
        });

        logger.info(`Attributions validées`, { lobbyCode: data.lobbyCode, leaderScore: currentRound.scores[currentRound.leader.id] || 0 });
    } catch (error) {
        logger.error('Error submitting guesses', { error: (error as Error).message });
        ctx.socket.emit('error', { message: (error as Error).message });
    }
}

export function handleRevealAnswer(ctx: HandlerContext, data: { lobbyCode: string; answerIndex: number }): void {
    try {
        if (!rateLimiters.revealAnswer.isAllowed(ctx.socket.id)) {
            ctx.socket.emit('error', { message: 'Trop de requêtes. Veuillez patienter.' });
            return;
        }

        const lobby = LobbyManager.getLobby(data.lobbyCode);
        const game = lobby?.game;
        if (!requireLeader(ctx.socket, game, 'révéler les réponses')) return;
        const currentRound = game!.currentRound!;

        if (!currentRound.revealedIndices) {
            currentRound.revealedIndices = [];
        }

        if (currentRound.revealedIndices.includes(data.answerIndex)) {
            return;
        }

        currentRound.revealedIndices.push(data.answerIndex);

        ctx.io.to(data.lobbyCode).emit('answerRevealed', {
            revealedIndex: data.answerIndex,
            revealedIndices: currentRound.revealedIndices
        });
    } catch (error) {
        logger.error('Error revealing answer', { error: (error as Error).message });
        ctx.socket.emit('error', { message: (error as Error).message });
    }
}
