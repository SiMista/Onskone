import { RefObject, useEffect, useLayoutEffect, useState } from 'react';

/**
 * Détecte si un conteneur scrollable a encore du contenu en dessous du viewport.
 * Sert à afficher conditionnellement un fade en bas comme indice "scroll possible"
 * (iOS Safari cache la scrollbar native, donc pas d'autre indice visuel).
 * Le fade disparaît dès qu'on est arrivé en bas (à 4px près).
 */
export const useScrollFade = (ref: RefObject<HTMLElement | null>): boolean => {
  const [showFade, setShowFade] = useState(false);

  const recompute = () => {
    const el = ref.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    setShowFade(scrollHeight - clientHeight - scrollTop > 4);
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

  return showFade;
};
