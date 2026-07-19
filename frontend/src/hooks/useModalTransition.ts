import { useCallback, useEffect, useRef, useState } from 'react';

// Durée de l'animation de fermeture (doit matcher les keyframes *-out en CSS).
const EXIT_MS = 220;

export interface ModalTransition {
  /** true tant que la modale doit rester montée (ouverte OU en cours de fermeture). */
  render: boolean;
  /** true pendant l'animation de sortie : à utiliser pour appliquer les classes *-out. */
  closing: boolean;
  /**
   * À câbler sur backdrop / croix / Escape à la place de `onClose` :
   * lance l'animation de sortie puis appelle `onClose` une fois finie.
   */
  requestClose: () => void;
}

/**
 * Donne aux modales une animation de SORTIE (les composants qui font `return null`
 * dès `isOpen=false` disparaissent sèchement, sans fondu). On garde la modale
 * montée `EXIT_MS` de plus, le temps de jouer les keyframes *-out, puis on
 * démonte en appelant `onClose`.
 *
 * Usage :
 *   const { render, closing, requestClose } = useModalTransition(isOpen, onClose);
 *   if (!render) return null;
 *   <div onClick={requestClose} className={closing ? 'animate-modal-backdrop-out' : 'animate-modal-backdrop'}>
 *     <div className={closing ? 'animate-modal-content-out' : 'animate-modal-content'} ...>
 */
export function useModalTransition(isOpen: boolean, onClose: () => void): ModalTransition {
  const [render, setRender] = useState(isOpen);
  const [closing, setClosing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ouverture : (re)monte immédiatement et annule une éventuelle sortie en cours.
  useEffect(() => {
    if (isOpen) {
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
      setClosing(false);
      setRender(true);
    }
  }, [isOpen]);

  // Fermeture pilotée par le parent (isOpen -> false sans passer par requestClose).
  useEffect(() => {
    if (!isOpen && render && !closing) {
      setClosing(true);
      timer.current = setTimeout(() => { setRender(false); setClosing(false); }, EXIT_MS);
    }
  }, [isOpen, render, closing]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const requestClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    timer.current = setTimeout(() => {
      setRender(false);
      setClosing(false);
      onClose();
    }, EXIT_MS);
  }, [closing, onClose]);

  return { render, closing, requestClose };
}
