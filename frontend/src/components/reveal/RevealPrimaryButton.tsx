import Button from '../Button';
import { useLocale } from '../../i18n';
import type { RevealCursorState } from '../../hooks/useRevealCursor';

/**
 * UNIQUE bouton d'action du pilier pendant le reveal, toujours au même endroit :
 * « Révéler » (bleu) → « Suivant » / « Manche suivante » (vert : on avance). Il change de
 * libellé/couleur selon l'état au lieu de se déplacer, donc le pouce du pilier ne chasse
 * jamais le bouton. Grisé (jamais masqué) pendant l'overlay « qui a écrit ? » ou l'arbitrage
 * d'une similarité.
 */
const RevealPrimaryButton = ({
  reveal,
  isGameOver,
  revealLabel,
}: {
  reveal: RevealCursorState;
  isGameOver: boolean;
  /** Libellé de l'état « Révéler » (la vue locale précise « sur son téléphone »). */
  revealLabel?: string;
}) => {
  const { t } = useLocale();
  const {
    pilierPhase,
    isLastDisplayable,
    showNextButton,
    showSimilarity,
    handleReveal,
    handleNext,
    handleNextRound,
  } = reveal;

  if (pilierPhase !== 'revealed') {
    return (
      <Button
        key="reveal"
        text={revealLabel ?? t.phases.reveal.reveal}
        variant="primary"
        size="lg"
        rotateEffect
        disabled={showSimilarity}
        onClick={handleReveal}
        className="!text-sm sm:!text-base whitespace-nowrap"
      />
    );
  }

  const waiting = !showNextButton || showSimilarity;
  if (isLastDisplayable) {
    return (
      <Button
        key="nextRound"
        text={isGameOver ? t.phases.reveal.seeFinalResults : t.phases.reveal.nextRound}
        variant="success"
        size="lg"
        rotateEffect
        disabled={waiting}
        onClick={handleNextRound}
        className="!text-sm sm:!text-base whitespace-nowrap"
      />
    );
  }
  return (
    <Button
      key="next"
      text={t.phases.reveal.next}
      variant="success"
      size="lg"
      rotateEffect
      disabled={waiting}
      onClick={handleNext}
      className="!text-sm sm:!text-base whitespace-nowrap animate-fade-in"
    />
  );
};

export default RevealPrimaryButton;
