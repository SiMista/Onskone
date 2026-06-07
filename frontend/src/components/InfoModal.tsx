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
}

const InfoModal = ({ isOpen, onClose, title, children, disableScrollFade = false }: InfoModalProps) => (
  <ModalShell
    isOpen={isOpen}
    onClose={onClose}
    title={title}
    // font-accent (Fraunces) donne un côté éditorial qui contraste avec Fredoka.
    titleFont="accent"
    washiTape
    disableScrollFade={disableScrollFade}
  >
    {children}
  </ModalShell>
);

export default InfoModal;
