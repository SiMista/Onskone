import { useEffect, useRef } from 'react';

/**
 * Pile partagée (module-level) des modales actuellement ouvertes. Permet un
 * comportement de stack : seule la modale au sommet répond à Escape, et le
 * scroll du body n'est verrouillé qu'à l'ouverture de la PREMIÈRE modale puis
 * restauré au démontage de la DERNIÈRE (évite qu'un seul Escape ferme toutes
 * les modales empilées et que chaque modale réinitialise `overflow` de son côté).
 */
const modalStack: object[] = [];
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
  // Jeton stable et unique par instance de modale (identité par référence dans
  // la pile). `useRef({}).current` reste le même objet à travers les renders.
  const token = useRef({}).current;

  // Garder la ref onClose à jour pour que l'effet ne dépende que de `isOpen`
  // (sinon un changement de handler dépilerait/rempilerait la modale).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    // Verrouiller le scroll uniquement à l'empilement de la première modale.
    if (modalStack.length === 0) {
      savedBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    modalStack.push(token);

    const onKeyDown = (e: KeyboardEvent) => {
      // Seule la modale au sommet de la pile réagit à Escape.
      if (e.key === 'Escape' && modalStack[modalStack.length - 1] === token) {
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const idx = modalStack.indexOf(token);
      if (idx !== -1) modalStack.splice(idx, 1);
      // Restaurer le scroll seulement au démontage de la dernière modale.
      if (modalStack.length === 0) {
        document.body.style.overflow = savedBodyOverflow;
        savedBodyOverflow = '';
      }
    };
    // `token` est stable (useRef().current) : l'inclure satisfait exhaustive-deps
    // sans changer le comportement — l'effet ne se re-exécute qu'au changement d'`isOpen`.
  }, [isOpen, token]);
}
