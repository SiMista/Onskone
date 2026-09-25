import { ReactNode } from 'react';
import ModalShell from './ModalShell';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /**
   * Bloc affiché entre le séparateur pointillé et la zone scrollable, en dehors
   * du scroll. Utile pour une barre d'onglets ou tout sous-header qui doit
   * rester visible et collé au header sans qu'on tente de le rendre sticky
   * (ce qui laisserait toujours un gap avec le padding du scroll body).
   */
  subHeader?: ReactNode;
  /**
   * Laisse la modale ouverte au retour de l'app au premier plan (cf.
   * useModalChrome / closeAllOnResume). À poser sur toute modale qui porte une
   * SAISIE utilisateur : un simple alt-tab ou changement d'app déclenche
   * `visibilitychange`, et refermer la modale jetterait le brouillon.
   */
  keepOnResume?: boolean;
}

const Modal = ({ isOpen, onClose, title, children, subHeader, keepOnResume }: ModalProps) => (
  <ModalShell isOpen={isOpen} onClose={onClose} title={title} subHeader={subHeader} keepOnResume={keepOnResume}>
    {children}
  </ModalShell>
);

export default Modal;
