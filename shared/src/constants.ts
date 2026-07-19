/**
 * Shared constants between frontend and backend
 */

import { RoundPhase } from './types/round.js';

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

  // Seconde(s) ajoutées à la durée de base de la phase GUESSING par joueur au-delà
  // de 3 (durée dynamique : la devinette est plus longue avec plus de réponses).
  GUESSING_EXTRA_PER_PLAYER: 20,

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

// ===== Durée des phases avec multiplicateur de temps réglable =====
// Source de vérité partagée front + back : le multiplicateur (réglé par l'hôte)
// scale toutes les durées de phase. Le frontend enveloppe ces fonctions dans son
// mode DEBUG ; le backend s'en sert pour ré-armer un timeout autoritatif.

/** Borne le multiplicateur dans la plage des niveaux autorisés (fallback DEFAULT si NaN). */
export const clampTimeMultiplier = (m: number): number => {
  if (!Number.isFinite(m)) return GAME_CONSTANTS.TIME_MULTIPLIER_DEFAULT;
  const levels = GAME_CONSTANTS.TIME_MULTIPLIER_LEVELS;
  return Math.min(Math.max(m, levels[0]), levels[levels.length - 1]);
};

/**
 * Durée "de base" (avant multiplicateur) d'une phase, en secondes.
 * La phase GUESSING a une durée dynamique : base à 3 joueurs, +GUESSING_EXTRA_PER_PLAYER
 * par joueur supplémentaire. REVEAL (et toute phase sans timer) renvoie 0.
 */
export const getBasePhaseDuration = (phase: RoundPhase, playerCount: number): number => {
  if (phase === RoundPhase.GUESSING) {
    return GAME_CONSTANTS.TIMERS.GUESSING
      + Math.max(0, playerCount - 3) * GAME_CONSTANTS.GUESSING_EXTRA_PER_PLAYER;
  }
  switch (phase) {
    case RoundPhase.QUESTION_SELECTION: return GAME_CONSTANTS.TIMERS.QUESTION_SELECTION;
    case RoundPhase.SUBSTITUTE_SELECTION: return GAME_CONSTANTS.TIMERS.SUBSTITUTE_SELECTION;
    case RoundPhase.ANSWERING: return GAME_CONSTANTS.TIMERS.ANSWERING;
    case RoundPhase.SUBSTITUTE_ANSWERING: return GAME_CONSTANTS.TIMERS.SUBSTITUTE_ANSWERING;
    default: return 0; // REVEAL (pas de timer)
  }
};

/**
 * Durée effective d'une phase en secondes, multiplicateur appliqué et borné.
 * Ne descend jamais sous 1s (une phase sans timer, base 0, renvoie donc 1 —
 * l'appelant décide s'il faut réellement armer un timer).
 */
export const getPhaseDuration = (
  phase: RoundPhase,
  timeMultiplier: number = GAME_CONSTANTS.TIME_MULTIPLIER_DEFAULT,
  playerCount = 3,
): number => {
  const base = getBasePhaseDuration(phase, playerCount);
  return Math.max(1, Math.round(base * clampTimeMultiplier(timeMultiplier)));
};
