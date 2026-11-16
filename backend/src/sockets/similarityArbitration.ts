import { getSimilarityComparison, type RevealResult } from '@onskone/shared';
import { isSimilarPair } from '../utils/similarity.js';
import type { Round } from '../models/Round.js';

/**
 * Arbitrage des similarités pendant le REVEAL (tour de table).
 *
 * La carte posée devant le joueur désigné est révélée fausse, mais elle ressemble à
 * ce qu'il a vraiment écrit (et que le pilier a posé devant un autre joueur, cf.
 * `getSimilarityComparison`) : le pilier tranche « même réponse » (+1) ou non.
 *
 * L'attente est un état SERVEUR (`Round.pendingSimilarityIndex`) : elle survit à la
 * reconnexion du pilier ou d'un joueur, entre dans l'empreinte de synchro, et une
 * décision ne s'applique qu'à la similarité réellement en attente (double clic,
 * client désynchronisé : sans effet).
 */

/** La carte `answerIndex`, mal attribuée, ressemble-t-elle à la vraie réponse du joueur désigné ? */
export function isSimilarityCandidate(results: readonly RevealResult[], answerIndex: number): boolean {
    const card = results[answerIndex];
    if (!card || card.correct) return false;
    const comparison = getSimilarityComparison(results, answerIndex);
    // isSimilarPair = gardes NO_RESPONSE_PREFIX + areAnswersSimilar.
    return !!comparison && isSimilarPair(card.answer, comparison.comparedAnswer);
}

/**
 * Révélation de la carte `answerIndex` : ouvre l'arbitrage si elle est candidate.
 * Une similarité encore en attente sur une AUTRE carte est d'abord abandonnée : le
 * pilier est passé à la suite sans trancher, c'est un « Non » (jamais de table bloquée,
 * y compris face à une vieille appli qui aurait perdu sa popup).
 * @returns l'index abandonné (à diffuser comme rejeté) et si un arbitrage s'ouvre.
 */
export function onCardRevealed(
    round: Round,
    results: readonly RevealResult[],
    answerIndex: number,
): { dropped: number | null; opened: boolean } {
    let dropped: number | null = null;
    if (round.pendingSimilarityIndex !== null && round.pendingSimilarityIndex !== answerIndex) {
        dropped = round.pendingSimilarityIndex;
        round.pendingSimilarityIndex = null;
    }
    const opened = isSimilarityCandidate(results, answerIndex);
    if (opened) round.pendingSimilarityIndex = answerIndex;
    return { dropped, opened };
}

export type SimilarityDecision = 'confirmed' | 'dismissed' | 'stale';

/**
 * Décision du pilier sur la carte `answerIndex`.
 * - 'stale' : rien n'attend pour cette carte (déjà tranchée, double clic, client
 *   désynchronisé) ; l'état ne bouge pas.
 * - 'confirmed' : correction enregistrée + 1 point bonus au pilier.
 * - 'dismissed' : refus, ou confirmation que le serveur ne reconnaît pas comme une
 *   vraie similarité (ne jamais faire confiance au client pour un point).
 * `results` = résultats du reveal AVANT la décision (cf. buildRevealResults).
 */
export function resolveSimilarity(
    round: Round,
    results: readonly RevealResult[],
    answerIndex: number,
    accepted: boolean,
): SimilarityDecision {
    if (round.pendingSimilarityIndex === null || round.pendingSimilarityIndex !== answerIndex) return 'stale';
    round.pendingSimilarityIndex = null;
    if (!accepted || !isSimilarityCandidate(results, answerIndex)) return 'dismissed';
    if (!round.similarityCorrections.includes(answerIndex)) {
        round.similarityCorrections.push(answerIndex);
        round.addBonusScore(round.leader.id, 1);
    }
    return 'confirmed';
}
