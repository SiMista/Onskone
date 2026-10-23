import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { GAME_CONSTANTS } from '@onskone/shared';
import Avatar from '../Avatar';
import PremiumName from '../PremiumName';
import { useLocale } from '../../i18n';
import { playRevealVerdict } from '../../utils/sounds';

interface RevealAuthorOverlayProps {
  name: string;
  avatarId: number;
  premium?: boolean;
  /** Le pilier avait-il bien deviné ? Pilote la couleur du halo, les confettis ou la secousse. */
  correct: boolean;
  /** Appelé à la fin du timer strict (pas de fermeture au tap). */
  onDone: () => void;
}

// Confettis : pièces pré-calculées (déterministes, pas de Math.random au render).
const CONFETTI_COLORS = [
  'var(--color-success-400)',
  'var(--color-warning-300)',
  'var(--color-brand-400)',
  'var(--color-premium-300)',
  'var(--color-danger-400)',
  'var(--color-cream-player)',
];
// 3 formes : rectangle, bandelette, rond.
const CONFETTI_SHAPES = ['w-[0.55rem] h-[0.9rem]', 'w-[0.3rem] h-[1.2rem]', 'w-[0.6rem] h-[0.6rem] rounded-full'];
const rand = (i: number, k: number) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const CONFETTI_PIECES = Array.from({ length: 60 }, (_, i) => {
  // Deux canons, un sur chaque bord (bas de l'écran), qui tirent en éventail vers le haut et l'intérieur.
  const fromLeft = i % 2 === 0;
  const dir = fromLeft ? 1 : -1;
  const angle = (25 + rand(i, 1) * 55) * (Math.PI / 180); // 25°-80° au-dessus de l'horizontale
  const radius = 50 + rand(i, 2) * 60; // vmin
  const x1 = dir * Math.cos(angle) * radius;
  const y1 = -Math.sin(angle) * radius;
  return {
    left: fromLeft ? '-1rem' : 'calc(100% + 1rem)',
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    shape: CONFETTI_SHAPES[i % CONFETTI_SHAPES.length],
    x1: `${x1.toFixed(1)}vmin`,
    y1: `${y1.toFixed(1)}vmin`,
    x2: `${(x1 + (rand(i, 3) - 0.5) * 16).toFixed(1)}vmin`,
    y2: `${(y1 + 38 + rand(i, 4) * 34).toFixed(1)}vmin`,
    rot: `${Math.round((rand(i, 5) - 0.5) * 1000)}deg`,
    delay: `${450 + Math.round(rand(i, 6) * 50)}ms`,
    flipDelay: `${Math.round(rand(i, 7) * 300)}ms`,
  };
});

/** "Paf" de confettis tirés des deux bords, en bas de l'écran (one-shot, coupé en reduced-motion). */
const Confetti = () => (
  <div aria-hidden className="reveal-author-confetti absolute inset-0 overflow-hidden pointer-events-none">
    {CONFETTI_PIECES.map((c, i) => (
      <span
        key={i}
        className="animate-reveal-author-confetti absolute top-[88%]"
        style={{
          left: c.left,
          animationDelay: c.delay,
          '--x1': c.x1,
          '--y1': c.y1,
          '--x2': c.x2,
          '--y2': c.y2,
          '--rot': c.rot,
        } as React.CSSProperties}
      >
        <span
          className={`animate-reveal-author-flip block -ml-1 -mt-1.5 ${c.shape}`}
          style={{ background: c.color, animationDelay: c.flipDelay }}
        />
      </span>
    ))}
  </div>
);

/**
 * Overlay plein écran "qui a écrit cette réponse ?" : fond noir, halo de la
 * couleur du verdict, grosse tête + pseudo sur sticker papier (doré si premium). Affiché REVEAL_AUTHOR_OVERLAY_MS sur le
 * tel du joueur dont la carte vient d'être révélée, que tout le monde voit.
 * Rendu dans un portail sur `document.body` : sinon un ancêtre transformé/clippé de
 * la frame de jeu ferait du `fixed` un simple overlay local au lieu du plein écran.
 */
const RevealAuthorOverlay = ({ name, avatarId, premium = false, correct, onDone }: RevealAuthorOverlayProps) => {
  const { t } = useLocale();
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // Jingle de verdict à l'apparition de l'overlay (une fois, `correct` ne change pas en cours de route).
  useEffect(() => {
    playRevealVerdict(correct);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => onDoneRef.current(), GAME_CONSTANTS.REVEAL_AUTHOR_OVERLAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const stateLabel = correct ? t.phases.reveal.authorCorrect : t.phases.reveal.authorWrong;

  const avatar = (
    <Avatar avatarId={avatarId} name={name} size="xl" className="!w-full !h-full" />
  );

  return createPortal(
    <div
      role="status"
      aria-label={`${name} - ${stateLabel}`}
      className="animate-reveal-author-backdrop reveal-author-bg fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 px-6 overflow-hidden"
      style={{
        animationDuration: `${GAME_CONSTANTS.REVEAL_AUTHOR_OVERLAY_MS}ms`,
        // Vert si bien deviné, rouge sinon (le doré premium reste sur l'anneau et le pseudo).
        '--burst-color': correct ? 'var(--color-success-500)' : 'var(--color-danger-500)',
      } as React.CSSProperties}
    >
      <p className="animate-reveal-author-name relative text-display-xs text-white/70">{t.phases.reveal.writtenBy}</p>

      <div className="animate-reveal-author-avatar relative w-[min(45vw,45vh,16rem)] aspect-square">
        <div aria-hidden className="reveal-author-halo absolute inset-[-45%] rounded-full" />
        <div className={`relative w-full h-full ${correct ? '' : 'animate-reveal-author-shake'}`}>
          <div className={`reveal-author-ring w-full h-full rounded-full ${premium ? '' : 'border-4 border-white'}`}>
            {premium ? (
              <div className="bg-premium-gold rounded-full p-1.5 w-full h-full">{avatar}</div>
            ) : (
              avatar
            )}
          </div>
        </div>
      </div>

      {/* Pseudo sur sticker papier crème (même langage que les cartes du jeu) */}
      <div className="animate-reveal-author-name relative max-w-full">
        <div className="bg-cream-player border-2 border-black rounded-2xl stack-shadow-lg texture-paper px-6 py-2 -rotate-2">
          <PremiumName
            name={name}
            premium={premium}
            className="block font-sans font-bold text-4xl tablet:text-5xl leading-tight text-black text-center break-words"
          />
        </div>
      </div>

      {correct && <Confetti />}
    </div>,
    document.body,
  );
};

export default RevealAuthorOverlay;
