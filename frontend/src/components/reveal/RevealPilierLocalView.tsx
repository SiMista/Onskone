import Avatar from '../Avatar';
import Button from '../Button';
import SimilarityPopover from '../SimilarityPopover';
import { useLocale } from '../../i18n';
import type { RevealCursorState } from '../../hooks/useRevealCursor';

/**
 * Vue pilier en mode local : une seule carte à la fois (avatar du joueur ciblé),
 * avec le bouton flèche "Suivant" à droite de la carte, la popover de similarité
 * flottant sous la carte, et les boutons "Révéler" / fin de partie. Affichée au
 * pilier hors carte "pilier deviné".
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
    pilierPhase,
    showNextButton,
    showSimilarity,
    isLastDisplayable,
    showEndButton,
    displayablePosition,
    displayableTotal,
    similarityModal,
    handleReveal: onReveal,
    handleNext: onNext,
    handleConfirmSimilarity: onConfirmSimilarity,
    handleDismissSimilarity: onDismissSimilarity,
    handleNextRound: onNextRound,
  } = reveal;

  return (
    <div
      className="flex flex-col h-full p-2 max-w-2xl mx-auto"
      style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="flex flex-col items-center gap-3 md:gap-4 px-2 py-3">
        {currentResult ? (
          <>
            <div className="flex flex-col items-center justify-center gap-3 md:gap-4 w-full">
              <div className="relative flex items-center justify-center gap-3 md:gap-5 w-full">
                {/* Spacer miroir pour que la carte reste centrée */}
                <div className="w-14 md:w-20 shrink-0" aria-hidden />

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
                    className="relative z-10 bg-cream-player rounded-2xl border border-black stack-shadow-sm texture-paper px-8 py-6 md:px-12 md:py-8 flex flex-col items-center gap-3 animate-reveal-card-swap transition-colors duration-500"
                  >
                    <Avatar
                      avatarId={currentResult.guessedPlayerAvatarId ?? 0}
                      name={currentResult.guessedPlayerName}
                      size="xl"
                    />
                    <span className="text-base md:text-lg font-bold text-black">
                      {currentResult.guessedPlayerName}
                    </span>
                  </div>
                </div>

                {/* Bouton Suivant à droite de la carte - pilier uniquement */}
                <div className="relative z-20 w-16 md:w-24 shrink-0 flex justify-start">
                  {isLeader && showNextButton && !showSimilarity && !isLastDisplayable && (
                    <button
                      key={`next-${pilierCursor}`}
                      type="button"
                      onClick={onNext}
                      aria-label={t.phases.reveal.next}
                      className="animate-next-pop group flex flex-col items-center gap-1 cursor-pointer text-black hover:text-brand-500 transition-colors"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-10 h-10 md:w-12 md:h-12 transition-transform group-hover:translate-x-1 group-active:scale-95"
                        aria-hidden
                      >
                        <path d="M5 12h14" />
                        <path d="M13 5l7 7-7 7" />
                      </svg>
                      <span className="font-display text-[11px] md:text-sm font-bold uppercase tracking-wider">
                        {t.phases.reveal.next}
                      </span>
                    </button>
                  )}
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

              <div className="text-center px-2 mt-1 md:mt-2">
                <p className="text-gray-900 text-sm md:text-base font-semibold">
                  {t.phases.reveal.watchScreen}
                </p>
                <p className="text-gray-700 text-xs md:text-sm mt-0.5">
                  {displayablePosition}/{displayableTotal}
                </p>
              </div>
            </div>

            {isLeader && !showEndButton && (
              <Button
                text={t.phases.reveal.revealOnPhone}
                variant="primary"
                size="lg"
                rotateEffect
                disabled={showSimilarity || pilierPhase === 'revealed'}
                onClick={onReveal}
                className="!text-sm sm:!text-base whitespace-nowrap"
              />
            )}

            {isLeader && showEndButton && (
              <div className="animate-fade-in">
                <Button
                  text={isGameOver ? t.phases.reveal.seeFinalResults : t.phases.reveal.nextRound}
                  variant="success"
                  size="lg"
                  rotateEffect
                  onClick={onNextRound}
                />
              </div>
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
