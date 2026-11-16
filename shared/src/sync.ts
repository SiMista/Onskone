import type { GameStatus } from './types/game.js';
import type { RoundPhase } from './types/round.js';

/**
 * Synchronisation client/serveur de l'état de partie.
 *
 * Le serveur est la seule source de vérité. Les transitions sont diffusées en
 * deltas (questionSelected, revealResults…) qu'un client peut RATER (socket
 * tombé, appli en arrière-plan, évènement perdu). Pour converger quoi qu'il
 * arrive, chaque client envoie périodiquement `syncCheck` avec l'EMPREINTE de ce
 * qu'il affiche ; si elle diffère de celle du serveur, celui-ci lui renvoie
 * l'état complet (`gameState`). Un client qui n'obtient aucune réponse
 * (socket zombie) force une reconnexion.
 */

/** Ce qui définit l'écran à afficher (la partie commune à IGame et au modèle serveur). */
export interface GameFingerprintSource {
  status: GameStatus;
  currentRound: {
    roundNumber: number;
    phase: RoundPhase;
    /** Réponses déjà révélées en REVEAL : un spectateur qui les a ratées doit resynchroniser. */
    revealedIndices?: number[];
    /** Similarité en attente d'arbitrage : une popup / un écran allumé raté se rattrape. */
    pendingSimilarityIndex?: number | null;
    /** Similarités validées : une carte restée rouge à tort se rattrape. */
    similarityCorrections?: number[];
  } | null;
}

/** Empreinte compacte de l'état de partie : identique client/serveur => en phase. */
export const gameFingerprint = (game: GameFingerprintSource | null | undefined): string => {
  if (!game) return 'none';
  const round = game.currentRound;
  if (!round) return `${game.status}:-`;
  const base = `${game.status}:${round.roundNumber}:${round.phase}:${round.revealedIndices?.length ?? 0}`;
  // Le segment similarité n'existe que lorsqu'il y a quelque chose à arbitrer ou d'arbitré :
  // le reste du temps l'empreinte reste celle des versions précédentes (une vieille appli
  // n'est resynchronisée que pendant un reveal à similarité, sans effet visible).
  const pending = round.pendingSimilarityIndex ?? null;
  const corrected = round.similarityCorrections?.length ?? 0;
  if (pending === null && corrected === 0) return base;
  return `${base}:sim${pending ?? '-'}/${corrected}`;
};

/** Période des `syncCheck` envoyés par un client en partie. */
export const SYNC_CHECK_INTERVAL_MS = 5_000;
/** Sans `syncResult` ni `gameState` dans ce délai, le socket est tenu pour mort : reconnexion forcée. */
export const SYNC_ACK_TIMEOUT_MS = 4_000;
