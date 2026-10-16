import { useEffect } from 'react';

/**
 * Écran de chargement du démarrage (#boot-splash : logo + barre de progression).
 * Posé en dur dans index.html pour s'afficher dès la première image, avant même
 * l'arrivée du JS (sinon : écran vide sur le web le temps du téléchargement).
 * Retiré quand l'appli est prête : premier écran peint, polices chargées
 * (plafonné) et aucune page lazy en attente (BootSplashHold). En natif, le splash
 * Android/iOS le recouvre au lancement (cf. App.tsx) : celui-ci prend le relais.
 */

// Au-delà, on n'attend plus les polices (réseau lent) : elles arriveront après.
const FONTS_MAX_WAIT_MS = 2500;
// Filet : quoi qu'il arrive, l'écran ne bloque jamais l'appli plus longtemps.
const SAFETY_MAX_MS = 10_000;
// Barre à 100 % puis fondu : aligné sur les transitions CSS de index.html.
const EXIT_MS = 600;

let holds = 0;
let ready = false;
let hidden = false;

const hide = (): void => {
  if (hidden) return;
  hidden = true;
  const el = document.getElementById('boot-splash');
  if (!el) return;
  // Fige la barre là où l'animation l'a menée, puis la pousse à 100 % : une
  // transition ne repart pas proprement d'une valeur animée.
  const fill = el.querySelector<HTMLElement>('.boot-splash__fill');
  if (fill) {
    fill.style.transition = 'none';
    fill.style.width = getComputedStyle(fill).width;
    fill.style.animation = 'none';
    void fill.offsetWidth; // applique l'état figé avant de relancer la transition
    fill.style.transition = '';
    fill.style.width = '100%';
  }
  el.classList.add('boot-splash--done');
  window.setTimeout(() => el.remove(), EXIT_MS);
};

const tryHide = (): void => {
  if (ready && holds === 0) hide();
};

const nextPaint = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

/** Retire l'écran une fois l'appli prête. Appelé une fois, au boot (index.tsx). */
export const hideBootSplashWhenReady = (): void => {
  const fontsTimeout = new Promise<void>((resolve) => { window.setTimeout(resolve, FONTS_MAX_WAIT_MS); });
  // Les polices ne se chargent qu'une fois utilisées : on attend d'abord que React
  // ait peint le premier écran (sous le splash), puis leur arrivée.
  nextPaint()
    .then(() => Promise.race([document.fonts?.ready ?? Promise.resolve(), fontsTimeout]))
    .then(() => {
      ready = true;
      tryHide();
    });
  window.setTimeout(hide, SAFETY_MAX_MS);
};

/**
 * Fallback du Suspense racine : tant qu'une page lazy (lobby, partie...) charge au
 * démarrage, l'écran reste affiché au lieu de céder la place à un écran vide.
 * Sans effet une fois l'écran retiré (navigations suivantes).
 */
export const BootSplashHold = (): null => {
  useEffect(() => {
    holds += 1;
    return () => {
      holds -= 1;
      // Différé : en StrictMode (dev), l'effet est démonté puis remonté aussitôt.
      window.setTimeout(tryHide, 0);
    };
  }, []);
  return null;
};
