import RoleIntroOverlay from './RoleIntroOverlay';
import { STEP_ILLUSTRATIONS } from './StepIllustrations';
import { useLocale } from '../i18n';
import { GAME_CONSTANTS } from '@onskone/shared';

/**
 * Intro plein écran à l'entrée en phase GUESSING : « Tu es PILIER / JOUEUR », avec
 * l'illustration animée de l'étape 3 du « Comment jouer » et la consigne du rôle. Tous les
 * écrans la voient simultanément (le timer serveur démarre à sa fin). Mode local
 * uniquement : à distance elle n'est pas affichée (cf. Game.tsx), chacun jouant sur
 * son propre écran.
 */
const GuessingIntroOverlay = ({ isLeader }: { isLeader: boolean }) => {
  const { t } = useLocale();
  const intro = t.phases.guessing.intro;
  return (
    <RoleIntroOverlay
      label={intro.youAre}
      role={isLeader ? intro.roleLeader : intro.rolePlayer}
      aura={isLeader ? 'var(--color-warning-300)' : 'var(--color-brand-400)'}
      illustration={STEP_ILLUSTRATIONS[2]}
      text={isLeader ? intro.leaderText : intro.playerLocalText}
      durationMs={GAME_CONSTANTS.GUESSING_INTRO_MS}
    />
  );
};

export default GuessingIntroOverlay;
