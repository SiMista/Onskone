import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import socket from '../utils/socket';
import { useSocketEvent } from './useSocketEvent';
import {
  GAME_CONSTANTS, isPersonneGuess, getSimilarityComparison,
  type RevealResult, type GameMode, type SimilarityComparison,
} from '@onskone/shared';

/** Similarité en attente de l'arbitrage du pilier (état serveur). */
export interface SimilarityModalState {
  /** Carte jugée (index de results) : celle posée devant le joueur désigné. */
  answerIndex: number;
  /** Carte à laquelle elle se compare et téléphone où elle est posée (null : introuvable). */
  comparison: SimilarityComparison | null;
}

interface UseRevealCursorArgs {
  results: RevealResult[];
  leaderId: string;
  isLeader: boolean;
  gameMode: GameMode;
  lobbyCode: string;
  /** Ordre du reveal (indices de results), fixé par le serveur, le même pour tous. */
  revealOrder: readonly number[];
  serverRevealedIndices?: number[];
  /** Similarité en attente (index de la carte jugée), état serveur suivi par useGameState. */
  pendingSimilarityIndex: number | null;
  /** Cartes validées « même réponse », état serveur suivi par useGameState. */
  similarityCorrections: readonly number[];
}

/**
 * Machine d'état du reveal (curseur pilier + révélations + similarité), partagée
 * par toutes les vues de RevealPhase.
 *
 * Encapsule :
 *  - le curseur pilier `pilierCursor` (index de la réponse affichée), calculé à
 *    partir de `leaderId` pour rester synchronisé entre clients ;
 *  - l'ordre d'affichage `revealOrder`, fixé par le serveur (tour de table : la
 *    carte de chaque joueur place par place en partant de la gauche du pilier ;
 *    "pilier deviné" en dernier ; sans les ciblages "Personne", révélés en silence) ;
 *  - l'arbitrage des similarités, DÉDUIT de l'état serveur (`pendingSimilarityIndex`,
 *    `similarityCorrections`) : rien de local à perdre, une reconnexion ou une
 *    resynchro rouvre la popup telle que le serveur l'attend ;
 *  - les listeners socket du curseur (answerRevealed, revealCursorAdvanced) abonnés
 *    via useSocketEvent (ref-based, pas de réabonnement à chaque render) ;
 *  - l'auto-reveal silencieux des réponses "Personne" (pilier uniquement) ;
 *  - le délai d'apparition du bouton "Suivant" (1s après révélation).
 */
