import Avatar from '../Avatar';
import Button from '../Button';
import PlayerBadge from '../PlayerBadge';
import RevealedAnswerCard from '../RevealedAnswerCard';
import SimilarityPopover from '../SimilarityPopover';
import { IPlayer } from '@onskone/shared';
import { useLocale } from '../../i18n';
import type { RevealCursorState } from '../../hooks/useRevealCursor';

/**
 * Vue REVEAL en mode remote (à distance) : une carte à la fois pour tous les
 * joueurs, avec bulle "Écrit par" mais sans stickman ni "Montre ton écran".
 * Le pilier pilote la révélation (reveal / next / similarité / fin), les autres
 * suivent le curseur synchronisé. Gère aussi l'état vide "prêt pour la suite".
 */
const RevealRemoteView = ({
  reveal,
  leader,
  isLeader,
  isGameOver,
}: {
  reveal: RevealCursorState;
  leader: Pick<IPlayer, 'id' | 'name' | 'avatarId'>;
  isLeader: boolean;
  isGameOver: boolean;
}) => {
  const { t } = useLocale();
  const {
    currentResult,
    pilierCursor,
    pilierPhase,
    showNextButton,
    showSimilarity,
    isLastDisplayable,
    showEndButton,
    displayablePosition,
    displayableTotal,
    correctedIndices,
    similarityModal,
    handleReveal: onReveal,
    handleNext: onNext,
    handleConfirmSimilarity: onConfirmSimilarity,
    handleDismissSimilarity: onDismissSimilarity,
    handleNextRound: onNextRound,
  } = reveal;

  if (!currentResult) {
    return (
      <div className="flex flex-col h-full p-2 max-w-2xl mx-auto" style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-2 py-4">
          {isGameOver ? (
            <p className="text-base md:text-lg font-semibold text-center">{t.phases.reveal.gameOver}</p>
          ) : isLeader ? (
            <p className="text-base md:text-lg font-semibold text-center">{t.phases.reveal.readyNext}</p>
          ) : (
            <div className="flex items-center justify-center flex-wrap gap-x-2 gap-y-1 leading-none text-base md:text-lg">
              <span>{t.phases.reveal.waitingPrefix}</span>
              <Avatar avatarId={leader?.avatarId ?? 0} name={leader?.name} size="sm" />
              <span>{leader?.name}</span>
              <span>{t.phases.reveal.waitingLeaderNext}</span>
            </div>
          )}
          {isLeader && (
            <Button
              text={isGameOver ? t.phases.reveal.seeFinalResults : t.phases.reveal.nextRound}
              variant="success"
              rotateEffect
              onClick={onNextRound}
            />
          )}
        </div>
      </div>
    );
  }

  // Tant que la popup de similarité est ouverte, on garde la carte non-colorée
  // (le pilier doit trancher Oui/Non avant que la couleur correct/incorrect s'affiche).
  const cardRevealed = pilierPhase === 'revealed' && !showSimilarity;
  const cardCorrect = currentResult.correct || correctedIndices.has(pilierCursor);

  return (
    <RevealedAnswerCard
      result={currentResult}
      revealed={cardRevealed}
      correct={cardCorrect}
      cardClassName={cardRevealed ? 'animate-reveal-pop' : ''}
      swapAnimation
      rowKey={`remote-card-${pilierCursor}`}
      showStickman={false}
      header={
        !isLeader ? (
          <div className="flex items-center gap-2">
            <PlayerBadge player={leader} size="sm" />
            <p className="text-gray-500 text-xs md:text-sm italic m-0">{t.phases.reveal.revealing}</p>
          </div>
        ) : (
          <p className="text-gray-900 text-sm md:text-base font-semibold text-center">
            {t.phases.reveal.remoteAttributedTo} <span className="text-brand-500">{currentResult.guessedPlayerName}</span>
          </p>
        )
      }
      footer={
        <>
          {showSimilarity && isLeader && (
            <SimilarityPopover
              guessedPlayerName={similarityModal!.guessedPlayerName}
              playerName={similarityModal!.playerName}
              isLeader={isLeader}
              onConfirm={onConfirmSimilarity}
              onDismiss={onDismissSimilarity}
            />
          )}

          <p className="text-gray-700 text-xs md:text-sm mt-1">
            {displayablePosition}/{displayableTotal}
          </p>

          {isLeader && (
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
              ) : pilierPhase === 'revealed' && showNextButton && !isLastDisplayable ? (
                <div key={`next-${pilierCursor}`} className="animate-fade-in">
                  <Button
                    text={t.phases.reveal.next}
                    variant="primary"
                    size="lg"
                    rotateEffect
                    disabled={showSimilarity}
                    onClick={onNext}
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
          )}
        </>
      }
    />
  );
};

export default RevealRemoteView;
