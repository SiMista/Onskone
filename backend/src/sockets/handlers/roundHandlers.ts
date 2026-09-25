import * as LobbyManager from '../../managers/LobbyManager';
import {
    getRandomQuestions,
} from '../../data/questionsRepository.js';
import { Round } from '../../models/Round';
import type { ReconnectionData } from '@onskone/shared';
import { RoundPhase, ERROR_CODES, isNoResponse } from '@onskone/shared';
import { validateAnswer, validatePlayerId, sanitizeInput } from '../../utils/validation.js';
import { rateLimiters } from '../../utils/rateLimiter.js';
import { errMessage } from '../../utils/helpers.js';
import { isSimilarPair } from '../../utils/similarity.js';
import logger from '../../utils/logger.js';
import {
    serializeGame,
    serializeRound,
    serializeRounds,
    serializePlayers,
    buildRevealResults,
    transitionToGuessing,
    finishAnsweringPhase,
    finishGuessing,
    endGame,
} from '../broadcasting.js';
import {
    type HandlerContext,
    type AppSocket,
    withGuards,
    withGameGuards,
    withLeaderGuards,
} from './context.js';
import { reconnectPlayerSlot } from './reconnection.js';

/**
 * Tolérance pour un `submitAnswer` arrivé juste après la bascule de phase. Couvre
 * l'écart entre le timer serveur (exact) et celui du client (tick 1s) + la latence.
 */
const ANSWER_GRACE_PERIOD = 3000;

/**
 * IDs des joueurs ayant déjà répondu, pour restaurer les pastilles « a répondu »
 * de la phase ANSWERING à la reconnexion.
 *
 * Restreint à ANSWERING (et à sa jumelle SUBSTITUTE_ANSWERING) À DESSEIN : ces clés
 * sont les IDs des AUTEURS. Pendant ANSWERING l'info est publique — elle est déjà
 * diffusée en direct par `playerAnswered`. Mais à partir de GUESSING, le pool est
 * anonymisé derrière des slots opaques (cf. `prepareGuessing`) : continuer à
 * envoyer la liste des auteurs à un client qui reconnecte contredisait tout
 * l'anti-fuite du reste du round.
 */
function answeredIdsFor(round: { phase: RoundPhase; answers: Record<string, string> } | null): string[] {
    if (!round) return [];
    const isAnsweringStage = round.phase === RoundPhase.ANSWERING
        || round.phase === RoundPhase.SUBSTITUTE_ANSWERING;
    return isAnsweringStage ? Object.keys(round.answers) : [];
}

