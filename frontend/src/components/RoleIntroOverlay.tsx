import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatedIllustration, type StepIllustration } from './StepIllustrations';

// L'illustration entre à 0,6 s pendant 0,45 s (animate-role-intro-img) : activée à 250 ms,
// ses animations démarrent ILLU_ANIM_DELAY_MS plus tard, une fois qu'elle est posée.
const ILLUSTRATION_START_MS = 250;

/**
 * Écran de rôle plein écran, socle commun des intros de phase (« Tu es PILIER /
 * JOUEUR » au GUESSING, « À ton tour d'être PILIER » au choix de la question) :
 * même fond noir que l'overlay « qui a écrit ? » du REVEAL, le rôle en gros dans la
 * couleur de son aura (jaune pilier, bleu joueur), l'illustration animée de l'étape
 * (la même que dans « Comment jouer ? ») posée sur l'aura et une consigne très courte.
 *
 * Purement visuel : c'est Game.tsx qui décide quand il s'affiche et qui le retire à
 * la fin de `durationMs` (le serveur décale d'autant le timer de la phase). Durée
 * stricte, pas de fermeture au tap. Rendu dans un portail sur `document.body`
 * (cf. RevealAuthorOverlay).
 */
const RoleIntroOverlay = ({ label, role, aura, illustration, illustrationClassName = '', text, durationMs }: {
  /** Petit texte au-dessus du rôle (« Tu es », « À ton tour d'être »). */
  label: string;
  role: string;
  /** Couleur du rôle et de l'aura (var CSS d'un token). */
  aura: string;
  illustration: StepIllustration;
  /** Ajustement de l'illustration (ex. zoom d'une image à grandes marges transparentes). */
  illustrationClassName?: string;
  text: string;
  durationMs: number;
}) => {
  const [illustrationStarted, setIllustrationStarted] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setIllustrationStarted(true), ILLUSTRATION_START_MS);
    return () => clearTimeout(timer);
  }, []);

  return createPortal(
    <div
      role="status"
      aria-label={`${label} ${role}`}
      className="animate-reveal-author-backdrop reveal-author-bg fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 px-6 overflow-hidden"
      style={{
        animationDuration: `${durationMs}ms`,
        '--burst-color': aura,
      } as React.CSSProperties}
    >
      <div className="relative text-center">
        <p className="text-display-xs text-white/70">{label}</p>
        <p
          className="animate-role-intro-role font-display font-bold text-6xl tablet:text-7xl leading-none tracking-wide"
          style={{ color: aura, textShadow: '3px 4px 0 rgba(0,0,0,0.5)' }}
        >
          {role}
        </p>
      </div>

      <div className="animate-role-intro-img relative w-[min(70vw,40dvh,24rem)] aspect-square">
        <div aria-hidden className="reveal-author-halo absolute inset-[-35%] rounded-full" style={{ opacity: 0.4 }} />
        {/* Sans caméra : son voile blanc est fait pour les fonds clairs, pas pour ce fond noir. */}
        <div className={`relative w-full h-full flex items-center ${illustrationClassName}`}>
          <AnimatedIllustration
            illustration={illustration}
            active={illustrationStarted}
            withCamera={false}
            shadow="drop-shadow(3px 4px 0 rgba(0,0,0,0.4))"
          />
        </div>
      </div>

      <p className="animate-role-intro-text relative max-w-md text-center text-xl tablet:text-2xl font-bold leading-snug text-white">
        {text}
      </p>
    </div>,
    document.body,
  );
};

export default RoleIntroOverlay;
