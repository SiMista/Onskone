import { RefObject, useEffect, useLayoutEffect, useState } from 'react';

export interface ScrollFadeState {
  /** Du contenu est passé au-dessus du viewport (on a scrollé). */
  top: boolean;
  /** Il reste du contenu sous le viewport. */
  bottom: boolean;
}

/**
 * Détecte si un conteneur scrollable a du contenu caché au-dessus et/ou en
 * dessous du viewport. Sert à afficher conditionnellement un fade en haut et en
 * bas comme indice "scroll possible" (iOS Safari cache la scrollbar native, donc
 * pas d'autre indice visuel). Chaque fade disparaît au bord atteint (à 4px près).
 */
export const useScrollFade = (ref: RefObject<HTMLElement | null>): ScrollFadeState => {
  const [fade, setFade] = useState<ScrollFadeState>({ top: false, bottom: false });

  const recompute = () => {
    const el = ref.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const top = scrollTop > 4;
    const bottom = scrollHeight - clientHeight - scrollTop > 4;
    // Même objet si rien ne change : recompute tourne à chaque rendu (layout effect
    // sans deps), un nouvel objet relancerait un rendu en boucle.
    setFade(prev => (prev.top === top && prev.bottom === bottom ? prev : { top, bottom }));
  };

  useLayoutEffect(() => {
    recompute();
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener('scroll', recompute, { passive: true });
    window.addEventListener('resize', recompute);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(recompute) : null;
    if (ro) ro.observe(el);
    return () => {
      el.removeEventListener('scroll', recompute);
      window.removeEventListener('resize', recompute);
      ro?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);

  return fade;
};
