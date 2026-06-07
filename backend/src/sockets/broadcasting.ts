import { randomInt } from 'crypto';
import { Server, Socket } from 'socket.io';
import * as LobbyManager from '../managers/LobbyManager';
import {
    getDecksCatalog,
    getDecksCatalogWithMeta,
} from '../data/questionsRepository.js';
import { Lobby } from '../models/Lobby';
import { Round } from '../models/Round';
import { Game } from '../models/Game';
// `IRound` (shared) = vue publique projetée vers les clients ; `ServerRound` = contrat
// serveur complet (méthodes métier + bookkeeping) porté par la classe Round.
import type { IRound as ServerRound } from '../types/IRound';
import type { ServerToClientEvents, ClientToServerEvents, IGame, IRound, IPlayer } from '@onskone/shared';
import { RoundPhase, GameStatus, formatNoResponse } from '@onskone/shared';
import logger from '../utils/logger.js';

export type IoServer = Server<ClientToServerEvents, ServerToClientEvents>;
export type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

/**
 * Projette un joueur vers la VUE PUBLIQUE diffusée aux clients (anti-fuite).
 *
 * On construit explicitement un nouvel objet ne contenant QUE les champs publics :
 * `socketId` (id de connexion serveur) et `reconnectToken` (secret de reconnexion)
 * sont des données SERVER-ONLY et ne doivent JAMAIS quitter le serveur via un
 * broadcast. Diffuser le socketId permettrait à un tiers de cibler/usurper une
 * connexion ; diffuser le reconnectToken annulerait toute la garde anti-usurpation.
 */
export function serializePlayer(p: IPlayer): IPlayer {
    return {
        id: p.id,
        name: p.name,
        isHost: p.isHost,
        score: p.score,
        isActive: p.isActive,
        avatarId: p.avatarId,
    };
}

/**
 * Projette une liste de joueurs vers la vue publique (cf. serializePlayer).
 */
export function serializePlayers(players: IPlayer[]): IPlayer[] {
    return players.map(serializePlayer);
}

export interface RevealResult {
    playerId: string;
    playerName: string;
    playerAvatarId: number;
    answer: string;
    guessedPlayerId: string;
    guessedPlayerName: string;
    guessedPlayerAvatarId: number;
    correct: boolean;
}

/**
 * Construit les résultats de révélation à partir des réponses et attributions du round courant.
 */
export function buildRevealResults(
    lobby: ReturnType<typeof LobbyManager.getLobby>,
    round: ServerRound | null,
): RevealResult[] {
    if (!lobby || !round) return [];

    const corrections = round.similarityCorrections || [];

    // Source unique du pool de réponses révélées : getGuessingAnswers() inclut déjà
    // la réponse du substitut (clé = pilier) en mode "Devine ma réponse". Réutiliser
    // cette projection garantit que l'index utilisé ici reste aligné avec celui de la
    // phase GUESSING au lieu de reconstruire le pool à la main.
    const answersForReveal = round.getGuessingAnswers();

    return Object.entries(answersForReveal).map(([playerId, answer], index) => {
        const guessedPlayerId = round.guesses[playerId];
        const player = lobby.getPlayer(playerId);
        const guessedPlayer = guessedPlayerId ? lobby.getPlayer(guessedPlayerId) : null;

        return {
            playerId,
            playerName: player?.name || 'Unknown',
            playerAvatarId: player?.avatarId ?? 0,
            answer,
            guessedPlayerId: guessedPlayerId || '',
            guessedPlayerName: guessedPlayer?.name || 'Aucun',
            guessedPlayerAvatarId: guessedPlayer?.avatarId ?? 0,
            correct: guessedPlayerId === playerId || corrections.includes(index),
        };
    });
}

/**
 * Projette une instance `Round` (qui porte tout le bookkeeping serveur) vers la
 * VUE PUBLIQUE `IRound` envoyée aux clients (anti-fuite).
 *
 * On construit explicitement un nouvel objet ne contenant QUE les champs publics :
 * renvoyer l'instance brute laisserait fuiter `answers` du round en cours (qui-a-écrit-quoi),
 * `guesses`, `currentGuesses`, `shuffledAnswerIds`, le pool de cartes, etc., même si le
 * type compile. La projection garantit l'absence de fuite au runtime.
 */
