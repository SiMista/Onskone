/**
 * Shared constants between frontend and backend
 */

export const GAME_CONSTANTS = {
  // Player limits
  MIN_PLAYERS: 3,
  MAX_PLAYERS: 20,

  // Character limits
  MAX_NAME_LENGTH: 20,
  MIN_NAME_LENGTH: 1,
  MAX_ANSWER_LENGTH: 500,

  // Avatar settings
  MIN_AVATAR_ID: 0,
  MAX_AVATAR_ID: 17,
  AVATAR_COUNT: 18, // 0-17 inclusive

  // Game settings
  DEFAULT_CARD_RELANCES: 3,

  // Timer durations (in seconds)
  TIMERS: {
    QUESTION_SELECTION: 45,
    SUBSTITUTE_SELECTION: 30,
    ANSWERING: 120,
    SUBSTITUTE_ANSWERING: 120,
    GUESSING: 120,
  },

  // Multiplicateur de temps réglable par l'hôte dans le lobby : scale toutes les
  // durées de phase d'un coup. 3 niveaux discrets (rapide / normal / tranquille).
  TIME_MULTIPLIER_LEVELS: [0.7, 1, 1.3] as readonly number[],
  TIME_MULTIPLIER_DEFAULT: 1,

  // Lobby code format
  LOBBY_CODE_LENGTH: 6,

  // Délais de gestion des déconnexions (millisecondes).
  // Source de vérité : frontend + backend pointent ici pour rester en phase.
  RECONNECT_GRACE_PERIOD_MS: 30_000,
  LEADER_DISCONNECT_DELAY_MS: 15_000,
  INACTIVE_DELAY_MS: 5_000,
  KICK_BLOCK_DURATION_MS: 5 * 60 * 1000,
} as const;

export type GameConstants = typeof GAME_CONSTANTS;

/**
 * Préfixe placé devant le contenu d'une réponse automatique (timeout, déconnexion).
 * Le frontend détecte ce préfixe pour afficher un placeholder italique au lieu du texte brut.
 * Format complet : `__NO_RESPONSE__<pseudo> n'a pas répondu à temps` (ou variantes).
 */
export const NO_RESPONSE_PREFIX = '__NO_RESPONSE__';

/** Vrai si la réponse fournie est un placeholder auto-généré (timeout / déconnexion). */
export const isNoResponse = (answer: string | null | undefined): boolean =>
  typeof answer === 'string' && answer.startsWith(NO_RESPONSE_PREFIX);

/** Construit une réponse placeholder. Suffix = la raison (ex: "n'a pas répondu à temps"). */
export const formatNoResponse = (playerName: string, suffix: string): string =>
  `${NO_RESPONSE_PREFIX}${playerName} ${suffix}`;
