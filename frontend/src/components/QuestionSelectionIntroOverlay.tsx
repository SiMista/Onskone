import RoleIntroOverlay from './RoleIntroOverlay';
import { STEP_ILLUSTRATIONS } from './StepIllustrations';
import { useLocale } from '../i18n';
import { GAME_CONSTANTS } from '@onskone/shared';

/**
 * Intro plein écran du PILIER au début de sa manche (QUESTION_SELECTION, les deux modes) :
 * « À ton tour d'être PILIER », l'illustration animée de l'étape 1 du « Comment jouer »
 * et ce qu'il doit faire. Aura jaune = pilier, comme le « Tu es PILIER » du GUESSING.
 * Ses cartes se retournent à la fin de l'intro, le timer serveur ne coule qu'après.
 */
const QuestionSelectionIntroOverlay = ({ guessMyAnswerMode }: { guessMyAnswerMode: boolean }) => {
  const { t } = useLocale();
  const intro = t.phases.questionSelection.intro;
  return (
    <RoleIntroOverlay
      label={intro.yourTurn}
      role={intro.role}
      aura="var(--color-warning-300)"
      illustration={STEP_ILLUSTRATIONS[0]}
      // Le dessin n'occupe qu'une petite partie de son canevas (beaucoup de transparent) :
      // zoomé pour peser autant que la table du GUESSING, sans toucher au titre.
      illustrationClassName="scale-[1.4]"
      // « Devine ma réponse » : le pilier enchaîne sur le choix de son remplaçant, on l'annonce.
      text={guessMyAnswerMode ? intro.textGuessMyAnswer : intro.text}
      durationMs={GAME_CONSTANTS.QUESTION_SELECTION_INTRO_MS}
    />
  );
};

export default QuestionSelectionIntroOverlay;
