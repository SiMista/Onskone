import { useEffect, useRef } from 'react';

/**
 * Pile partagée (module-level) des modales actuellement ouvertes. Permet un
 * comportement de stack : seule la modale au sommet répond à Escape, et le
 * scroll du body n'est verrouillé qu'à l'ouverture de la PREMIÈRE modale puis
 * restauré au démontage de la DERNIÈRE (évite qu'un seul Escape ferme toutes
 * les modales empilées et que chaque modale réinitialise `overflow` de son côté).
 */
const modalStack: number[] = [];
let nextModalId = 1;
let savedBodyOverflow = '';

/**
 * "Chrome" commun aux modales plein-écran : tant que `isOpen` est vrai,
 *  - bloque le scroll du body (`document.body.style.overflow = 'hidden'`,
 *    restauré quand la dernière modale se ferme) ;
 *  - ferme la modale au clavier sur Escape (uniquement si elle est au sommet
 *    de la pile).
 *
 * Mutualisé entre ModalShell (modales papier) et ThemePickerModal (layout
 * plein-écran sombre distinct, qui n'adopte que ce comportement chrome).
 */
export function useModalChrome(isOpen: boolean, onClose: () => void): void {
  // Identifiant stable pour cette instance de modale (utilisé dans la pile).
  const idRef = useRef<number>(0);
  if (idRef.current === 0) idRef.current = nextModalId++;

  // Garder la ref onClose à jour pour que l'effet ne dépende que de `isOpen`
  // (sinon un changement de handler dépilerait/rempilerait la modale).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const id = idRef.current;

    // Verrouiller le scroll uniquement à l'empilement de la première modale.
    if (modalStack.length === 0) {
      savedBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    modalStack.push(id);

    const onKeyDown = (e: KeyboardEvent) => {
      // Seule la modale au sommet de la pile réagit à Escape.
      if (e.key === 'Escape' && modalStack[modalStack.length - 1] === id) {
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const idx = modalStack.lastIndexOf(id);
      if (idx !== -1) modalStack.splice(idx, 1);
      // Restaurer le scroll seulement au démontage de la dernière modale.
      if (modalStack.length === 0) {
        document.body.style.overflow = savedBodyOverflow;
        savedBodyOverflow = '';
      }
    };
  }, [isOpen]);
}
