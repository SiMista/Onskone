import { useCallback, useEffect, useRef, type MouseEvent as ReactMouseEvent } from 'react';

/**
 * Pile partagée (module-level) des modales actuellement ouvertes. Permet un
 * comportement de stack : seule la modale au sommet répond à Escape / au clic
 * backdrop, et le scroll du body n'est verrouillé qu'à l'ouverture de la
 * PREMIÈRE modale puis restauré au démontage de la DERNIÈRE (évite qu'un seul
 * Escape ferme toutes les modales empilées et que chaque modale réinitialise
 * `overflow` de son côté).
 */
interface ModalEntry {
  /** Identité par référence (le jeton de l'instance). */
  token: object;
  /** Fermeture de CETTE modale, à jour (lue via ref). */
  close: () => void;
  /** Exclue de la fermeture groupée au retour de l'app. */
  keepOnResume: boolean;
}

const modalStack: ModalEntry[] = [];
let savedBodyOverflow = '';

/**
 * Referme toutes les modales ouvertes, sauf celles qui s'en excluent
 * (`keepOnResume`). Appelé au retour de l'app au premier plan : revenir d'un
 * scan de QR code sur un jeu couvert de fenêtres à fermer une par une est
 * pénible, et pendant ce temps la partie avance.
 *
 * On itère sur une COPIE, du sommet vers la base : chaque `close()` déclenche un
 * démontage qui retire son entrée de la pile pendant le parcours.
 */
const closeAllOnResume = (): void => {
  for (const entry of [...modalStack].reverse()) {
    if (entry.keepOnResume) continue;
    entry.close();
  }
};

// Un seul écouteur pour toute l'app, quel que soit le nombre de modales montées.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') closeAllOnResume();
  });
}

export interface ModalChrome {
  /**
   * À câbler sur le `onClick` du backdrop plein écran à la place de `onClose` :
   * ne ferme que si le clic vise bien le backdrop lui-même ET que cette modale
   * est au sommet de la pile.
   *
   * Les deux gardes sont nécessaires. Une modale enfant rendue depuis le JSX
   * d'une modale parente (ex. PremiumModal depuis ThemePickerModal) reste son
   * enfant dans l'ARBRE REACT même si chacune a son propre portal vers <body> :
   * React fait remonter les events le long de l'arbre React, pas du DOM. Un clic
   * sur le backdrop de l'enfant atteint donc le `onClick` du backdrop du parent
   * et fermait les deux modales d'un coup.
   */
  onBackdropClick: (e: ReactMouseEvent) => void;
}

/**
 * "Chrome" commun aux modales plein-écran : tant que `isOpen` est vrai,
 *  - bloque le scroll du body (`document.body.style.overflow = 'hidden'`,
 *    restauré quand la dernière modale se ferme) ;
 *  - ferme la modale au clavier sur Escape (uniquement si elle est au sommet
 *    de la pile) ;
 *  - expose `onBackdropClick`, qui applique la même règle de sommet de pile au
 *    clic extérieur (cf. ModalChrome).
 *
 * Mutualisé entre ModalShell (modales papier) et ThemePickerModal (layout
 * plein-écran sombre distinct, qui n'adopte que ce comportement chrome).
 */
/**
 * Options de `useModalChrome`.
 */
export interface ModalChromeOptions {
  /**
   * Laisse la modale ouverte quand l'app revient au premier plan. À réserver aux
   * modales BLOQUANTES par nature (mise à jour obligatoire, partie déjà lancée) :
   * les refermer automatiquement laisserait passer ce qu'elles verrouillent.
   */
  keepOnResume?: boolean;
}

export function useModalChrome(
  isOpen: boolean,
  onClose: () => void,
  options: ModalChromeOptions = {},
): ModalChrome {
  const keepOnResume = options.keepOnResume === true;
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
    // `close` passe par la ref : l'entrée reste valide même si le handler change,
    // sans avoir à dépiler/rempiler (ce qui casserait l'ordre du stack).
    modalStack.push({ token, close: () => onCloseRef.current(), keepOnResume });

    const onKeyDown = (e: KeyboardEvent) => {
      // Seule la modale au sommet de la pile réagit à Escape.
      if (e.key === 'Escape' && modalStack[modalStack.length - 1]?.token === token) {
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const idx = modalStack.findIndex(e => e.token === token);
      if (idx !== -1) modalStack.splice(idx, 1);
      // Restaurer le scroll seulement au démontage de la dernière modale.
      if (modalStack.length === 0) {
        document.body.style.overflow = savedBodyOverflow;
        savedBodyOverflow = '';
      }
    };
    // `token` est stable (useRef().current) : l'inclure satisfait exhaustive-deps
    // sans changer le comportement — l'effet ne se re-exécute qu'au changement d'`isOpen`.
  }, [isOpen, token, keepOnResume]);

  const onBackdropClick = useCallback(
    (e: ReactMouseEvent) => {
      // Clic sur un enfant (la carte, ou le backdrop d'une modale empilée
      // au-dessus) : ce n'est pas un clic "en dehors" pour nous.
      if (e.target !== e.currentTarget) return;
      if (modalStack[modalStack.length - 1]?.token !== token) return;
      onCloseRef.current();
    },
    [token],
  );

  return { onBackdropClick };
}
