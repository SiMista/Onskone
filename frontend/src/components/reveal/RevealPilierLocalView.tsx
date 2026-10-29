import Avatar from '../Avatar';
import Button from '../Button';
import RevealPrimaryButton from './RevealPrimaryButton';
import SimilarityPopover from '../SimilarityPopover';
import { useLocale } from '../../i18n';
import type { RevealCursorState } from '../../hooks/useRevealCursor';
import PremiumName from '../PremiumName';

/**
 * Vue pilier en mode local : une seule carte à la fois (avatar du joueur ciblé),
 * la popover de similarité flottant sous la carte, et le bouton d'action unique
 * (RevealPrimaryButton). Affichée au pilier hors carte "pilier deviné".
 */
const RevealPilierLocalView = ({
  reveal,
  isLeader,
  isGameOver,
}: {
  reveal: RevealCursorState;
  isLeader: boolean;
  isGameOver: boolean;
}) => {
  const { t } = useLocale();
  const {
    currentResult,
    pilierCursor,
    showSimilarity,
    isLastDisplayable,
    displayablePosition,
    displayableTotal,
    similarityModal,
    handleConfirmSimilarity: onConfirmSimilarity,
    handleDismissSimilarity: onDismissSimilarity,
    handleNextRound: onNextRound,
  } = reveal;

  return (
    <div
      className="flex flex-col h-full p-2 short-landscape:p-0 max-w-2xl short-landscape:max-w-none mx-auto"
      style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="flex flex-col items-center gap-3 md:gap-4 px-2 py-3 short-landscape:flex-row short-landscape:justify-center short-landscape:gap-8 short-landscape:py-0 short-landscape:h-full tiny-landscape:[zoom:0.8]">
        {currentResult ? (
          <>
            <div className="flex flex-col items-center justify-center gap-3 md:gap-4 w-full short-landscape:w-auto short-landscape:gap-1.5">
              <div className="relative flex items-center justify-center gap-3 md:gap-5 w-full short-landscape:w-auto">
                <div className="relative">
                  {/* Tranche d'une "prochaine" carte qui dépasse à droite, inclinée et fondue */}
                  {!isLastDisplayable && (
                    <div
                      aria-hidden
                      className="absolute top-3 bottom-3 bg-cream-player rounded-r-2xl border border-black border-l-0 pointer-events-none"
                      style={{
                        left: 'calc(100% - 0.75rem)',
                        width: '2.5rem',
                        zIndex: 0,
                        transform: 'rotate(5deg)',
                        transformOrigin: 'left center',
                        opacity: 0.45,
                      }}
                    />
                  )}

                  <div
                    key={`pilier-card-${pilierCursor}`}
                    className="relative z-10 bg-cream-player rounded-2xl border border-black stack-shadow-sm texture-paper px-8 py-6 md:px-12 md:py-8 short-landscape:!px-6 short-landscape:!py-3 flex flex-col items-center gap-3 short-landscape:gap-1.5 animate-reveal-card-swap transition-colors duration-500"
                  >
                    <Avatar
                      avatarId={currentResult.guessedPlayerAvatarId ?? 0}
                      name={currentResult.guessedPlayerName}
                      size="xl"
                    />
                    <PremiumName
                      name={currentResult.guessedPlayerName}
                      premium={!!currentResult.guessedPlayerIsPremium}
                      className="text-base md:text-lg font-bold text-black"
                    />
                  </div>
                </div>

                {/* Popover similarité - flotte sous la carte, ne pousse rien */}
                {showSimilarity && (
                  <div className="absolute left-1/2 -translate-x-1/2 top-full z-30 pt-2">
                    <SimilarityPopover
                      guessedPlayerName={similarityModal!.guessedPlayerName}
                      playerName={similarityModal!.playerName}
                      isLeader={true}
                      onConfirm={onConfirmSimilarity}
                      onDismiss={onDismissSimilarity}
                    />
                  </div>
                )}
              </div>

              <div className="text-center px-2 mt-1 md:mt-2 short-landscape:mt-0">
                <p className="text-gray-900 text-sm md:text-base font-semibold short-landscape:!my-0">
                  {t.phases.reveal.watchScreen}
                </p>
                <p className="text-gray-700 text-xs md:text-sm mt-0.5 short-landscape:!my-0">
                  {displayablePosition}/{displayableTotal}
                </p>
              </div>
            </div>

            {/* Bouton unique, toujours au même endroit : Révéler → Suivant → Manche suivante */}
            {isLeader && (
              <RevealPrimaryButton
                reveal={reveal}
                isGameOver={isGameOver}
                revealLabel={t.phases.reveal.revealOnPhone}
              />
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 md:gap-3">
            <p className="text-base md:text-lg font-semibold">
              {isGameOver ? t.phases.reveal.gameOver : t.phases.reveal.readyNext}
            </p>
            <Button
              text={isGameOver ? t.phases.reveal.seeFinalResults : t.phases.reveal.nextRound}
              variant="success"
              rotateEffect
              onClick={onNextRound}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default RevealPilierLocalView;
