import { useState, useCallback, useEffect } from 'react';
import ModalShell from './ModalShell';
import Button from './Button';
import { LobbyCodeInput } from './LobbyCode';
import { useLocale } from '../i18n';

const LOBBY_CODE_LENGTH = 6;

interface JoinByCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (code: string) => void;
}

/**
 * Saisie manuelle d'un code de salon pour rejoindre une partie. À la validation,
 * remonte le code (uppercase, alphanumérique) au parent qui orchestre la jonction.
 * La popup ne se ferme pas elle-même : le parent décide après validation du code
 * (code invalide -> reste ouverte avec un toast).
 */
const JoinByCodeModal = ({ isOpen, onClose, onSubmit }: JoinByCodeModalProps) => {
  const { t } = useLocale();
  const [code, setCode] = useState('');

  // Réinitialise le champ à chaque ouverture (pas à la soumission : si le code
  // est invalide la popup reste ouverte avec la saisie en place).
  useEffect(() => {
    if (isOpen) setCode('');
  }, [isOpen]);

  const isComplete = code.length === LOBBY_CODE_LENGTH;

  const submit = useCallback(() => {
    if (code.length !== LOBBY_CODE_LENGTH) return;
    onSubmit(code);
  }, [code, onSubmit]);

  // Filtre alphanumérique + uppercase, borné à la longueur du code.
  const onChange = (value: string) => {
    setCode(value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, LOBBY_CODE_LENGTH));
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={t.home.joinByCode.modalTitle}
      maxWidth="md"
      scrollable={false}
      footer={
        <div className="flex justify-center">
          <Button
            text={t.home.joinByCode.submit}
            variant="warning"
            size="md"
            disabled={!isComplete}
            onClick={submit}
          />
        </div>
      }
    >
      <LobbyCodeInput
        value={code}
        onChange={onChange}
        onComplete={submit}
        length={LOBBY_CODE_LENGTH}
        autoFocus
        ariaLabel={t.home.joinByCode.modalTitle}
      />
    </ModalShell>
  );
};

export default JoinByCodeModal;