export function useRevealCursor({
  results,
  leaderId,
  isLeader,
  gameMode,
  lobbyCode,
  revealOrder,
  serverRevealedIndices,
  pendingSimilarityIndex,
  similarityCorrections,
}: UseRevealCursorArgs) {
  const [revealedIndices, setRevealedIndices] = useState<Set<number>>(
    new Set(serverRevealedIndices || []),
  );

  // Arbitrage en cours, avec ce à quoi la carte se compare (texte de la popup,
  // téléphone mis en avant). Même calcul que le serveur (getSimilarityComparison).
  const similarityModal = useMemo<SimilarityModalState | null>(
    () => pendingSimilarityIndex === null
      ? null
      : { answerIndex: pendingSimilarityIndex, comparison: getSimilarityComparison(results, pendingSimilarityIndex) },
    [pendingSimilarityIndex, results],
  );
  const correctedIndices = useMemo(() => new Set(similarityCorrections), [similarityCorrections]);

  // Convergence vers le serveur : une resynchronisation (`gameState`) peut apporter
  // des révélations ratées (évènements perdus). On les intègre sans remonter le
  // composant, pour ne pas perdre le curseur ni les animations.
  useEffect(() => {
    if (!serverRevealedIndices?.length) return;
    setRevealedIndices(prev => {
      if (serverRevealedIndices.every(i => prev.has(i))) return prev;
      const merged = new Set(prev);
      serverRevealedIndices.forEach(i => merged.add(i));
      return merged;
    });
  }, [serverRevealedIndices]);

  // Index de l'entrée que le pilier s'est attribuée à lui-même (mode "Devine ma réponse")
  // - on la garde pour la fin du reveal. Doit être calculé à partir de leaderId
  // (et non currentPlayerId) pour que tous les clients aient le même curseur initial.
  const pilierGuessedIdx = results.findIndex(r => r.guessedPlayerId === leaderId);

  // Curseur pilier : index de la réponse actuellement affichée au pilier.
  // Prochaine entrée non révélée de l'ordre du reveal, à partir de la position
  // `fromPos` dans cet ordre (et non d'un index de results).
  const findFirstDisplayable = useCallback(
    (fromPos: number, alreadyRevealed: Set<number>) => {
      for (let p = fromPos; p < revealOrder.length; p++) {
        if (!alreadyRevealed.has(revealOrder[p])) return revealOrder[p];
      }
      return -1;
    },
    [revealOrder],
  );
  // Position du curseur dans l'ordre du reveal, pour chercher la suivante.
  const nextPosAfter = useCallback(
    (idx: number) => revealOrder.indexOf(idx) + 1,
    [revealOrder],
  );

  // Une similarité en attente au montage (reconnexion pendant la popup) : on reprend
  // sur la carte jugée, déjà révélée, plutôt que de sauter à la suivante.
  const [pilierCursor, setPilierCursor] = useState<number>(() =>
    pendingSimilarityIndex ?? findFirstDisplayable(0, new Set(serverRevealedIndices || [])),
  );
  const [pilierPhase, setPilierPhase] = useState<'prompt' | 'revealed'>(
    () => (pendingSimilarityIndex === null ? 'prompt' : 'revealed'),
  );

  // Similarité en attente : tout le monde regarde la carte jugée. Un curseur parti
  // ailleurs (resynchro, évènement raté) y revient, sinon la popup resterait invisible
  // et le bouton « Révéler » bloqué.
  useEffect(() => {
    if (pendingSimilarityIndex === null) return;
    setPilierCursor(pendingSimilarityIndex);
    setPilierPhase('revealed');
  }, [pendingSimilarityIndex]);

  // Le bouton "Suivant" apparaît 1s après la révélation
  const [showNextButton, setShowNextButton] = useState(false);

  // Afficher le bouton Suivant après passage en phase revealed. En mode local, chaque
  // révélation déclenche l'overlay "qui a écrit ?" sur le tel du joueur concerné : on
  // attend sa fin (et l'arbitrage d'une éventuelle similarité, qui retarde l'overlay).
  // Remote : pas d'overlay, 1s comme avant.
  const similarityPending = !!similarityModal;
  useEffect(() => {
    if (pilierPhase !== 'revealed' || similarityPending) {
      setShowNextButton(false);
      return;
    }
    const delay = gameMode === 'remote' ? 1000 : GAME_CONSTANTS.REVEAL_AUTHOR_OVERLAY_MS;
    const t = setTimeout(() => setShowNextButton(true), delay);
    return () => clearTimeout(t);
  }, [pilierPhase, pilierCursor, similarityPending, gameMode]);

  // Listeners socket du reveal (la similarité est suivie par useGameState). Chaque
  // handler voit toujours l'état courant sans réabonner : useSocketEvent rafraîchit
  // le handler via une ref à chaque render.
  useSocketEvent('answerRevealed', (data: { revealedIndex: number; revealedIndices: number[] }) => {
    setRevealedIndices(new Set(data.revealedIndices));
    setPilierPhase(prev => (data.revealedIndex === pilierCursor ? 'revealed' : prev));
  });

  useSocketEvent('revealCursorAdvanced', (data: { nextIndex: number }) => {
    if (!isLeader && gameMode === 'remote') {
      setPilierCursor(data.nextIndex);
      setPilierPhase('prompt');
      setShowNextButton(false);
    }
  });

  // Auto-reveal silencieux des réponses où le pilier avait ciblé "Personne".
  // On garde une ref des indices déjà émis pour éviter le flood d'événements
  // à chaque re-render (results ou revealedIndices change).
  const sentRevealsRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (!isLeader) return;
    results.forEach((r, idx) => {
      if (isPersonneGuess(r) && !revealedIndices.has(idx) && !sentRevealsRef.current.has(idx)) {
        sentRevealsRef.current.add(idx);
        socket.emit('revealAnswer', { lobbyCode, answerIndex: idx });
      }
    });
  }, [isLeader, results, revealedIndices, lobbyCode]);

  const handleReveal = useCallback(() => {
    if (pilierCursor < 0 || similarityModal) return;
    if (revealedIndices.has(pilierCursor)) {
      setPilierPhase('revealed');
      return;
    }
    socket.emit('revealAnswer', { lobbyCode, answerIndex: pilierCursor });
  }, [pilierCursor, similarityModal, revealedIndices, lobbyCode]);

  const handleNext = useCallback(() => {
    const next = findFirstDisplayable(nextPosAfter(pilierCursor), revealedIndices);
    setPilierCursor(next);
    setPilierPhase('prompt');
    setShowNextButton(false);
    if (gameMode === 'remote') {
      socket.emit('advanceRevealCursor', { lobbyCode, nextIndex: next });
    }
  }, [findFirstDisplayable, nextPosAfter, pilierCursor, revealedIndices, gameMode, lobbyCode]);

  const handleConfirmSimilarity = useCallback(() => {
    if (!similarityModal) return;
    socket.emit('confirmSimilarity', {
      lobbyCode,
      answerIndex: similarityModal.answerIndex,
    });
  }, [similarityModal, lobbyCode]);

  const handleDismissSimilarity = useCallback(() => {
    if (!similarityModal) return;
    socket.emit('dismissSimilarity', {
      lobbyCode,
      answerIndex: similarityModal.answerIndex,
    });
  }, [similarityModal, lobbyCode]);

  const handleNextRound = useCallback(() => {
    socket.emit('nextRound', { lobbyCode });
  }, [lobbyCode]);

  const totalAnswers = results.length;
  const revealedCount = revealedIndices.size;
  const allRevealed = revealedCount >= totalAnswers;

  // Réponse actuellement pointée par le curseur pilier.
  const currentResult = pilierCursor >= 0 ? results[pilierCursor] : null;

  // Ordre d'affichage = ordre du reveal (tour de table, "pilier deviné" en dernier).
  const displayableTotal = revealOrder.length;
  const displayablePosition = currentResult
    ? revealOrder.indexOf(pilierCursor) + 1
    : displayableTotal;

  const showSimilarity = !!(currentResult && similarityModal?.answerIndex === pilierCursor);
  const nextDisplayableIdx =
    pilierCursor >= 0 ? findFirstDisplayable(nextPosAfter(pilierCursor), revealedIndices) : -1;
  const isLastDisplayable = pilierCursor >= 0 && nextDisplayableIdx === -1;
  const showEndButton =
    isLastDisplayable && pilierPhase === 'revealed' && showNextButton && !showSimilarity;

  return {
    // état brut
    pilierCursor,
    pilierPhase,
    revealedIndices,
    correctedIndices,
    similarityModal,
    showNextButton,
    allRevealed,
    // dérivés pour les vues pilier
    currentResult,
    pilierGuessedIdx,
    displayablePosition,
    displayableTotal,
    showSimilarity,
    isLastDisplayable,
    showEndButton,
    // helper partagé (utilisé par la vue joueur locale pour le "next to reveal")
    findFirstDisplayable,
    // handlers
    handleReveal,
    handleNext,
    handleConfirmSimilarity,
    handleDismissSimilarity,
    handleNextRound,
  };
}

/**
 * État + handlers du reveal renvoyés par `useRevealCursor`, threadé tel quel
 * vers chaque sous-vue de RevealPhase (qui en destructure ce dont elle a besoin).
 */
export type RevealCursorState = ReturnType<typeof useRevealCursor>;
