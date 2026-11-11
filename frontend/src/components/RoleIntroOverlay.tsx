import { createPortal } from 'react-dom';

/**
 * Écran de rôle plein écran, socle commun des intros de phase (« Tu es PILIER /
 * JOUEUR » au GUESSING, « À ton tour d'être PILIER » au choix de la question) :
 * même fond noir que l'overlay « qui a écrit ? » du REVEAL, le rôle en gros dans la
 * couleur de son aura (jaune pilier, bleu joueur), une illustration posée sur l'aura
 * et une consigne très courte.
 *
 * Purement visuel : c'est Game.tsx qui décide quand il s'affiche et qui le retire à
 * la fin de `durationMs` (le serveur décale d'autant le timer de la phase). Durée
 * stricte, pas de fermeture au tap. Rendu dans un portail sur `document.body`
 * (cf. RevealAuthorOverlay).
 */
const RoleIntroOverlay = ({ label, role, aura, image, imageClassName = '', text, durationMs }: {
  /** Petit texte au-dessus du rôle (« Tu es », « À ton tour d'être »). */
  label: string;
  role: string;
  /** Couleur du rôle et de l'aura (var CSS d'un token). */
  aura: string;
  image: string;
  /** Ajustement de l'illustration (ex. zoom d'une image à grandes marges transparentes). */
  imageClassName?: string;
  text: string;
  durationMs: number;
}) => createPortal(
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
      <img
        src={image}
        alt=""
        aria-hidden
        draggable={false}
        className={`relative w-full h-full object-contain ${imageClassName}`}
        style={{ filter: 'drop-shadow(3px 4px 0 rgba(0,0,0,0.4))' }}
      />
    </div>

    <p className="animate-role-intro-text relative max-w-md text-center text-xl tablet:text-2xl font-bold leading-snug text-white">
      {text}
    </p>
  </div>,
  document.body,
);

export default RoleIntroOverlay;
