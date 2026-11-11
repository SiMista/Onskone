import { RefObject, useEffect, useLayoutEffect } from 'react';

/**
 * Indice « il y a du contenu au-dessus / en dessous » par fondu transparent (mask-image,
 * cf. `.scroll-mask` dans index.css) au lieu d'un voile blanc : marche sur n'importe quel
 * fond (ici le bleu à motifs). Règle les variables CSS `--fade-top` / `--fade-bottom` du
 * conteneur ; chaque fondu disparaît au bord atteint. Comme useScrollFade : aucun state
 * React (écriture DOM seule, pas de boucle de rendu possible).
 */
const FADE_PX = '28px';

export const useScrollMask = (ref: RefObject<HTMLElement | null>): void => {
  const recompute = () => {
    const el = ref.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    el.style.setProperty('--fade-top', scrollTop > 4 ? FADE_PX : '0px');
    el.style.setProperty('--fade-bottom', scrollHeight - clientHeight - scrollTop > 4 ? FADE_PX : '0px');
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
    if (ro) {
      ro.observe(el);
      Array.from(el.children).forEach(child => ro.observe(child));
    }
    return () => {
      el.removeEventListener('scroll', recompute);
      window.removeEventListener('resize', recompute);
      ro?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);
};
