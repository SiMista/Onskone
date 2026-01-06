import { Server } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents } from '@onskone/shared';
import logger from '../utils/logger.js';
import {
    HandlerContext,
    TypedSocket,
    TypedServer,
    timeoutManager,
    // Lobby handlers
    handleCreateLobby,
    handleJoinLobby,
    handleGetLobbyInfo,
    handleCheckPlayerName,
    handleLeaveLobby,
    handleKickPlayer,
    handlePromotePlayer,
    // Game handlers
    handleStartGame,
    handleNextRound,
    handleGetGameResults,
    handleGetGameState,
    // Round handlers
    handleRequestQuestions,
    handleSelectQuestion,
    handleSubmitAnswer,
    handleRequestShuffledAnswers,
    handleUpdateGuess,
    handleSubmitGuesses,
    handleRevealAnswer,
    // Timer handlers
    handleStartTimer,
    handleRequestTimerState,
    handleTimerExpired,
    // Disconnect handler
    handleDisconnect
} from './handlers/index.js';

export class SocketHandler {
    private io: TypedServer;

    constructor(io: Server<ClientToServerEvents, ServerToClientEvents>) {
        this.io = io;
        this.setupSocketEvents();
    }

    private createContext(socket: TypedSocket): HandlerContext {
        return {
            io: this.io,
            socket,
            timeoutManager
        };
    }

    private setupSocketEvents(): void {
        this.io.on('connection', (socket: TypedSocket) => {
            logger.socket.connect(socket.id);
            const ctx = this.createContext(socket);

            // ===== LOBBY EVENTS =====
            socket.on('createLobby', (data) => handleCreateLobby(ctx, data));
            socket.on('joinLobby', (data) => handleJoinLobby(ctx, data));
            socket.on('getLobbyInfo', (data) => handleGetLobbyInfo(ctx, data));
            socket.on('checkPlayerName', (data) => handleCheckPlayerName(ctx, data));
            socket.on('leaveLobby', (data) => handleLeaveLobby(ctx, data));
            socket.on('kickPlayer', (data) => handleKickPlayer(ctx, data));
            socket.on('promotePlayer', (data) => handlePromotePlayer(ctx, data));

            // ===== GAME EVENTS =====
            socket.on('startGame', (data) => handleStartGame(ctx, data));
            socket.on('nextRound', (data) => handleNextRound(ctx, data));
            socket.on('getGameResults', (data) => handleGetGameResults(ctx, data));
            socket.on('getGameState', (data) => handleGetGameState(ctx, data));

            // ===== ROUND EVENTS =====
            socket.on('requestQuestions', (data) => handleRequestQuestions(ctx, data));
            socket.on('selectQuestion', (data) => handleSelectQuestion(ctx, data));
            socket.on('submitAnswer', (data) => handleSubmitAnswer(ctx, data));
            socket.on('requestShuffledAnswers', (data) => handleRequestShuffledAnswers(ctx, data));
            socket.on('updateGuess', (data) => handleUpdateGuess(ctx, data));
            socket.on('submitGuesses', (data) => handleSubmitGuesses(ctx, data));
            socket.on('revealAnswer', (data) => handleRevealAnswer(ctx, data));

            // ===== TIMER EVENTS =====
            socket.on('startTimer', (data) => handleStartTimer(ctx, data));
            socket.on('requestTimerState', (data) => handleRequestTimerState(ctx, data));
            socket.on('timerExpired', (data) => handleTimerExpired(ctx, data));

            // ===== DISCONNECT =====
            socket.on('disconnect', (reason) => {
                handleDisconnect(this.io, socket.id, reason, timeoutManager);
            });
        });
    }
}