export function serializeRound(round: IGame['currentRound'] | null): IRound | null {
    if (!round) return null;
    return {
        roundNumber: round.roundNumber,
        leader: round.leader,
        gameCard: round.gameCard,
        phase: round.phase,
        selectedQuestion: round.selectedQuestion,
        // Anti-fuite : la map `answers` (qui-a-écrit-quoi) et la réponse du
        // substitut ne sont exposées qu'en phase REVEAL. Avant (ANSWERING/GUESSING), les
        // diffuser permettrait à un client reconnecté/modifié de relier chaque réponse à
        // son auteur (et de scorer 100%). Les rounds terminés (historique) restent en
        // phase REVEAL, donc gameEnded.rounds conserve les données complètes pour les stats.
        answers: round.phase === RoundPhase.REVEAL ? round.answers : {},
        scores: round.scores,
        revealedIndices: round.revealedIndices,
        guessMyAnswerMode: round.guessMyAnswerMode,
        substitutePlayerId: round.substitutePlayerId,
        substituteAnswer: round.phase === RoundPhase.REVEAL ? round.substituteAnswer : null,
    };
}

/**
 * Projette une liste de rounds vers la vue publique (pour `gameEnded.rounds`).
 */
export function serializeRounds(rounds: IGame['rounds']): IRound[] {
    return rounds.map(r => serializeRound(r)!);
}

/**
 * Construit le payload `IGame` sérialisable envoyé aux clients
 * (sans référence circulaire, et projeté vers la vue publique des rounds).
 */
export function serializeGame(lobby: Lobby): IGame {
    const game = lobby.game!;
    return {
        lobby: {
            code: lobby.code,
            // Anti-fuite : projeter les joueurs vers la vue publique (omet socketId
            // ET reconnectToken). serializeGame est diffusé à toute la room.
            players: serializePlayers(lobby.players),
            selectedDecks: lobby.selectedDecks,
            gameMode: lobby.gameMode,
            guessMyAnswerMode: lobby.guessMyAnswerMode,
            timeMultiplier: lobby.timeMultiplier,
            locale: lobby.locale,
        },
        currentRound: serializeRound(game.currentRound),
        status: game.status,
        rounds: game.rounds.map(r => serializeRound(r)!),
    };
}

/**
 * Broadcast l'état des decks/mode du lobby à toute la room (ou au socket si fourni).
 */
export function emitLobbyDecksState(
    io: IoServer,
    target: AppSocket | null,
    lobby: Lobby,
): void {
    const payload = {
        catalog: getDecksCatalog(lobby.locale),
        catalogWithMeta: getDecksCatalogWithMeta(lobby.locale),
        selected: lobby.selectedDecks,
        gameMode: lobby.gameMode,
        guessMyAnswerMode: lobby.guessMyAnswerMode,
        timeMultiplier: lobby.timeMultiplier,
        locale: lobby.locale,
    };
    if (target) {
        target.emit('lobbyDecksState', payload);
    } else {
        io.to(lobby.code).emit('lobbyDecksState', payload);
    }
}

/**
 * Termine proprement une partie : passe le Game en FINISHED, désactive tous les
 * joueurs (ils devront cliquer sur "Rejouer") et diffuse `gameEnded` à la room.
 * Centralise la séquence dupliquée dans nextRound et la gestion de déconnexion du
 * pilier.
 */
export function endGame(io: IoServer, lobbyCode: string, lobby: Lobby, game: Game): void {
    // Désarmer le timeout serveur éventuellement encore armé sur le round courant :
    // sinon, en cas de fin de partie déclenchée pendant une phase chronométrée (skip
    // pilier), le setTimeout survivrait, passerait la garde d'identité de round (même
    // round) et émettrait des events fantômes à des clients déjà sur l'écran de fin.
    (game.currentRound as Round | null)?.clearServerTimer();
    game.end();
    lobby.players.forEach(p => p.isActive = false);
    io.to(lobbyCode).emit('gameEnded', {
        leaderboard: game.getLeaderboard(),
        rounds: serializeRounds(game.rounds),
    });
    logger.game.ended(lobbyCode);
}

/**
 * Transition centralisée vers la phase GUESSING : avance la phase, construit le pool
 * (incl. la réponse du substitut), mélange, mémorise les ids et diffuse les events.
 */
