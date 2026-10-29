import { RefObject, useRef } from 'react';
import { useScrollFade } from '../hooks/useScrollFade';

interface ScrollFadeProps {
  /** Ref du conteneur scrollable - sert à détecter le contenu caché au-dessus / en dessous. */
  scrollRef: RefObject<HTMLElement | null>;
  /**
   * Classes additionnelles du fade du bas - typiquement le border-radius bas pour
   * matcher la bordure du parent (ex: "rounded-b-[25px]", "rounded-b-2xl").
   */
  className?: string;
  /**
   * Couleur opaque (#rrggbb) du fond sous la liste, quand il n'est pas blanc (ex.
   * fond teinté par catégorie) : le fade s'y fond au lieu de laisser une bande blanche.
   */
  color?: string;
}

const WHITE_GRADIENT = {
  top: 'bg-gradient-to-b from-white via-white/85 to-transparent',
  bottom: 'bg-gradient-to-t from-white via-white/85 to-transparent',
};

/**
 * Fades blancs en haut et en bas d'un scroll container, indices visuels "il y a
 * du contenu par là" (iOS Safari cache la scrollbar native). Chacun disparaît
 * dès qu'on atteint son bord. À placer dans un parent `relative overflow-hidden`
 * qui épouse le scroll container (le fade du haut se cale sur le haut du parent).
 */
const ScrollFade = ({ scrollRef, className = '', color }: ScrollFadeProps) => {
  const topRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  useScrollFade(scrollRef, topRef, bottomRef);
  const base = 'pointer-events-none absolute inset-x-0 transition-opacity duration-150';
  // Même profil que le dégradé blanc : plein, 85 % (alpha d9) à mi-hauteur, transparent.
  const colorStyle = (direction: 'to top' | 'to bottom') =>
    color ? { backgroundImage: `linear-gradient(${direction}, ${color}, ${color}d9, ${color}00)` } : undefined;
  return (
    <>
      {/* Haut : plus court que celui du bas, pour ne pas masquer la première ligne visible. */}
      {/* L'opacité est pilotée en direct par useScrollFade (cachés tant que non mesurés). */}
      <div
        ref={topRef}
        aria-hidden
        className={`${base} top-0 h-8 md:h-10 ${color ? '' : WHITE_GRADIENT.top}`}
        style={{ opacity: 0, ...colorStyle('to bottom') }}
      />
      <div
        ref={bottomRef}
        aria-hidden
        className={`${base} bottom-0 h-12 md:h-14 ${color ? '' : WHITE_GRADIENT.bottom} ${className}`}
        style={{ opacity: 0, ...colorStyle('to top') }}
      />
    </>
  );
};

export default ScrollFade;
