import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import step3Img from '../assets/images/home/3-guessing.png';
import { useLocale } from '../i18n';
import { GAME_CONSTANTS, type GameMode } from '@onskone/shared';

const { GUESSING_INTRO_MS } = GAME_CONSTANTS;

/**
 * Overlay plein écran à l'entrée en phase GUESSING : même fond noir que
 * l'overlay « qui a écrit ? » du REVEAL, avec le rôle en gros (« Tu es PILIER /
 * JOUEUR »), l'illustration de l'étape 3 du « Comment jouer » sur une aura
 * jaune (pilier) ou bleue (joueur), et une consigne très courte. Durée stricte
 * (pas de fermeture au tap) : tous les écrans le voient simultanément, et le
 * timer serveur démarre à sa fin. Rendu dans un portail sur `document.body`
 * (cf. RevealAuthorOverlay).
 */
const GuessingIntroOverlay = ({ isLeader, gameMode, onDone }: {
  isLeader: boolean;
  gameMode: GameMode;
  onDone: () => void;
}) => {
  const { t } = useLocale();
  const intro = t.phases.guessing.intro;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const timer = setTimeout(() => onDoneRef.current(), GUESSING_INTRO_MS);
    return () => clearTimeout(timer);
  }, []);

  const role = isLeader ? intro.roleLeader : intro.rolePlayer;
  const text = isLeader ? intro.leaderText : gameMode === 'remote' ? intro.playerRemoteText : intro.playerLocalText;
  const aura = isLeader ? 'var(--color-warning-300)' : 'var(--color-brand-400)';

  return createPortal(
    <div
      role="status"
      aria-label={`${intro.youAre} ${role}`}
      className="animate-reveal-author-backdrop reveal-author-bg fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 px-6 overflow-hidden"
      style={{
        animationDuration: `${GUESSING_INTRO_MS}ms`,
        '--burst-color': aura,
      } as React.CSSProperties}
    >
      <div className="relative text-center">
        <p className="text-display-xs text-white/70">{intro.youAre}</p>
        <p
          className="animate-guessing-intro-role font-display font-bold text-6xl tablet:text-7xl leading-none tracking-wide"
          style={{ color: aura, textShadow: '3px 4px 0 rgba(0,0,0,0.5)' }}
        >
          {role}
        </p>
      </div>

      <div className="animate-guessing-intro-img relative w-[min(70vw,40dvh,24rem)] aspect-square">
        <div aria-hidden className="reveal-author-halo absolute inset-[-35%] rounded-full" style={{ opacity: 0.4 }} />
        <img
          src={step3Img}
          alt=""
          aria-hidden
          draggable={false}
          className="relative w-full h-full object-contain"
          style={{ filter: 'drop-shadow(3px 4px 0 rgba(0,0,0,0.4))' }}
        />
      </div>

      <p className="animate-guessing-intro-text relative max-w-md text-center text-xl tablet:text-2xl font-bold leading-snug text-white">
        {text}
      </p>
    </div>,
    document.body,
  );
};

export default GuessingIntroOverlay;
