import { RefObject, useEffect, useLayoutEffect } from 'react';

/**
 * Détecte si un conteneur scrollable a du contenu caché au-dessus et/ou en
 * dessous du viewport, et règle directement l'opacité des deux fades (haut / bas).
 * Sert d'indice "scroll possible" (iOS Safari cache la scrollbar native, donc
 * pas d'autre indice visuel). Chaque fade disparaît au bord atteint (à 4px près).
 *
 * Volontairement SANS state React : la mesure est relue à chaque rendu, au scroll,
 * au resize et quand le contenu change de taille. Passer par un setState dans un
 * layout effect sans deps rendait la page vulnérable à une boucle infinie
 * (React #185, crash de l'app) dès que la mesure oscille d'un rendu à l'autre (WebView
 * natif, scrollTop fractionnaire / rebond iOS). Écrire dans le DOM ne peut pas boucler.
 */
export const useScrollFade = (
  ref: RefObject<HTMLElement | null>,
  topRef: RefObject<HTMLElement | null>,
  bottomRef: RefObject<HTMLElement | null>,
): void => {
  const recompute = () => {
    const el = ref.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const top = scrollTop > 4;
    const bottom = scrollHeight - clientHeight - scrollTop > 4;
    if (topRef.current) topRef.current.style.opacity = top ? '1' : '0';
    if (bottomRef.current) bottomRef.current.style.opacity = bottom ? '1' : '0';
  };

  // Après chaque rendu (changement d'onglet, de contenu) : sans état, aucun risque de boucle.
  useLayoutEffect(() => {
    recompute();
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener('scroll', recompute, { passive: true });
    window.addEventListener('resize', recompute);
    // Le conteneur ET ses enfants directs : un contenu qui grandit (image, police,
    // données async) ne change pas la boîte du conteneur lui-même.
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