export function transitionToGuessing(io: IoServer, lobbyCode: string, lobby: Lobby, currentRound: Round, forced: boolean): void {
    currentRound.nextPhase();
    // prepareGuessing() construit le pool (incl. réponse du substitut), le mélange et
    // mémorise l'ordre dans shuffledAnswerIds (pour la reconnexion).
    const shuffledAnswers = currentRound.prepareGuessing();
    io.to(lobbyCode).emit('allAnswersSubmitted', {
        phase: currentRound.phase,
        answersCount: shuffledAnswers.length,
        forced,
    });
    io.to(lobbyCode).emit('shuffledAnswersReceived', {
        answers: shuffledAnswers,
        players: currentRound.getGuessTargets(lobby.players),
        roundNumber: currentRound.roundNumber,
    });
}

/**
 * Conclusion commune de la phase ANSWERING (partagée entre la dernière réponse
 * soumise et l'expiration du timer) : en mode "Devine ma réponse"
 * on passe à SUBSTITUTE_ANSWERING (le substitut écrit pour le pilier), sinon on
 * enchaîne directement sur GUESSING.
 */
export function finishAnsweringPhase(io: IoServer, lobbyCode: string, lobby: Lobby, currentRound: Round, forced: boolean): void {
    if (currentRound.guessMyAnswerMode) {
        // Passe à SUBSTITUTE_ANSWERING (le substitut écrit maintenant la réponse du pilier)
        currentRound.nextPhase();
        io.to(lobbyCode).emit('allAnswersSubmitted', {
            phase: currentRound.phase,
            answersCount: Object.keys(currentRound.answers).length,
            forced,
        });
        return;
    }

    transitionToGuessing(io, lobbyCode, lobby, currentRound, forced);
}

// ===== EXPIRATION DES TIMERS DE PHASE =====

/**
 * Expiration du timer en phase QUESTION_SELECTION : auto-sélectionne une question
 * au hasard si le pilier n'a pas choisi.
 */
function handleQuestionSelectionTimeout(io: IoServer, lobbyCode: string, currentRound: Round): void {
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
        auto: true,
        card: proposedCard,
    });
    logger.info(`Question auto-sélectionnée`, { lobbyCode });
}

/**
 * Expiration du timer en phase ANSWERING : ajoute des réponses "pas de réponse"
 * automatiques puis enchaîne sur GUESSING (ou SUBSTITUTE_ANSWERING en mode "Devine ma réponse").
 */
function handleAnsweringTimeout(io: IoServer, lobbyCode: string, lobby: Lobby, currentRound: Round): void {
    // Réponses auto pour les joueurs qui n'ont pas répondu (hors pilier)
    const nonLeaders = lobby.players.filter(p => p.id !== currentRound.leader.id);
    const filled = currentRound.fillMissingAnswers(nonLeaders, "n'a pas répondu à temps");
    for (const player of filled) {
        logger.debug(`Réponse auto ajoutée pour ${player.name}`);
    }

    finishAnsweringPhase(io, lobbyCode, lobby, currentRound, true);
}

/**
 * Expiration du timer en phase SUBSTITUTE_SELECTION : auto-sélectionne le premier
 * joueur éligible (hors pilier).
 */
function handleSubstituteSelectionTimeout(io: IoServer, lobbyCode: string, lobby: Lobby, currentRound: Round): void {
    if (currentRound.substitutePlayerId) {
        currentRound.nextPhase();
        return;
    }
    const candidates = lobby.players.filter(p => p.isActive && p.id !== currentRound.leader.id);
    if (candidates.length === 0) {
        logger.warn('Aucun candidat substitut disponible', { lobbyCode });
        return;
    }
    const chosen = candidates[0];
    currentRound.setSubstitutePlayer(chosen.id);
    currentRound.nextPhase();
    io.to(lobbyCode).emit('substituteSelected', {
        substitutePlayerId: chosen.id,
        phase: currentRound.phase,
        auto: true,
    });
    logger.info('Substitut auto-sélectionné', { lobbyCode, substitutePlayerId: chosen.id });
}

/**
 * Expiration du timer en phase SUBSTITUTE_ANSWERING : si le substitut n'a rien soumis,
 * enregistre une réponse "pas de réponse" puis passe à GUESSING.
 */
