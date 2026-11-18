import RoleIntroOverlay from './RoleIntroOverlay';
import { STEP_ILLUSTRATIONS } from './StepIllustrations';
import { useLocale } from '../i18n';
import { GAME_CONSTANTS } from '@onskone/shared';

/**
 * Intro plein écran sur l'écran du PILIER au début de sa manche (QUESTION_SELECTION) :
 * « À ton tour d'être PILIER », l'illustration animée de l'étape 1 du « Comment jouer »
 * (le pilier et ses cartes de questions), et ce qu'il doit faire maintenant. Même aura jaune que le « Tu es PILIER » du GUESSING : jaune =
 * pilier, d'un écran de rôle à l'autre. Les cartes se retournent à sa fin (cf.
 * QuestionSelection) et le timer serveur ne coule qu'après. Dans les deux modes : à
 * distance aussi, c'est le signal « à toi de jouer ».
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
      // Le bonhomme seul occupe peu de son canevas (le même que les images du tuto) :
      // zoomé pour avoir la présence de la table du GUESSING, sans toucher au titre.
      illustrationClassName="scale-[1.4]"
      // « Devine ma réponse » : le pilier enchaîne sur le choix de son remplaçant, on l'annonce.
      text={guessMyAnswerMode ? intro.textGuessMyAnswer : intro.text}
      durationMs={GAME_CONSTANTS.QUESTION_SELECTION_INTRO_MS}
    />
  );
};

export default QuestionSelectionIntroOverlay;
