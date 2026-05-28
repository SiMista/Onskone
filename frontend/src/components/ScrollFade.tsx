import { RefObject } from 'react';
import { useScrollFade } from '../hooks/useScrollFade';

interface ScrollFadeProps {
  /** Ref du conteneur scrollable - sert à détecter s'il reste du contenu sous le viewport. */
  scrollRef: RefObject<HTMLElement | null>;
  /**
   * Classes additionnelles - typiquement le border-radius bas pour matcher
   * la bordure du parent (ex: "rounded-b-[25px]", "rounded-b-2xl").
   */
  className?: string;
}

/**
 * Fade blanc en bas d'un scroll container, indice visuel "il reste du contenu
 * à scroller" (iOS Safari cache la scrollbar native). Disparaît dès qu'on
 * atteint le bas. À placer dans un parent `relative overflow-hidden`.
 */
const ScrollFade = ({ scrollRef, className = '' }: ScrollFadeProps) => {
  const show = useScrollFade(scrollRef);
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-x-0 bottom-0 h-12 md:h-14 bg-gradient-to-t from-white via-white/85 to-transparent transition-opacity duration-150 ${show ? 'opacity-100' : 'opacity-0'} ${className}`}
    />
  );
};

export default ScrollFade;
