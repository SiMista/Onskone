// Règles des écrans de rôle plein écran joués à l'entrée d'une phase (« Tu es PILIER /
// JOUEUR » au GUESSING, « À ton tour d'être PILIER » au choix de la question), isolées
// pour être testables (cf. phaseIntro.test.ts). Game.tsx décide qui les voit (pilier,
// mode local) et les retire à la fin de leur durée.
import { RoundPhase, GAME_CONSTANTS } from '@onskone/shared';

/** Écran affiché : manche + phase. */
export interface PhaseSnapshot {
  round: number;
  phase: RoundPhase;
}

/**
 * Durée de l'intro de chaque phase qui en a une. Le serveur décale d'autant le départ
 * du timer de ces phases : le temps ne coule pas sous l'overlay.
 */
export const PHASE_INTRO_MS: Partial<Record<RoundPhase, number>> = {
  [RoundPhase.QUESTION_SELECTION]: GAME_CONSTANTS.QUESTION_SELECTION_INTRO_MS,
  [RoundPhase.GUESSING]: GAME_CONSTANTS.GUESSING_INTRO_MS,
};

/**
 * Vrai si l'arrivée sur `cur` doit jouer l'intro de sa phase. Seulement sur une
 * transition vue en direct, jamais à un (re)montage en pleine phase (reconnexion,
 * resync, rechargement) : l'overlay rejouerait par-dessus une phase dont le temps
 * coule déjà.
 *  - GUESSING : en venant des réponses de la même manche ;
 *  - QUESTION_SELECTION : à l'arrivée d'une nouvelle manche (suivante, ou pilier
 *    sauté), ou, sans écran précédent, au premier écran d'une partie qui vient d'être
 *    lancée (`gameJustStarted`, cf. isFreshGameStart).
 */
export const shouldPlayPhaseIntro = (
  prev: PhaseSnapshot | null,
  cur: PhaseSnapshot,
  gameJustStarted: boolean,
): boolean => {
  switch (cur.phase) {
    case RoundPhase.GUESSING:
      return !!prev && prev.round === cur.round &&
        (prev.phase === RoundPhase.ANSWERING || prev.phase === RoundPhase.SUBSTITUTE_ANSWERING);
    case RoundPhase.QUESTION_SELECTION:
      return prev ? prev.round !== cur.round : gameJustStarted && cur.round === 1;
    default:
      return false;
  }
};

/** Intro en cours : sa phase et l'instant (horloge locale) où elle a été affichée. */
export interface PlayingIntro extends PhaseSnapshot {
  shownAt: number;
}

/** Départ du timer d'une phase, ramené sur l'horloge locale (cf. localTimerStart). */
export interface TimerStart extends PhaseSnapshot {
  at: number;
}

/**
 * Fin de l'intro (horloge locale) : au départ réel du timer de sa phase quand on le
 * connaît, jamais au-delà de sa durée nominale. Le serveur décale ce départ de la durée
 * de l'intro : une arrivée tardive sur la phase (chargement de /game au lancement)
 * raccourcit donc l'intro d'autant au lieu de manger le temps du pilier. Le timer d'une
 * autre manche ou d'une autre phase ne compte pas.
 */
export const introEndsAt = (intro: PlayingIntro, timerStart: TimerStart | null): number => {
  const nominal = intro.shownAt + (PHASE_INTRO_MS[intro.phase] ?? 0);
  if (!timerStart || timerStart.round !== intro.round || timerStart.phase !== intro.phase) return nominal;
  return Math.min(nominal, timerStart.at);
};

/**
 * Au-delà, l'arrivée sur /game ne compte plus comme le lancement de la partie : l'intro
 * du pilier mangerait le temps d'une phase déjà commencée (rechargement de la page, qui
 * garde l'état de navigation, ou réseau très lent). Large devant le trajet normal
 * Lobby -> Game (chargement de la page + état de la partie).
 */
export const GAME_START_FRESH_MS = 10_000;

/** État de navigation posé par le salon au lancement de la partie (cf. Lobby). */
export const gameStartNavState = (now: number = Date.now()) => ({ gameStartedAt: now });

/** Vrai si l'état de navigation de /game vient d'un lancement de partie encore frais. */
export const isFreshGameStart = (navState: unknown, now: number = Date.now()): boolean => {
  const startedAt = (navState as { gameStartedAt?: unknown } | null)?.gameStartedAt;
  return typeof startedAt === 'number' && now - startedAt >= 0 && now - startedAt < GAME_START_FRESH_MS;
};
