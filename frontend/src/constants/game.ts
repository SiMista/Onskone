// Game configuration constants

// Mode debug: met les timers à 1 heure pour travailler sur le front tranquillement
export const DEBUG_MODE = true;

const DEBUG_TIMER = 3600; // 1 heure

export const GAME_CONFIG = {
  // Player limits
  MIN_PLAYERS: 3,
  MAX_PLAYERS: 20,

  // Character limits
  MAX_NAME_LENGTH: 20,
  MAX_ANSWER_LENGTH: 200,

  // Timer durations (in seconds)
  TIMERS: {
    QUESTION_SELECTION: DEBUG_MODE ? DEBUG_TIMER : 30,
    ANSWERING: DEBUG_MODE ? DEBUG_TIMER : 60,
    GUESSING: DEBUG_MODE ? DEBUG_TIMER : 90,
  },

  // UI
  COPIED_MESSAGE_DURATION: 2000, // milliseconds
  CONFETTI_DURATION: 5000, // milliseconds
  CONFETTI_COUNT: 50,
} as const;

export const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:8080';