export function registerRoundHandlers(socket: AppSocket, ctx: HandlerContext): void {
    const { io, registry } = ctx;

    /**
     * Valide + sanitize une réponse brute, avec le re-check post-sanitize
     * (une entrée de balises HTML passe validateAnswer mais ressort vide). Émet
     * l'erreur appropriée et renvoie `null` en cas d'échec, sinon la réponse
     * nettoyée. Partagé par submitAnswer et submitSubstituteAnswer (mêmes messages).
     */
    const validateAndSanitizeAnswer = (raw: string): string | null => {
        const answerValidation = validateAnswer(raw);
        if (!answerValidation.isValid) {
            socket.emit('error', { message: answerValidation.error || 'Réponse invalide', code: ERROR_CODES.INVALID });
            return null;
        }
        const sanitized = sanitizeInput(raw);
        if (!sanitized) {
            socket.emit('error', { message: 'La réponse ne peut pas être vide', code: ERROR_CODES.INVALID });
            return null;
        }
        return sanitized;
    };

    // Request Questions (Pilier demande des cartes de questions)
    socket.on('requestQuestions', (data) => {
        withLeaderGuards(socket, data, {
            limiter: rateLimiters.requestQuestions,
            requireLeaderAction: 'demander des questions',
        }, ({ game, round: currentRound }, data) => {
            // Des cartes existent déjà → c'est une reconnexion : renvoyer les mêmes.
            // (Le tirage n'a lieu qu'une fois par manche : le pilier ne peut plus
            // repiocher, la relance ayant été retirée du jeu.)
            if ((currentRound.proposedCards?.length ?? 0) > 0) {
                socket.emit('questionsReceived', { questions: currentRound.proposedCards! });
                logger.debug(`Cartes existantes renvoyées au leader (reconnexion)`, { lobbyCode: data.lobbyCode });
                return;
            }

            // Toujours envoyer 3 cartes au pilier
            const count = 3;

            // Exclure les cartes déjà montrées (manches précédentes) pour éviter les doublons
            const excludeCards = currentRound.shownGameCards || [];
            const questions = getRandomQuestions(count, excludeCards, game.cards);

            // Stocker les cartes proposées et la première pour l'auto-sélection
            if (questions.length > 0) {
                currentRound.proposedCards = questions;
                currentRound.gameCard = questions[0];
                // Ajouter toutes les nouvelles cartes aux cartes déjà montrées
                if (!currentRound.shownGameCards) {
                    currentRound.shownGameCards = [];
                }
                currentRound.shownGameCards.push(...questions);
            }

            socket.emit('questionsReceived', { questions });
            logger.debug(`${questions.length} carte(s) envoyée(s) au leader (${excludeCards.length} exclues)`, { lobbyCode: data.lobbyCode });
        });
    });

    // Select Question (Pilier sélectionne une question)
    socket.on('selectQuestion', (data) => {
        withLeaderGuards(socket, data, {
            limiter: rateLimiters.selectQuestion,
            requireLeaderAction: 'sélectionner une question',
            // Guard de phase (silent-return) : ignore les double-soumissions hors
            // QUESTION_SELECTION (client malveillant ou double-tap).
            requirePhase: RoundPhase.QUESTION_SELECTION,
        }, ({ round: currentRound }, data) => {
            // Valider que la question sélectionnée est bien une des questions proposées
            const validQuestion = typeof data.selectedQuestion === 'string'
                && data.selectedQuestion.length > 0
                && data.selectedQuestion.length <= 500;

            if (!validQuestion) {
                socket.emit('error', { message: 'Question invalide', code: ERROR_CODES.INVALID });
                return;
            }

            // Vérifier que la question fait partie des questions des cartes proposées
            const proposedCards = currentRound.proposedCards || [currentRound.gameCard];
            const questionExists = proposedCards.some(card => card?.questions?.includes(data.selectedQuestion));
            if (!questionExists) {
                logger.warn(`Question non autorisée sélectionnée`, { lobbyCode: data.lobbyCode, question: data.selectedQuestion });
                socket.emit('error', { message: 'Cette question n\'est pas disponible', code: ERROR_CODES.INVALID });
                return;
            }

            // Stocker la carte contenant la question sélectionnée
            const selectedCard = proposedCards.find(card => card?.questions?.includes(data.selectedQuestion));
            if (selectedCard) {
                currentRound.gameCard = selectedCard;
            }

            // Enregistrer la question sélectionnée et passer à la phase suivante
            currentRound.setSelectedQuestion(data.selectedQuestion);
            currentRound.nextPhase(); // Passe à ANSWERING

            // Broadcast la question à tous les joueurs
            io.to(data.lobbyCode).emit('questionSelected', {
                question: data.selectedQuestion,
                phase: currentRound.phase,
                card: selectedCard
            });
            logger.debug(`Question sélectionnée`, { lobbyCode: data.lobbyCode });
        });
    });

    // Next Round
    socket.on('nextRound', (data) => {
        // requireGame garantit game non-null ; le custom leader-check ci-dessous
        // diffère de requireLeader (message distinct + tolère currentRound absent),
        // il reste donc inline (withGameGuards ≠ withLeaderGuards).
        withGameGuards(socket, data, {
            limiter: rateLimiters.gameAction,
        }, ({ lobby, game }, data) => {
            // Vérifier que c'est le leader du round actuel qui demande le prochain round
            if (game.currentRound && socket.id !== game.currentRound.leader.socketId) {
                socket.emit('error', { message: 'Seul le pilier peut passer au round suivant', code: ERROR_CODES.NOT_LEADER });
                return;
            }

            // Guard de phase : on ne passe au round suivant qu'après REVEAL.
            // Sinon un double-tap peut sauter une phase ou avancer le tour pendant
            // qu'un joueur écrit encore sa réponse.
            if (game.currentRound && game.currentRound.phase !== RoundPhase.REVEAL) {
                logger.debug('nextRound ignoré : phase incorrecte', { lobbyCode: data.lobbyCode, phase: game.currentRound.phase });
                return;
            }

            // Vérifier si le jeu est terminé
            if (game.isGameOver()) {
                endGame(io, data.lobbyCode, lobby, game);
                return;
            }

            // Sinon, passer au round suivant
            game.nextRound();
            if (game.currentRound) {
                io.to(data.lobbyCode).emit('roundStarted', { round: serializeRound(game.currentRound)! });
                logger.game.roundStarted(data.lobbyCode, game.currentRound.roundNumber, game.currentRound.leader.name);
            }
        });
    });

    // Get Game Results (pour EndGame qui arrive après)
    socket.on('getGameResults', (data) => {
        withGameGuards(socket, data, {
            limiter: rateLimiters.general,
            requireLobbyCode: true,
        }, ({ lobby, game }, data) => {
            // Sécurité : seul un membre du lobby peut récupérer les résultats
            const isInRoom = socket.rooms.has(data.lobbyCode);
            const isMember = lobby.players.some(p => p.socketId === socket.id);
            if (!isInRoom && !isMember) {
                logger.warn(`Tentative d'accès non autorisée à getGameResults`, { lobbyCode: data.lobbyCode, socketId: socket.id });
                socket.emit('error', { message: 'Action non autorisée', code: ERROR_CODES.FORBIDDEN });
                return;
            }

            socket.emit('gameEnded', {
                leaderboard: game.getLeaderboard(),
                rounds: serializeRounds(game.rounds)
            });
        });
    });

    // Event: Get Game State (pour récupérer l'état actuel du jeu + reconnexion)
    // withGuards fournit rate-limit + lobbyCode + try/catch interne. La validation de
    // playerId reste dans le corps : elle est OPTIONNELLE (reconnexion sans playerId
    // légitime) donc `requirePlayerId` (inconditionnel) ne convient pas ; on la place
    // AVANT le check game pour préserver l'ordre des erreurs émises.
    socket.on('getGameState', (data: { lobbyCode: string; playerId?: string; reconnectToken?: string }) => {
        withGuards(socket, data, {
            limiter: rateLimiters.general,
            requireLobbyCode: true,
        }, ({ lobby, game }, data) => {
            // Validate playerId if provided
            if (data.playerId) {
                const playerIdValidation = validatePlayerId(data.playerId);
                if (!playerIdValidation.isValid) {
                    socket.emit('error', { message: playerIdValidation.error || 'ID joueur invalide', code: ERROR_CODES.INVALID });
                    return;
                }
            }

            if (!game) {
                socket.emit('error', { message: 'Partie introuvable', code: ERROR_CODES.NOT_FOUND });
                return;
            }

            // Contrôle d'appartenance : n'exposer l'état complet du lobby qu'aux membres
            // (socket déjà dans la room) ou à un joueur prouvant son identité par un
            // playerId correspondant (reconnexion). Sinon, refuser (quiconque a juste le
            // code de salon ne doit pas lire la liste des joueurs / l'état de jeu).
            const isMember = socket.rooms.has(lobby.code)
                || (!!data.playerId && lobby.players.some(p => p.id === data.playerId));
            if (!isMember) {
                socket.emit('error', { message: 'Action non autorisée', code: ERROR_CODES.FORBIDDEN });
                return;
            }

            // Reconnexion: mettre à jour le socketId du joueur
            if (data.playerId) {
                const player = lobby.players.find(p => p.id === data.playerId);
                if (player) {
                    // Ancien socket encore vivant à évincer une fois le slot repris (cf. plus bas).
                    let staleSocket: AppSocket | null = null;

                    // Sécurité anti-prise de contrôle (réassociation du socketId).
                    // On ne contrôle que si le socket courant n'est PAS déjà celui du
                    // joueur (sinon c'est un no-op idempotent : rafraîchissement de l'état).
                    if (player.socketId !== socket.id) {
                        // Chemin sûr : un reconnectToken correspondant au secret du joueur
                        // prouve l'identité → reconnexion autorisée, on contourne la garde
                        // de liveness (le slot lui appartient même si l'ancien socket vit
                        // encore brièvement).
                        const tokenMatches = !!data.reconnectToken
                            && data.reconnectToken === player.reconnectToken;

                        if (!tokenMatches) {
                            // Token absent/erroné : le joueur cible possède un secret défini,
                            // donc une reconnexion non prouvée ne peut JAMAIS reprendre le slot,
                            // même pendant la fenêtre de déconnexion. L'UUID public (playerId)
                            // ne suffit pas — il transite dans des payloads diffusés.
                            logger.warn(`Tentative de prise de contrôle refusée (token absent/invalide)`, {
                                lobbyCode: data.lobbyCode,
                                targetPlayerId: data.playerId,
                                attackerSocketId: socket.id,
                                victimSocketId: player.socketId,
                                tokenProvided: !!data.reconnectToken,
                            });
                            socket.emit('error', { message: 'Reconnexion non autorisée', code: ERROR_CODES.CONFLICT });
                            return;
                        }

                        // Ancien socket encore vu comme vivant. Deux cas se ressemblent :
                        // un vrai double-onglet, et un mobile revenu au premier plan dont
                        // l'ancien socket n'a pas encore expiré côté serveur (pingInterval +
                        // pingTimeout, jusqu'à 45 s). Le token prouve que c'est le
                        // propriétaire : on REPREND le slot et on évince l'ancien socket
                        // (après la réassociation, cf. plus bas). Lui renvoyer l'état « en
                        // lecture seule » sans le joindre à la room laissait un fantôme :
                        // snapshot figé, plus aucun broadcast, actions refusées (socketId ≠),
                        // puis marqué inactif à la mort de l'ancien socket. Double-onglet :
                        // l'onglet visible reprend le slot à chaque `visibilitychange`, et
                        // l'onglet évincé ne se reconnecte pas tout seul (« io server
                        // disconnect » n'est pas retenté par socket.io-client).
                        const existingSocket = io.sockets.sockets.get(player.socketId);
                        if (existingSocket && existingSocket.connected) {
                            staleSocket = existingSocket;
                        }
                    }

                    // Vérifier si une reconnexion est déjà en cours
                    if (registry.hasReconnectionLock(lobby.code, player.name)) {
                        logger.debug(`Reconnexion game déjà en cours pour ${player.name}`);
                        // Ne pas bloquer, juste envoyer l'état actuel sans mise à jour
                    } else {
                        // Acquérir le lock
                        registry.acquireReconnectionLock(lobby.code, player.name);

                        try {
                            const oldSocketId = player.socketId;
                            // Cœur partagé : cancel timeouts + réassociation slot/socket + pilier.
                            reconnectPlayerSlot(registry, lobby, player, socket);

                            logger.info(`Player ${player.name} reconnected to game`, {
                                lobbyCode: data.lobbyCode,
                                oldSocketId,
                                newSocketId: socket.id
                            });

                            // Éviction de l'ancien socket APRÈS la réassociation : son handler
                            // `disconnect` (synchrone) ne retrouve plus son id dans l'index
                            // socket -> lobby (reassignSocket l'a retiré) et n'arme donc aucun
                            // timeout d'inactivité/suppression sur le joueur fraîchement repris.
                            // `disconnect()` sans `close` : déconnexion de namespace, que le
                            // client ne retente pas automatiquement (pas de ping-pong entre
                            // deux onglets).
                            if (staleSocket) {
                                logger.info('Ancien socket évincé (slot repris avec token valide)', {
                                    lobbyCode: data.lobbyCode,
                                    playerId: player.id,
                                    evictedSocketId: staleSocket.id,
                                    newSocketId: socket.id,
                                });
                                staleSocket.disconnect();
                            }

                            // Notifier les autres joueurs
                            io.to(lobby.code).emit('updatePlayersList', { players: serializePlayers(lobby.players) });
                        } finally {
                            // Relâcher le lock
                            registry.releaseReconnectionLock(lobby.code, player.name);
                        }
                    }
                }
            }

            // Données de reconnexion pour restaurer l'état du joueur
            const reconnectionData: ReconnectionData = {
                answeredPlayerIds: answeredIdsFor(game.currentRound)
            };

            // Si le joueur a fourni son ID, envoyer sa réponse s'il en a soumis une
            if (data.playerId && game.currentRound?.answers[data.playerId]) {
                reconnectionData.myAnswer = game.currentRound.answers[data.playerId];
            }

            // Restaurer les guesses (phase GUESSING) : RÉSERVÉ au pilier — les autres
            // joueurs ne doivent pas connaître les attributions en cours — et traduit en
            // slots opaques (jamais l'auteur réel).
            const callerIsLeader = !!game.currentRound && (
                game.currentRound.leader.socketId === socket.id
                || (!!data.playerId && game.currentRound.leader.id === data.playerId)
            );
            if (callerIsLeader && game.currentRound) {
                reconnectionData.currentGuesses = (game.currentRound as Round).currentGuessesBySlot();
            }

            // Restaurer les résultats pour la phase REVEAL
            if (game.currentRound && game.currentRound.phase === RoundPhase.REVEAL) {
                reconnectionData.revealResults = buildRevealResults(lobby, game.currentRound);
                reconnectionData.revealedIndices = game.currentRound.revealedIndices || [];
            }

            socket.emit('gameState', {
                game: serializeGame(lobby),
                players: serializePlayers(lobby.players),
                leaderboard: game.getLeaderboard(),
                reconnectionData
            });
        });
    });

    // Event: Submit Answer
    // withGuards (et non withGameGuards) : la validation de réponse doit s'intercaler
    // ENTRE playerId et le lookup game pour préserver l'ordre des erreurs ; on garde
    // donc le check game dans le corps. Rate-limit multi-clés via extraRateKeys.
    socket.on('submitAnswer', (data) => {
        // Rate limiting avec multiple keys (socket.id + lobbyCode_playerId pour éviter bypass sur reconnexion)
        const extraRateKeys = (data.lobbyCode && data.playerId)
            ? [`${data.lobbyCode}_${data.playerId}_submitAnswer`]
            : [];
        withGuards(socket, data, {
            limiter: rateLimiters.submitAnswer,
            extraRateKeys,
            requirePlayerId: 'playerId',
        }, ({ lobby, game }, data) => {
            // Validate + sanitize (re-check post-sanitize : une entrée de balises HTML
            // passe validateAnswer mais ressort vide ; une réponse vide bloquerait la
            // transition de phase).
            const sanitizedAnswer = validateAndSanitizeAnswer(data.answer);
            if (sanitizedAnswer === null) return;

            if (!game) {
                socket.emit('error', { message: 'Partie introuvable', code: ERROR_CODES.NOT_FOUND });
                return;
            }

            // Update lobby activity
            lobby?.updateActivity();
            if (!game.currentRound) {
                socket.emit('error', { message: 'Round introuvable', code: ERROR_CODES.NOT_FOUND });
                return;
            }
            const player = lobby.getPlayer(data.playerId);
            if (!player) {
                socket.emit('error', { message: 'Joueur introuvable', code: ERROR_CODES.NOT_FOUND });
                return;
            }

            // Vérifier que le socket correspond au joueur (anti-usurpation)
            if (player.socketId !== socket.id) {
                logger.warn(`Tentative d'usurpation: socket ${socket.id} essaie de soumettre pour ${player.name}`);
                socket.emit('error', { message: 'Action non autorisée', code: ERROR_CODES.FORBIDDEN });
                return;
            }

            // Guard de phase : un client malveillant pourrait essayer de spammer submitAnswer
            // hors de la phase ANSWERING. Refuser silencieusement.
            //
            // FENÊTRE DE GRÂCE : le client soumet son brouillon au moment où sa phase
            // bascule, mais le serveur a déjà avancé (son timer est exact, celui du
            // client tick à la seconde). Sans tolérance, une réponse écrite à temps
            // était remplacée par « n'a pas répondu à temps » sous les yeux du joueur.
            // On n'accepte le retardataire que s'il vient écraser CE placeholder : une
            // vraie réponse déjà soumise n'est jamais modifiée hors ANSWERING.
            const isLateSubmission = game.currentRound.phase !== RoundPhase.ANSWERING;
            if (isLateSubmission) {
                const existing = game.currentRound.answers[data.playerId];
                const withinGrace = game.currentRound.phaseEndedAt !== undefined
                    && Date.now() - game.currentRound.phaseEndedAt <= ANSWER_GRACE_PERIOD;
                if (!withinGrace || existing === undefined || !isNoResponse(existing)) {
                    logger.debug('submitAnswer ignoré : phase incorrecte', { lobbyCode: data.lobbyCode, phase: game.currentRound.phase });
                    return;
                }
                logger.debug('submitAnswer accepté en fenêtre de grâce', { lobbyCode: data.lobbyCode, playerId: data.playerId });
            }

            // Réponse déjà présente = édition (overwrite). Autorisé tant que la phase
            // est ANSWERING ; au-delà le guard de phase ci-dessus a déjà rejeté la requête.

            // Vérifier que le joueur n'est pas le pilier (le pilier ne répond pas)
            if (player.id === game.currentRound.leader.id) {
                socket.emit('error', { message: 'Le pilier ne peut pas soumettre de réponse', code: ERROR_CODES.FORBIDDEN });
                return;
            }

            // Ajouter la réponse
            const round = game.currentRound as Round;
            round.addAnswer(data.playerId, sanitizedAnswer);

            // --- Réponse tardive (fenêtre de grâce) ---------------------------------
            // La phase ANSWERING est close. `addAnswer` ci-dessus a déjà remplacé le
            // placeholder « n'a pas répondu à temps » dans `answers` : c'est ce qui
            // compte, le pool de devinette étant dérivé de `answers`.
            //
            // Reste à savoir si ce pool est DÉJÀ construit et diffusé :
            //  - mode Classique : oui (ANSWERING -> GUESSING direct). On corrige le
            //    texte du slot en place — en gardant slotId et ordre, sinon les
            //    attributions déjà posées par le pilier deviendraient invalides — puis
            //    on rediffuse.
            //  - mode « Devine ma réponse » : NON. On est en SUBSTITUTE_ANSWERING, le
            //    pool ne sera construit qu'à `transitionToGuessing`, donc il n'y a
            //    aucun slot à patcher ni rien à rediffuser : il prendra la réponse
            //    corrigée au moment de sa construction. `patchAnswerSlotText` renvoie
            //    false et c'est le comportement attendu, pas un échec.
            //
            // Surtout : on SORT ici. Poursuivre exécuterait la conclusion de phase
            // ci-dessous alors qu'elle a déjà eu lieu — ce qui faisait avancer le round
            // une seconde fois et sautait une phase (en mode « Devine ma réponse », le
            // substitut ne voyait jamais son écran de saisie).
            if (isLateSubmission) {
                const patched = round.patchAnswerSlotText(data.playerId, sanitizedAnswer);
                if (patched) {
                    io.to(data.lobbyCode).emit('shuffledAnswersReceived', {
                        answers: round.getOrderedGuessingAnswers(),
                        players: round.getGuessTargets(lobby.players),
                        roundNumber: round.roundNumber,
                    });
                }
                logger.info('Réponse tardive acceptée (fenêtre de grâce)', {
                    lobbyCode: data.lobbyCode,
                    playerId: data.playerId,
                    phase: round.phase,
                    // false = pool pas encore construit (mode « Devine ma réponse ») :
                    // la réponse est dans `answers`, le pool la prendra à sa création.
                    poolPatched: patched,
                });
                return;
            }

            // Joueurs actifs qui doivent répondre (tous sauf le pilier)
            const respondingPlayers = round.getRespondingPlayers(lobby.players);

            // Notifier tous les joueurs qu'une réponse a été soumise
            io.to(data.lobbyCode).emit('playerAnswered', {
                playerId: data.playerId,
                totalAnswers: Object.keys(round.answers).length,
                expectedAnswers: respondingPlayers.length
            });

            logger.debug(`Réponse soumise par ${player.name}`, { lobbyCode: data.lobbyCode, answers: Object.keys(round.answers).length });

            // Vérifier si tous les joueurs ACTIFS (sauf le pilier) ont répondu.
            // Tester `!== undefined` plutôt que la truthiness : une réponse non vide est
            // déjà garantie par le re-check post-sanitize ci-dessus, mais on reste robuste.
            const allActiveAnswered = respondingPlayers.every(p => round.answers[p.id] !== undefined);

            if (allActiveAnswered) {
                // Ajouter NO_RESPONSE pour les joueurs INACTIFS (hors pilier) qui n'ont pas répondu
                const inactivePlayers = lobby.players.filter(p => !p.isActive && p.id !== round.leader.id);
                const filled = round.fillMissingAnswers(inactivePlayers, "s'est déconnecté");
                for (const inactivePlayer of filled) {
                    logger.debug(`Réponse auto ajoutée pour joueur inactif ${inactivePlayer.name}`);
                }

                finishAnsweringPhase(io, data.lobbyCode, lobby, round, false);
                logger.info(`Toutes les réponses soumises, passage à la phase suivante`, { lobbyCode: data.lobbyCode, guessMyAnswerMode: round.guessMyAnswerMode });
            }
        });
    });

    // Retirer sa réponse pour la modifier (phase ANSWERING)
    // Laissé inline volontairement : son catch LOG sans émettre d'erreur au client
    // (best-effort silencieux). withGuards émettrait toujours INTERNAL (ou onReject)
    // sur exception ET supprimerait l'emit RATE_LIMITED si on neutralisait via onReject :
    // aucune combinaison de garde ne reproduit « emit rate-limit mais silence sur throw ».
    socket.on('withdrawAnswer', (data) => {
        try {
            if (!rateLimiters.gameAction.isAllowed(socket.id)) {
                socket.emit('error', { message: 'Trop de requêtes. Veuillez patienter.', code: ERROR_CODES.RATE_LIMITED });
                return;
            }

            const lobby = LobbyManager.getLobby(data.lobbyCode);
            const game = lobby?.game;
            if (!game?.currentRound) return;
            lobby?.updateActivity();

            const player = lobby?.getPlayer(data.playerId);
            if (!player) return;

            // Anti-usurpation : le socket doit correspondre au joueur
            if (player.socketId !== socket.id) {
                logger.warn(`Tentative d'usurpation withdrawAnswer: socket ${socket.id} pour ${player.name}`);
                return;
            }

            // Uniquement pendant ANSWERING (au-delà la réponse est verrouillée)
            if (game.currentRound.phase !== RoundPhase.ANSWERING) return;
            if (!game.currentRound.answers[data.playerId]) return;

            game.currentRound.removeAnswer(data.playerId);

            const respondingPlayers = (game.currentRound as Round).getRespondingPlayers(lobby!.players);
            io.to(data.lobbyCode).emit('playerUnanswered', {
                playerId: data.playerId,
                totalAnswers: Object.keys(game.currentRound.answers).length,
                expectedAnswers: respondingPlayers.length
            });

            logger.debug(`Réponse retirée par ${player.name} (édition)`, { lobbyCode: data.lobbyCode, answers: Object.keys(game.currentRound.answers).length });
        } catch (error) {
            logger.error('Error withdrawing answer', { error: errMessage(error) });
        }
    });

    // Select Substitute (Pilier choisit le joueur qui répondra pour lui en mode "Devine ma réponse")
    socket.on('selectSubstitute', (data) => {
        withLeaderGuards(socket, data, {
            limiter: rateLimiters.gameAction,
            requireLobbyCode: true,
            requireLeaderAction: 'choisir le substitut',
        }, ({ lobby, round: currentRound }, data) => {
            if (!currentRound.guessMyAnswerMode) {
                socket.emit('error', { message: 'Mode "Devine ma réponse" inactif', code: ERROR_CODES.WRONG_PHASE });
                return;
            }
            if (currentRound.phase !== RoundPhase.SUBSTITUTE_SELECTION) {
                socket.emit('error', { message: 'Phase incorrecte pour cette action', code: ERROR_CODES.WRONG_PHASE });
                return;
            }

            const playerIdValidation = validatePlayerId(data.substitutePlayerId);
            if (!playerIdValidation.isValid) {
                socket.emit('error', { message: playerIdValidation.error || 'ID joueur invalide', code: ERROR_CODES.INVALID });
                return;
            }

            const substitute = lobby.getPlayer(data.substitutePlayerId);
            if (!substitute || !substitute.isActive) {
                socket.emit('error', { message: 'Joueur substitut introuvable ou inactif', code: ERROR_CODES.NOT_FOUND });
                return;
            }
            if (substitute.id === currentRound.leader.id) {
                socket.emit('error', { message: 'Le pilier ne peut pas être son propre substitut', code: ERROR_CODES.INVALID });
                return;
            }

            currentRound.setSubstitutePlayer(substitute.id);
            currentRound.nextPhase();
            io.to(data.lobbyCode).emit('substituteSelected', {
                substitutePlayerId: substitute.id,
                phase: currentRound.phase,
            });
            logger.info('Substitut sélectionné', { lobbyCode: data.lobbyCode, substitutePlayerId: substitute.id });
        });
    });

    // Submit Substitute Answer (le substitut soumet la réponse au nom du pilier)
    // withGuards (pas withGameGuards) : la validation de réponse précède le lookup
    // game (ordre des erreurs préservé). Pas leader-only (c'est le substitut qui soumet).
    socket.on('submitSubstituteAnswer', (data) => {
        withGuards(socket, data, {
            limiter: rateLimiters.submitAnswer,
            requireLobbyCode: true,
        }, ({ lobby, game }, data) => {
            // Re-check post-sanitize : une réponse vide (balises seules) ferait
            // disparaître l'entrée du pilier du pool de devinette.
            const sanitizedAnswer = validateAndSanitizeAnswer(data.answer);
            if (sanitizedAnswer === null) return;

            if (!game || !game.currentRound) {
                socket.emit('error', { message: 'Partie introuvable', code: ERROR_CODES.NOT_FOUND });
                return;
            }
            const currentRound = game.currentRound as Round;

            if (!currentRound.guessMyAnswerMode) {
                socket.emit('error', { message: 'Mode "Devine ma réponse" inactif', code: ERROR_CODES.WRONG_PHASE });
                return;
            }
            // Fenêtre de grâce, symétrique à celle de `submitAnswer` : le substitut
            // soumet son brouillon au moment où sa phase bascule (filet de démontage
            // de SubstituteAnsweringPhase), mais le serveur a déjà avancé — son timer
            // est exact, celui du client tick à la seconde. Sans tolérance, la réponse
            // écrite à temps était perdue et le PILIER héritait d'un « n'a pas répondu
            // à temps » à la place de sa propre réponse. On n'accepte le retardataire
            // que si rien de valable n'a encore été enregistré (aucune réponse, ou le
            // seul placeholder auto) : une vraie réponse n'est jamais écrasée.
            const isLateSubstitute = currentRound.phase !== RoundPhase.SUBSTITUTE_ANSWERING;
            if (isLateSubstitute) {
                const existing = currentRound.substituteAnswer;
                const withinGrace = currentRound.phaseEndedAt !== undefined
                    && Date.now() - currentRound.phaseEndedAt <= ANSWER_GRACE_PERIOD;
                if (!withinGrace || (existing != null && !isNoResponse(existing))) {
                    socket.emit('error', { message: 'Phase incorrecte pour cette action', code: ERROR_CODES.WRONG_PHASE });
                    return;
                }
            }
            if (!currentRound.substitutePlayerId) {
                socket.emit('error', { message: 'Aucun substitut désigné', code: ERROR_CODES.WRONG_PHASE });
                return;
            }

            const substitute = lobby.getPlayer(currentRound.substitutePlayerId);
            if (!substitute || substitute.socketId !== socket.id) {
                socket.emit('error', { message: 'Seul le substitut peut soumettre cette réponse', code: ERROR_CODES.FORBIDDEN });
                return;
            }
            // Une vraie réponse déjà enregistrée n'est jamais écrasée. En fenêtre de
            // grâce, seul le placeholder auto (« n'a pas répondu à temps ») peut l'être :
            // c'est précisément ce qu'on vient corriger.
            if (currentRound.substituteAnswer != null && !isNoResponse(currentRound.substituteAnswer)) {
                socket.emit('error', { message: 'Réponse déjà soumise', code: ERROR_CODES.CONFLICT });
                return;
            }

            currentRound.setSubstituteAnswer(sanitizedAnswer);

            // --- Réponse tardive (fenêtre de grâce) -------------------------------
            // La phase a déjà basculé vers GUESSING : la transition a eu lieu et le
            // pool a été construit avec le placeholder. On corrige le texte du slot du
            // PILIER (c'est en son nom que le substitut écrit) en gardant slotId et
            // ordre, puis on rediffuse. Surtout : on SORT ici — rappeler
            // `transitionToGuessing` ferait avancer le round une 2e fois (GUESSING ->
            // REVEAL) et le pilier n'attribuerait jamais rien.
            if (isLateSubstitute) {
                if (currentRound.patchAnswerSlotText(currentRound.leader.id, sanitizedAnswer)) {
                    io.to(data.lobbyCode).emit('shuffledAnswersReceived', {
                        answers: currentRound.getOrderedGuessingAnswers(),
                        players: currentRound.getGuessTargets(lobby.players),
                        roundNumber: currentRound.roundNumber,
                    });
                }
                logger.info('Réponse tardive du substitut acceptée (fenêtre de grâce)', {
                    lobbyCode: data.lobbyCode,
                    phase: currentRound.phase,
                });
                return;
            }

            io.to(data.lobbyCode).emit('substituteAnswerSubmitted', {
                phase: RoundPhase.GUESSING,
            });
            transitionToGuessing(io, data.lobbyCode, lobby, currentRound, false);
            logger.info('Réponse du substitut soumise, passage à GUESSING', { lobbyCode: data.lobbyCode });
        });
    });

    // Request Shuffled Answers (N'importe quel joueur peut demander les réponses mélangées)
    // withGuards (pas withGameGuards) : exige game ET round non-null avec le message
    // spécifique "Partie ou round introuvable" — on garde donc le check dans le corps.
    socket.on('requestShuffledAnswers', (data) => {
        withGuards(socket, data, {
            limiter: rateLimiters.general,
        }, ({ lobby, game }) => {
            if (!game || !game.currentRound) {
                socket.emit('error', { message: 'Partie ou round introuvable', code: ERROR_CODES.NOT_FOUND });
                return;
            }

            // Réponses dans l'ordre stable du round (réutilise l'ordre stocké en
            // reconnexion, sinon mélange une 1re fois) — incl. la réponse du substitut.
            const round = game.currentRound as Round;
            const orderedAnswers = round.getOrderedGuessingAnswers();

            // En mode remote, broadcaster à toute la room; sinon seulement au pilier
            const shuffledPayload = {
                answers: orderedAnswers,
                players: round.getGuessTargets(lobby.players),
                roundNumber: round.roundNumber
            };
            if (lobby.gameMode === 'remote') {
                io.to(lobby.code).emit('shuffledAnswersReceived', shuffledPayload);
            } else {
                socket.emit('shuffledAnswersReceived', shuffledPayload);
            }
        });
    });

    // Update Guess (Pilier déplace une réponse - BROADCAST en temps réel)
    socket.on('updateGuess', (data) => {
        // Rate limiting avec multiple keys (socket.id + lobbyCode pour éviter bypass sur reconnexion)
        const extraRateKeys = data.lobbyCode ? [`${data.lobbyCode}_leader_updateGuess`] : [];
        withLeaderGuards(socket, data, {
            limiter: rateLimiters.updateGuess,
            extraRateKeys,
            requireLobbyCode: true,
            requireLeaderAction: 'modifier les attributions',
            // Guard de phase : updateGuess n'a de sens qu'en GUESSING.
            requirePhase: RoundPhase.GUESSING,
        }, ({ lobby, round }, data) => {
            const currentRound = round;

            // Validation stricte : answerId est un SLOT opaque -> doit exister dans le round.
            const slotIds = round.getSlotIds();
            if (typeof data.answerId !== 'string' || !slotIds.has(data.answerId)) {
                return;
            }
            if (data.playerId !== null) {
                if (typeof data.playerId !== 'string') return;
                const validTargets = round.getGuessTargets(lobby.players);
                if (!validTargets.some(p => p.id === data.playerId)) return;
            }

            // Slot opaque -> auteur réel : l'état interne reste indexé par auteur
            // (non corrélable depuis le client, qui ne voit que les slots).
            const authorId = round.authorForSlot(data.answerId);
            if (!authorId) return;
            currentRound.updateCurrentGuess(authorId, data.playerId);

            // BROADCASTER le delta seulement (pas l'état complet pour économiser la bande passante)
            io.to(data.lobbyCode).emit('guessUpdated', {
                answerId: data.answerId,
                playerId: data.playerId
                // Note: currentGuesses retiré - le client reconstruit l'état à partir des deltas
            });
        });
    });

    // Submit Guesses (Pilier valide ses choix finaux)
    socket.on('submitGuesses', (data) => {
        // Rate limiting avec multiple keys (socket.id + lobbyCode pour éviter bypass sur reconnexion)
        const extraRateKeys = data.lobbyCode ? [`${data.lobbyCode}_leader_submitGuesses`] : [];
        withLeaderGuards(socket, data, {
            limiter: rateLimiters.submitGuesses,
            extraRateKeys,
            requireLeaderAction: 'valider les attributions',
            // Guard de phase : submitGuesses n'est valide qu'en GUESSING. Évite qu'un
            // double-tap du pilier (ou un client malveillant) déclenche la transition
            // vers REVEAL plusieurs fois.
            requirePhase: RoundPhase.GUESSING,
        }, ({ lobby, game, round }, data) => {
            const currentRound = round;

            // Valider et filtrer les guesses (Sets pour lookups O(1))
            // En mode "Devine ma réponse" : la réponse du substitut (clé = leader.id) est un answer
            // valide ET le pilier est une cible draggable valide.
            const playerIds = new Set(round.getGuessTargets(lobby.players).map(p => p.id));

            // Les clés reçues sont des SLOTS opaques -> traduction en auteur réel (clé
            // interne de scoring). Slot inconnu ou cible invalide => ignoré.
            const validGuesses: Record<string, string> = {};
            for (const [slotId, guessedPlayerId] of Object.entries(data.guesses)) {
                if (typeof guessedPlayerId !== 'string') continue;

                const authorId = round.authorForSlot(slotId);
                if (!authorId) {
                    logger.warn(`Guess invalide: slot ${slotId} inexistant`);
                    continue;
                }
                if (!playerIds.has(guessedPlayerId)) {
                    logger.warn(`Guess invalide: playerId ${guessedPlayerId} inexistant ou est le pilier`);
                    continue;
                }

                validGuesses[authorId] = guessedPlayerId;
            }

            // Contrainte : un joueur peut être attribué à au plus une réponse
            const guessedIds = Object.values(validGuesses);
            if (new Set(guessedIds).size !== guessedIds.length) {
                socket.emit('error', { message: 'Un joueur ne peut être attribué qu\'à une seule réponse.', code: ERROR_CODES.INVALID });
                return;
            }

            // Enregistrer les attributions finales, puis conclure GUESSING → REVEAL
            // (calcul des scores + avance de phase + diffusion revealResults), mutualisé
            // avec l'expiration du timer (handleGuessingTimeout).
            currentRound.submitGuesses(validGuesses);
            finishGuessing(io, data.lobbyCode, lobby, game, currentRound, false);

            logger.info(`Attributions validées`, { lobbyCode: data.lobbyCode, leaderScore: currentRound.scores[currentRound.leader.id] || 0 });
        });
    });

    // Reveal Answer (Pilier révèle une réponse spécifique)
    socket.on('revealAnswer', (data: { lobbyCode: string; answerIndex: number }) => {
        withLeaderGuards(socket, data, {
            limiter: rateLimiters.revealAnswer,
            requireLeaderAction: 'révéler les réponses',
            // Guard de phase : revealAnswer n'a de sens qu'en REVEAL.
            requirePhase: RoundPhase.REVEAL,
        }, ({ lobby, round: currentRound }, data) => {
            // Validation stricte : answerIndex doit être un entier dans [0, totalAnswers)
            const totalAnswers = Object.keys(currentRound.getGuessingAnswers()).length;
            if (
                typeof data.answerIndex !== 'number' ||
                !Number.isInteger(data.answerIndex) ||
                data.answerIndex < 0 ||
                data.answerIndex >= totalAnswers
            ) {
                return;
            }

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

            // Détecter la similarité AVANT d'émettre answerRevealed afin que le
            // client traite la similarité en premier (sinon la carte du joueur
            // s'allume brièvement et perd son clignotement avant que le modal
            // n'apparaisse).
            let similarityPayload: { answerIndex: number; guessedPlayerName: string; playerName: string } | null = null;
            const results = buildRevealResults(lobby, currentRound);
            const result = results[data.answerIndex];
            if (result && !result.correct) {
                const guessedPlayerAnswer = results.find(r => r.playerId === result.guessedPlayerId)?.answer;
                // isSimilarPair = gardes NO_RESPONSE_PREFIX + areAnswersSimilar (cf. confirmSimilarity).
                if (guessedPlayerAnswer && isSimilarPair(result.answer, guessedPlayerAnswer)) {
                    similarityPayload = {
                        answerIndex: data.answerIndex,
                        guessedPlayerName: result.guessedPlayerName,
                        playerName: result.playerName
                    };
                }
            }

            if (similarityPayload) {
                io.to(data.lobbyCode).emit('similarityDetected', similarityPayload);
            }

            io.to(data.lobbyCode).emit('answerRevealed', {
                revealedIndex: data.answerIndex,
                revealedIndices: currentRound.revealedIndices
            });
        });
    });

    // Advance Reveal Cursor (mode remote - relayer aux spectateurs)
    socket.on('advanceRevealCursor', (data: { lobbyCode: string; nextIndex: number }) => {
        withLeaderGuards(socket, data, {
            limiter: rateLimiters.gameAction,
            requireLeaderAction: 'avancer le curseur',
        }, ({ round: currentRound }, data) => {
            const totalAnswers = Object.keys(currentRound.getGuessingAnswers()).length;
            // nextIndex doit être un entier dans [-1, totalAnswers) (-1 = fin du reveal)
            if (
                typeof data.nextIndex !== 'number' ||
                !Number.isInteger(data.nextIndex) ||
                data.nextIndex < -1 ||
                data.nextIndex >= totalAnswers
            ) {
                return;
            }
            io.to(data.lobbyCode).emit('revealCursorAdvanced', { nextIndex: data.nextIndex });
        });
    });

    // Confirm Similarity (Le pilier confirme que deux réponses similaires sont identiques)
    socket.on('confirmSimilarity', (data: { lobbyCode: string; answerIndex: number }) => {
        withLeaderGuards(socket, data, {
            limiter: rateLimiters.gameAction,
            requireLeaderAction: 'confirmer la similarité',
        }, ({ game, round: currentRound }, data) => {
            // Vérifier que c'est la phase REVEAL
            if (currentRound.phase !== RoundPhase.REVEAL) {
                socket.emit('error', { message: 'Action non autorisée en dehors de la phase de révélation.', code: ERROR_CODES.WRONG_PHASE });
                return;
            }

            // Vérifier que l'index a été révélé
            if (!currentRound.revealedIndices?.includes(data.answerIndex)) {
                socket.emit('error', { message: 'Cette réponse n\'a pas encore été révélée.', code: ERROR_CODES.WRONG_PHASE });
                return;
            }

            // Vérifier que l'index n'a pas déjà été corrigé
            if (currentRound.similarityCorrections?.includes(data.answerIndex)) {
                return; // Déjà corrigé, ignorer
            }

            // Vérifier que la réponse était incorrecte
            // Utiliser getGuessingAnswers() pour inclure l'entrée du pilier en mode "Devine ma réponse"
            const answerEntries = Object.entries(currentRound.getGuessingAnswers());
            if (data.answerIndex >= answerEntries.length) return;
            const [playerId, playerAnswer] = answerEntries[data.answerIndex];
            const guessedPlayerId = currentRound.guesses[playerId];
            if (guessedPlayerId === playerId) return; // Déjà correcte

            // SÉCURITÉ : ne pas faire confiance au client. Recalculer la
            // similarité côté serveur avant d'accorder le point bonus via le prédicat
            // partagé isSimilarPair (gardes NO_RESPONSE_PREFIX + areAnswersSimilar),
            // identique à revealAnswer.
            const guessedAnswer = guessedPlayerId ? answerEntries.find(([id]) => id === guessedPlayerId)?.[1] : undefined;
            if (!guessedAnswer || !isSimilarPair(playerAnswer, guessedAnswer)) {
                logger.warn('confirmSimilarity rejeté : paire non similaire côté serveur', { lobbyCode: data.lobbyCode, answerIndex: data.answerIndex });
                return;
            }

            // Ajouter la correction et le point bonus
            if (!currentRound.similarityCorrections) currentRound.similarityCorrections = [];
            currentRound.similarityCorrections.push(data.answerIndex);
            currentRound.addBonusScore(currentRound.leader.id, 1);

            // Broadcaster la confirmation
            io.to(data.lobbyCode).emit('similarityConfirmed', {
                answerIndex: data.answerIndex,
                correctedScore: currentRound.scores[currentRound.leader.id] || 0,
                leaderboard: game.getLeaderboard()
            });

            logger.info('Similarité confirmée', { lobbyCode: data.lobbyCode, answerIndex: data.answerIndex });
        });
    });

    // Dismiss Similarity (Le pilier rejette la similarité)
    socket.on('dismissSimilarity', (data: { lobbyCode: string; answerIndex: number }) => {
        withLeaderGuards(socket, data, {
            limiter: rateLimiters.gameAction,
            requireLeaderAction: 'rejeter la similarité',
        }, (_resolved, data) => {
            // Broadcaster le rejet pour fermer le modal chez tout le monde
            io.to(data.lobbyCode).emit('similarityDismissed', {
                answerIndex: data.answerIndex
            });
        });
    });
}
