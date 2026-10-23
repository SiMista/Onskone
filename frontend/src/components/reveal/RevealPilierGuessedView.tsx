import { useEffect, useRef, useState } from 'react';
import RevealPrimaryButton from './RevealPrimaryButton';
import RevealedAnswerCard from '../RevealedAnswerCard';
import SimilarityPopover from '../SimilarityPopover';
import RevealAuthorOverlay from './RevealAuthorOverlay';
import type { RevealCursorState } from '../../hooks/useRevealCursor';

/**
 * Vue spéciale "pilier deviné" (mode "Devine ma réponse", carte où le pilier
 * s'est attribué une réponse à lui-même). Reproduit exactement la mise en page
 * de la carte reçue par les autres joueurs, sans l'indication "tourne ton
 * téléphone". Affichée au pilier en mode local (uniquement quand currentResult
 * est non-null, garanti par le dispatcher RevealPhase).
 */
const RevealPilierGuessedView = ({
  reveal,
  isGameOver,
}: {
  reveal: RevealCursorState;
  isGameOver: boolean;
}) => {
  const {
    currentResult,
    pilierCursor,
    pilierPhase,
    showSimilarity,
    displayablePosition,
    displayableTotal,
    correctedIndices,
    similarityModal,
    handleConfirmSimilarity: onConfirmSimilarity,
    handleDismissSimilarity: onDismissSimilarity,
  } = reveal;

  // Overlay "qui a écrit ?" : même traitement que les autres joueurs, déclenché une
  // fois par carte, et seulement après l'arbitrage d'une éventuelle similarité.
  const [authorOverlay, setAuthorOverlay] = useState(false);
  const overlayShownForRef = useRef<number | null>(null);
  const overlayReady = pilierPhase === 'revealed' && !showSimilarity;
  useEffect(() => {
    if (overlayReady && overlayShownForRef.current !== pilierCursor) {
      overlayShownForRef.current = pilierCursor;
      setAuthorOverlay(true);
    }
  }, [overlayReady, pilierCursor]);

  // Cette vue n'est rendue par RevealPhase que lorsque currentResult est défini.
  if (!currentResult) return null;

  const pilierCardRevealed = pilierPhase === 'revealed';
  const pilierCardCorrect = currentResult.correct || correctedIndices.has(pilierCursor);

  return (
    <>
    {authorOverlay && currentResult.playerName && (
      <RevealAuthorOverlay
        name={currentResult.playerName}
        avatarId={currentResult.playerAvatarId ?? 0}
        premium={!!currentResult.playerIsPremium}
        correct={pilierCardCorrect}
        onDone={() => setAuthorOverlay(false)}
      />
    )}
    <RevealedAnswerCard
      result={currentResult}
      revealed={pilierCardRevealed}
      correct={pilierCardCorrect}
      cardClassName={pilierCardRevealed ? 'animate-reveal-pop' : ''}
      swapAnimation
      rowKey={`pilier-big-${pilierCursor}`}
      footer={
        <>
          {showSimilarity && (
            <SimilarityPopover
              guessedPlayerName={similarityModal!.guessedPlayerName}
              playerName={similarityModal!.playerName}
              isLeader={true}
              onConfirm={onConfirmSimilarity}
              onDismiss={onDismissSimilarity}
            />
          )}

          <p className="text-gray-700 text-xs md:text-sm mt-1">
            {displayablePosition}/{displayableTotal}
          </p>

          <div className="mt-3 md:mt-4 flex items-center justify-center">
            <RevealPrimaryButton reveal={reveal} isGameOver={isGameOver} />
          </div>
        </>
      }
    />
    </>
  );
};

export default RevealPilierGuessedView;
