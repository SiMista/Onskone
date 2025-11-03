// Game configuration constants

export const GAME_CONFIG = {
  // Player limits
  MIN_PLAYERS: 3,
  MAX_PLAYERS: 20,

  // Character limits
  MAX_NAME_LENGTH: 20,
  MAX_ANSWER_LENGTH: 200,

  // Timer durations (in seconds)
  TIMERS: {
    QUESTION_SELECTION: 30,
    ANSWERING: 60,
    GUESSING: 90,
  },

  // UI
  COPIED_MESSAGE_DURATION: 2000, // milliseconds
  CONFETTI_DURATION: 5000, // milliseconds
  CONFETTI_COUNT: 50,
} as const;

export const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:8080';