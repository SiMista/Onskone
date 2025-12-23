/**
 * Shared constants between frontend and backend
 */

export const GAME_CONSTANTS = {
  // Player limits
  MIN_PLAYERS: 3,
  MAX_PLAYERS: 20,

  // Character limits
  MAX_NAME_LENGTH: 20,
  MIN_NAME_LENGTH: 2,
  MAX_ANSWER_LENGTH: 100,

  // Avatar settings
  MIN_AVATAR_ID: 0,
  MAX_AVATAR_ID: 17,
  AVATAR_COUNT: 18, // 0-17 inclusive

  // Game settings
  DEFAULT_CARD_RELANCES: 3,

  // Timer durations (in seconds)
  TIMERS: {
    QUESTION_SELECTION: 45,
    ANSWERING: 90,
    GUESSING: 120,
  },

  // Lobby code format
  LOBBY_CODE_LENGTH: 6,
} as const;

export type GameConstants = typeof GAME_CONSTANTS;
