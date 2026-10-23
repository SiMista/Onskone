/**
 * Shared constants between frontend and backend
 */

import { RoundPhase } from './types/round.js';
import type { GameSpeed } from './types/lobby.js';

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

  // Durées des phases (en secondes) par vitesse de jeu, réglée par l'hôte dans le
  // lobby. Valeurs fixes et rondes, pas de multiplicateur : c'est ce que le joueur
  // lit sur le sablier. GUESSING est dynamique : GUESSING + GUESSING_EXTRA_PER_PLAYER
  // par joueur au-delà de 3 (la devinette est plus longue avec plus de réponses).
  TIMERS: {
    normal: {
      QUESTION_SELECTION: 45,
      SUBSTITUTE_SELECTION: 25,
      ANSWERING: 110,
      SUBSTITUTE_ANSWERING: 80,
      GUESSING: 100,
      GUESSING_EXTRA_PER_PLAYER: 15,
    },
    fast: {
      QUESTION_SELECTION: 40,
      SUBSTITUTE_SELECTION: 20,
      ANSWERING: 75,
      SUBSTITUTE_ANSWERING: 60,
      GUESSING: 60,
      GUESSING_EXTRA_PER_PLAYER: 10,
    },
    // Vitesse de DEV uniquement : 1h par phase pour travailler sur un écran sans se
    // faire couper. Acceptée par le serveur SEULEMENT si le backend tourne en
    // développement (cf. lobbyHandlers), et appliquée comme n'importe quelle vitesse
    // — donc partagée par toute la table, timer serveur inclus. Remplace l'ancien
    // DEBUG_TIMER purement client, qui permettait à un seul joueur d'imposer 1h à
    // tout le monde.
    debug: {
      QUESTION_SELECTION: 3600,
      SUBSTITUTE_SELECTION: 3600,
      ANSWERING: 3600,
      SUBSTITUTE_ANSWERING: 3600,
      GUESSING: 3600,
      GUESSING_EXTRA_PER_PLAYER: 0,
    },
  },

  // Vitesses proposées à l'hôte dans le lobby, de la plus rapide à la plus lente
  // (la vitesse `debug` n'en fait pas partie).
  GAME_SPEEDS: ['fast', 'normal'] as readonly GameSpeed[],
  GAME_SPEED_DEFAULT: 'normal' as GameSpeed,
  GAME_SPEED_DEBUG: 'debug' as GameSpeed,

  // Lobby code format
  LOBBY_CODE_LENGTH: 6,

  // Délais de gestion des déconnexions (millisecondes).
  // Source de vérité : frontend + backend pointent ici pour rester en phase.
  RECONNECT_GRACE_PERIOD_MS: 30_000,
  // Tolérance arrière-plan mobile : un joueur qui verrouille son tel ou répond à un
  // SMS ne doit être ni exclu du décompte des réponses, ni voir sa manche sautée.
  // Le serveur peut mettre jusqu'à ~45 s à détecter un socket mort (ping socket.io
  // par défaut) : ces délais ne doivent pas redescendre en dessous.
  LEADER_DISCONNECT_DELAY_MS: 60_000,
  INACTIVE_DELAY_MS: 60_000,
  KICK_BLOCK_DURATION_MS: 5 * 60 * 1000,
  // Filet de sécurité de la phase REVEAL (seule phase sans timer, conclue par le
  // pilier) : sans aucune action du pilier pendant ce délai, le serveur passe la
  // manche lui-même. Une table ne peut donc jamais rester figée sur la révélation,
  // même avec un pilier connecté mais parti (téléphone posé, appli en arrière-plan
  // sans coupure de socket).
  REVEAL_BACKSTOP_MS: 4 * 60 * 1000,
  // Overlay "qui a écrit ?" plein écran, affiché sur le tel du joueur dont la carte
  // vient d'être révélée (mode local). Le "Suivant" du pilier attend la fin de cet
  // overlay pour ne pas enchaîner par-dessus. À garder aligné avec les keyframes
  // `reveal-author-backdrop` (index.css, fades calés sur cette durée).
  REVEAL_AUTHOR_OVERLAY_MS: 3500,
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

// ===== Durée des phases selon la vitesse de jeu =====
// Source de vérité partagée front + back : la vitesse (réglée par l'hôte) choisit
// la table de durées. Le backend s'en sert pour ré-armer un timeout autoritatif.

/** Garde de type : `v` est une vitesse connue (y compris `debug`, à filtrer côté serveur). */
export const isGameSpeed = (v: unknown): v is GameSpeed =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(GAME_CONSTANTS.TIMERS, v);

/**
 * Durée "brute" d'une phase en secondes pour une vitesse donnée.
 * La phase GUESSING a une durée dynamique : base à 3 joueurs, +GUESSING_EXTRA_PER_PLAYER
 * par joueur supplémentaire. REVEAL (et toute phase sans timer) renvoie 0.
 * Une vitesse inconnue retombe sur GAME_SPEED_DEFAULT.
 */
export const getBasePhaseDuration = (
  phase: RoundPhase,
  playerCount: number,
  gameSpeed: GameSpeed = GAME_CONSTANTS.GAME_SPEED_DEFAULT,
): number => {
  const timers = GAME_CONSTANTS.TIMERS[isGameSpeed(gameSpeed) ? gameSpeed : GAME_CONSTANTS.GAME_SPEED_DEFAULT];
  if (phase === RoundPhase.GUESSING) {
    return timers.GUESSING + Math.max(0, playerCount - 3) * timers.GUESSING_EXTRA_PER_PLAYER;
  }
  switch (phase) {
    case RoundPhase.QUESTION_SELECTION: return timers.QUESTION_SELECTION;
    case RoundPhase.SUBSTITUTE_SELECTION: return timers.SUBSTITUTE_SELECTION;
    case RoundPhase.ANSWERING: return timers.ANSWERING;
    case RoundPhase.SUBSTITUTE_ANSWERING: return timers.SUBSTITUTE_ANSWERING;
    default: return 0; // REVEAL (pas de timer)
  }
};

/**
 * Durée effective d'une phase en secondes pour la vitesse du lobby.
 * Ne descend jamais sous 1s (une phase sans timer, base 0, renvoie donc 1 —
 * l'appelant décide s'il faut réellement armer un timer).
 */
export const getPhaseDuration = (
  phase: RoundPhase,
  gameSpeed: GameSpeed = GAME_CONSTANTS.GAME_SPEED_DEFAULT,
  playerCount = 3,
): number => Math.max(1, getBasePhaseDuration(phase, playerCount, gameSpeed));
