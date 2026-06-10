import { useRef } from 'react';

interface UseSwipeOptions {
  /** Swipe vers la droite (dx > 0). Typiquement "précédent". */
  onPrev: () => void;
  /** Swipe vers la gauche (dx < 0). Typiquement "suivant". */
  onNext: () => void;
  /**
   * Distance horizontale minimale (px) pour valider un swipe. Sous ce seuil,
   * le geste est ignoré. Défaut 50 (aligné sur QuestionSelection).
   */
  threshold?: number;
  /**
   * Appelé au tout début du geste (touchstart / mousedown), avant tout calcul.
   * Sert par ex. à masquer un hint de swipe ou à mettre en pause un autoplay.
   */
  onInteract?: () => void;
  /**
   * Appelé pendant le geste (touchmove) avec le déplacement horizontal courant
   * `dx = x - startX`. Sert au suivi 1:1 du doigt (drag live d'un carousel).
   * `dx` revient à 0 à la fin / l'annulation du geste.
   */
  onMove?: (dx: number) => void;
}

interface SwipeHandlers {
  /** À spread sur l'élément : `<div {...touchHandlers} {...mouseHandlers} />`. */
  touchHandlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
    onTouchCancel: () => void;
  };
  mouseHandlers: {
    onMouseDown: (e: React.MouseEvent) => void;
    onMouseUp: (e: React.MouseEvent) => void;
    onMouseLeave: () => void;
  };
}

/**
 * Détection de swipe horizontal tactile + souris, factorisée depuis la logique
 * de QuestionSelection / HowToPlayCarousel.
 *
 * Garde-fous (seuils exacts d'origine) :
 *  - on ignore si `abs(dx) < threshold` (geste trop court) ;
 *  - on ignore si `abs(dx) < abs(dy)` (intention verticale = scroll, pas swipe).
 *
 * `dx > 0` (vers la droite) déclenche `onPrev`, `dx < 0` (vers la gauche)
 * déclenche `onNext`.
 */
export function useSwipe({ onPrev, onNext, threshold = 50, onInteract, onMove }: UseSwipeOptions): SwipeHandlers {
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);

  const begin = (x: number, y: number) => {
    onInteract?.();
    startXRef.current = x;
    startYRef.current = y;
  };

  const move = (x: number) => {
    if (startXRef.current === null) return;
    onMove?.(x - startXRef.current);
  };

  const end = (x: number, y: number) => {
    if (startXRef.current === null || startYRef.current === null) return;
    const dx = x - startXRef.current;
    const dy = y - startYRef.current;
    startXRef.current = null;
    startYRef.current = null;
    onMove?.(0);
    if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy)) return;
    if (dx > 0) onPrev();
    else onNext();
  };

  const cancel = () => {
    startXRef.current = null;
    startYRef.current = null;
    onMove?.(0);
  };

  return {
    touchHandlers: {
      onTouchStart: (e) => begin(e.touches[0].clientX, e.touches[0].clientY),
      onTouchMove: (e) => move(e.touches[0].clientX),
      onTouchEnd: (e) => end(e.changedTouches[0].clientX, e.changedTouches[0].clientY),
      onTouchCancel: cancel,
    },
    mouseHandlers: {
      onMouseDown: (e) => begin(e.clientX, e.clientY),
      onMouseUp: (e) => end(e.clientX, e.clientY),
      onMouseLeave: cancel,
    },
  };
}
