/**
 * Avance tolérée d'un `timerExpired` du pilier sur le timer serveur : couvre la
 * latence réseau et un léger décalage d'horloge, sans permettre de conclure une
 * phase bien avant la fin du temps (horloge très en avance, client modifié).
 */
export const TIMER_EXPIRY_TOLERANCE_MS = 2_000;

/**
 * Vrai si un `timerExpired` reçu à `now` est plausible au regard du timer serveur.
 * Sans timer serveur armé (`timerEnd` null), on fait confiance au pilier : c'est
 * le seul à pouvoir conclure la phase.
 */
export const isTimerExpiryPlausible = (timerEnd: Date | null | undefined, now: number): boolean => {
    if (!timerEnd) return true;
    return now >= timerEnd.getTime() - TIMER_EXPIRY_TOLERANCE_MS;
};
