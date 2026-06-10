import { useEffect } from 'react';

/**
 * "Chrome" commun aux modales plein-écran : tant que `isOpen` est vrai,
 *  - bloque le scroll du body (`document.body.style.overflow = 'hidden'`,
 *    restauré à la fermeture) ;
 *  - ferme la modale au clavier sur Escape.
 *
 * Mutualisé entre ModalShell (modales papier) et ThemePickerModal (layout
 * plein-écran sombre distinct, qui n'adopte que ce comportement chrome).
 */
export function useModalChrome(isOpen: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);
}
