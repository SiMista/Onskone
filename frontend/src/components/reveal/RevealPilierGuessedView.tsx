import Button from '../Button';
import RevealedAnswerCard from '../RevealedAnswerCard';
import SimilarityPopover from '../SimilarityPopover';
import { useLocale } from '../../i18n';
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
  const { t } = useLocale();
  const {
    currentResult,
    pilierCursor,
    pilierPhase,
    showSimilarity,
    showEndButton,
    displayablePosition,
    displayableTotal,
    correctedIndices,
    similarityModal,
    handleReveal: onReveal,
    handleConfirmSimilarity: onConfirmSimilarity,
    handleDismissSimilarity: onDismissSimilarity,
    handleNextRound: onNextRound,
  } = reveal;

  // Cette vue n'est rendue par RevealPhase que lorsque currentResult est défini.
  if (!currentResult) return null;

  const pilierCardRevealed = pilierPhase === 'revealed';
  const pilierCardCorrect = currentResult.correct || correctedIndices.has(pilierCursor);

  return (
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
            {showEndButton ? (
              <div className="animate-fade-in">
                <Button
                  text={isGameOver ? t.phases.reveal.seeFinalResults : t.phases.reveal.nextRound}
                  variant="success"
                  size="lg"
                  rotateEffect
                  disabled={showSimilarity}
                  onClick={onNextRound}
                />
              </div>
            ) : (
              <Button
                text={t.phases.reveal.reveal}
                variant="primary"
                size="lg"
                rotateEffect
                disabled={showSimilarity || pilierPhase === 'revealed'}
                onClick={onReveal}
              />
            )}
          </div>
        </>
      }
    />
  );
};

export default RevealPilierGuessedView;
