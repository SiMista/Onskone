import { ReactNode } from 'react';
import ModalShell from './ModalShell';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /**
   * Désactive le fade blanc en bas du contenu (utile quand le contenu est un
   * carousel ou autre composant qui gère lui-même son débord).
   */
  disableScrollFade?: boolean;
  /** Ne pas refermer automatiquement au retour de l'app (cf. ModalShell). */
  keepOnResume?: boolean;
}

const InfoModal = ({ isOpen, onClose, title, children, disableScrollFade = false, keepOnResume = false }: InfoModalProps) => (
  <ModalShell
    isOpen={isOpen}
    onClose={onClose}
    title={title}
    // font-accent (Fraunces) donne un côté éditorial qui contraste avec Fredoka.
    titleFont="accent"
    washiTape
    disableScrollFade={disableScrollFade}
    keepOnResume={keepOnResume}
  >
    {children}
  </ModalShell>
);

export default InfoModal;
