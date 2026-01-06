// Types and utilities
export { HandlerContext, TypedSocket, TypedServer, requireLeader } from './types.js';
export { TimeoutManager, timeoutManager } from './TimeoutManager.js';

// Lobby handlers
export {
    handleCreateLobby,
    handleJoinLobby,
    handleGetLobbyInfo,
    handleCheckPlayerName,
    handleLeaveLobby,
    handleKickPlayer,
    handlePromotePlayer,
    cleanupDisconnectedPlayers
} from './lobbyHandlers.js';

// Game handlers
export {
    handleStartGame,
    handleNextRound,
    handleGetGameResults,
    handleGetGameState
} from './gameHandlers.js';

// Round handlers
export {
    handleRequestQuestions,
    handleSelectQuestion,
    handleSubmitAnswer,
    handleRequestShuffledAnswers,
    handleUpdateGuess,
    handleSubmitGuesses,
    handleRevealAnswer,
    buildRevealResults
} from './roundHandlers.js';

// Timer handlers
export {
    handleStartTimer,
    handleRequestTimerState,
    handleTimerExpired,
    handleQuestionSelectionTimeout,
    handleAnsweringTimeout,
    handleGuessingTimeout
} from './timerHandlers.js';

// Disconnect handler
export { handleDisconnect } from './disconnectHandler.js';