function handleSubstituteAnsweringTimeout(io: IoServer, lobbyCode: string, lobby: Lobby, currentRound: Round): void {
    if (currentRound.substituteAnswer === null || currentRound.substituteAnswer === undefined) {
        const substituteName = lobby.players.find(p => p.id === currentRound.substitutePlayerId)?.name ?? 'Substitut';
        currentRound.setSubstituteAnswer(formatNoResponse(substituteName, "n'a pas répondu à temps"));
    }
    io.to(lobbyCode).emit('substituteAnswerSubmitted', {
        phase: RoundPhase.GUESSING,
        forced: true,
    });
    transitionToGuessing(io, lobbyCode, lobby, currentRound, true);
}

/**
 * Expiration du timer en phase GUESSING : valide les attributions courantes et passe à REVEAL.
 */
function handleGuessingTimeout(io: IoServer, lobbyCode: string, lobby: Lobby, game: Game, currentRound: Round): void {
    // Filtrer les guesses non assignés ET dédupliquer : un joueur ne peut être attribué
    // qu'à une seule réponse (cohérent avec le handler interactif submitGuesses, qui rejette
    // les doublons). Le chemin timer ne peut pas rejeter -> on garde la 1re attribution.
    const seenPlayers = new Set<string>();
    const validGuesses: Record<string, string> = {};
    for (const [answerId, playerId] of Object.entries(currentRound.currentGuesses)) {
        if (playerId === null || playerId === undefined) continue;
        if (seenPlayers.has(playerId)) continue;
        seenPlayers.add(playerId);
        validGuesses[answerId] = playerId;
    }
    currentRound.submitGuesses(validGuesses);
    currentRound.calculateScores();
    currentRound.nextPhase();

    const results = buildRevealResults(lobby, currentRound);

    io.to(lobbyCode).emit('revealResults', {
        phase: currentRound.phase,
        results,
        scores: currentRound.scores,
        leaderboard: game.getLeaderboard(),
        forced: true,
    });
}

/**
 * Exécute la logique d'expiration de phase, gardée contre le double-traitement.
 * Source unique appelée à la fois par l'événement `timerExpired` du pilier
 * (optimisation de réactivité) et par le timeout serveur autoritatif,
 * de sorte qu'un pilier throttlé en arrière-plan ne fige plus le round pour tous.
 */
export function processTimerExpiration(io: IoServer, lobbyCode: string, lobby: Lobby, game: Game, currentRound: Round): void {
    // La partie peut avoir été terminée (ex: skip pilier -> endGame) alors qu'un timeout
    // de phase était encore en vol : ne pas rejouer la logique de phase sur un game FINISHED.
    if (game.status === GameStatus.FINISHED) {
        currentRound.clearServerTimer();
        return;
    }
    const currentPhase = currentRound.phase;

    // Protection : le timer qui expire doit correspondre à la phase actuelle.
    // Ex: timer ANSWERING expire mais la phase a déjà avancé à GUESSING (dernière
    // réponse soumise juste avant) → on ignore.
    if (currentRound.timerPhase && currentRound.timerPhase !== currentPhase) {
        logger.debug(`Timer ignoré: démarré pour ${currentRound.timerPhase} mais phase actuelle est ${currentPhase}`);
        return;
    }

    // Protection contre les doubles appels de timer pour la même phase
    // (serveur + pilier, ou double-tap du pilier).
    if (currentRound.timerProcessedForPhase === currentPhase) {
        logger.debug(`Timer déjà traité pour phase ${currentPhase}, ignoré`);
        return;
    }

    // Marquer immédiatement comme traité pour bloquer tout appel concurrent
    currentRound.timerProcessedForPhase = currentPhase;
    // Le timeout serveur a fait son office (ou le pilier l'a devancé) : le désarmer.
    currentRound.clearServerTimer();

    logger.info(`Timer expiré`, { lobbyCode, phase: currentPhase });

    switch (currentPhase) {
        case 'QUESTION_SELECTION':
            handleQuestionSelectionTimeout(io, lobbyCode, currentRound);
            break;
        case 'SUBSTITUTE_SELECTION':
            handleSubstituteSelectionTimeout(io, lobbyCode, lobby, currentRound);
            break;
        case 'ANSWERING':
            handleAnsweringTimeout(io, lobbyCode, lobby, currentRound);
            break;
        case 'SUBSTITUTE_ANSWERING':
            handleSubstituteAnsweringTimeout(io, lobbyCode, lobby, currentRound);
            break;
        case 'GUESSING':
            handleGuessingTimeout(io, lobbyCode, lobby, game, currentRound);
            break;
        case 'REVEAL':
            // Rien à faire : on attend que le pilier lance le round suivant.
            break;
    }
}
