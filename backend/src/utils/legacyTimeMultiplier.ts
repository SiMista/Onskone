import { GAME_CONSTANTS, type GameSpeed } from '@onskone/shared';

/**
 * Pont avec les apps d'avant `gameSpeed`, qui réglaient le rythme par un
 * multiplicateur (0.7 / 1 / 1.3, et 30 en debug). Elles émettent encore
 * `updateTimeMultiplier` et lisent `timeMultiplier` (lobbyDecksState,
 * timeMultiplierUpdated). En jeu rien ne casse : le sablier se cale sur la durée
 * envoyée par le serveur (`timerStarted.duration`).
 *
 * À supprimer, avec l'event et le champ legacy, quand MIN_SUPPORTED_VERSION
 * exclut ces versions.
 */
const LEGACY_DEBUG_MULTIPLIER = 30;
const LEGACY_FAST_MULTIPLIER = 0.7;

/** Ancien multiplicateur → vitesse : < 1 = rapide, le reste (dont l'ex-"Longue" 1.3) = normal. */
export const speedFromLegacyMultiplier = (raw: unknown): GameSpeed => {
    const m = Number(raw);
    if (m === LEGACY_DEBUG_MULTIPLIER) return GAME_CONSTANTS.GAME_SPEED_DEBUG;
    return Number.isFinite(m) && m < 1 ? 'fast' : GAME_CONSTANTS.GAME_SPEED_DEFAULT;
};

/** Vitesse → multiplicateur que comprennent les anciennes apps. */
export const legacyMultiplierFromSpeed = (speed: GameSpeed): number => {
    if (speed === 'debug') return LEGACY_DEBUG_MULTIPLIER;
    return speed === 'fast' ? LEGACY_FAST_MULTIPLIER : 1;
};
