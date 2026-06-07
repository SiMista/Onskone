import { useCallback, useEffect, useRef, useState } from 'react';
import socket from '../utils/socket';
import { useSocketEvent } from './useSocketEvent';
import type { RevealResult, GameMode } from '@onskone/shared';

/** Une entrée est considérée "ciblée Personne" : aucun joueur deviné (skip silencieux). */
export const isPersonneGuess = (r: RevealResult) =>
  !r.guessedPlayerId ||
  !r.guessedPlayerName ||
  r.guessedPlayerName === 'Aucun' ||
  r.guessedPlayerName === 'Personne';

/** État de similarité en attente de décision du pilier. */
export interface SimilarityModalState {
  answerIndex: number;
  guessedPlayerName: string;
  playerName: string;
}

/**
 * Machine d'état du reveal (curseur pilier + révélations + similarité), partagée
 * par toutes les vues de RevealPhase.
 *
 * Encapsule :
 *  - le curseur pilier `pilierCursor` (index de la réponse affichée), calculé à
 *    partir de `leaderId` pour rester synchronisé entre clients ;
 *  - l'ordre d'affichage : entrées normales d'abord, l'entrée "pilier deviné"
 *    (mode "Devine ma réponse") repoussée en dernier, et les ciblages "Personne"
 *    skippés silencieusement ;
 *  - les 5 listeners socket (answerRevealed, similarityDetected/Confirmed/Dismissed,
 *    revealCursorAdvanced) abonnés via useSocketEvent (ref-based, nettoyage ciblé,
 *    pas de réabonnement à chaque render — chaque handler voit l'état courant) ;
 *  - l'auto-reveal silencieux des réponses "Personne" (pilier uniquement) ;
 *  - le délai d'apparition du bouton "Suivant" (1s après révélation).
 */
export function useRevealCursor(
  results: RevealResult[],
  leaderId: string,
  isLeader: boolean,
  gameMode: GameMode,
  lobbyCode: string,
  initialRevealedIndices?: number[],
) {
  const [revealedIndices, setRevealedIndices] = useState<Set<number>>(
    new Set(initialRevealedIndices || []),
  );
  const [similarityModal, setSimilarityModal] = useState<SimilarityModalState | null>(null);
  const [correctedIndices, setCorrectedIndices] = useState<Set<number>>(new Set());

  // Index de l'entrée que le pilier s'est attribuée à lui-même (mode "Devine ma réponse")
  // - on la garde pour la fin du reveal. Doit être calculé à partir de leaderId
  // (et non currentPlayerId) pour que tous les clients aient le même curseur initial.
  const pilierGuessedIdx = results.findIndex(r => r.guessedPlayerId === leaderId);

  // Curseur pilier : index de la réponse actuellement affichée au pilier.
  // L'entrée "pilier deviné" est repoussée en dernier : on la skip pendant l'itération
  // normale et on la renvoie uniquement quand toutes les autres ont été révélées.
  const findFirstDisplayable = useCallback(
    (fromIdx: number, alreadyRevealed: Set<number>) => {
      for (let i = fromIdx; i < results.length; i++) {
        if (alreadyRevealed.has(i)) continue;
        if (isPersonneGuess(results[i])) continue;
        if (i === pilierGuessedIdx) continue;
        return i;
      }
      if (
        pilierGuessedIdx >= 0 &&
        !alreadyRevealed.has(pilierGuessedIdx) &&
        !isPersonneGuess(results[pilierGuessedIdx])
      ) {
        return pilierGuessedIdx;
      }
      return -1;
    },
    [results, pilierGuessedIdx],
  );

  const [pilierCursor, setPilierCursor] = useState<number>(() =>
    findFirstDisplayable(0, new Set(initialRevealedIndices || [])),
  );
  const [pilierPhase, setPilierPhase] = useState<'prompt' | 'revealed'>('prompt');
  // Le bouton "Suivant" apparaît 1s après la révélation
  const [showNextButton, setShowNextButton] = useState(false);

  // Afficher le bouton Suivant 1s après passage en phase revealed
  useEffect(() => {
    if (pilierPhase !== 'revealed') {
      setShowNextButton(false);
      return;
    }
    const t = setTimeout(() => setShowNextButton(true), 1000);
    return () => clearTimeout(t);
  }, [pilierPhase, pilierCursor]);

  // Listeners socket du reveal. Chaque handler voit toujours l'état courant sans
  // réabonner : useSocketEvent rafraîchit le handler via une ref à chaque render.
  useSocketEvent('answerRevealed', (data: { revealedIndex: number; revealedIndices: number[] }) => {
    setRevealedIndices(new Set(data.revealedIndices));
    setPilierPhase(prev => (data.revealedIndex === pilierCursor ? 'revealed' : prev));
  });

  useSocketEvent('similarityDetected', (data: { answerIndex: number; guessedPlayerName: string; playerName: string }) => {
    setSimilarityModal({
      answerIndex: data.answerIndex,
      guessedPlayerName: data.guessedPlayerName,
      playerName: data.playerName,
    });
  });

  // Le payload porte aussi correctedScore/leaderboard, ignorés ici : le score
  // corrigé est répercuté via gameStateUpdate, on ne lit que answerIndex.
  useSocketEvent('similarityConfirmed', (data: { answerIndex: number }) => {
    setCorrectedIndices(prev => new Set(prev).add(data.answerIndex));
    setSimilarityModal(null);
  });

  useSocketEvent('similarityDismissed', () => {
    setSimilarityModal(null);
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
    const next = findFirstDisplayable(pilierCursor + 1, revealedIndices);
    setPilierCursor(next);
    setPilierPhase('prompt');
    setShowNextButton(false);
    if (gameMode === 'remote') {
      socket.emit('advanceRevealCursor', { lobbyCode, nextIndex: next });
    }
  }, [findFirstDisplayable, pilierCursor, revealedIndices, gameMode, lobbyCode]);

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

  // Ordre d'affichage : entrées normales dans l'ordre du tableau, puis l'entrée
  // "pilier deviné" en dernier (mode "Devine ma réponse").
  const displayOrder = results
    .map((_, i) => i)
    .filter(i => !isPersonneGuess(results[i]) && i !== pilierGuessedIdx);
  if (pilierGuessedIdx >= 0 && !isPersonneGuess(results[pilierGuessedIdx])) {
    displayOrder.push(pilierGuessedIdx);
  }
  const displayableTotal = displayOrder.length;
  const displayablePosition = currentResult
    ? displayOrder.indexOf(pilierCursor) + 1
    : displayableTotal;

  const showSimilarity = !!(currentResult && similarityModal?.answerIndex === pilierCursor);
  const nextDisplayableIdx =
    pilierCursor >= 0 ? findFirstDisplayable(pilierCursor + 1, revealedIndices) : -1;
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
