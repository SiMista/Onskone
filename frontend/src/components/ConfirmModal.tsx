import Button from './Button';
import ModalShell from './ModalShell';
import { useLocale } from '../i18n';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'primary' | 'success' | 'warning' | 'danger';
}

const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  confirmVariant = 'primary'
}: ConfirmModalProps) => {
  const { t } = useLocale();

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth="md"
      scrollable={false}
      footer={
        <div className="flex flex-row gap-3 justify-center">
          <Button
            text={confirmText ?? t.common.confirm}
            variant={confirmVariant}
            size="sm"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          />
          <Button
            text={cancelText ?? t.common.cancel}
            variant="quit"
            size="sm"
            onClick={onClose}
          />
        </div>
      }
    >
      <p className="text-gray-700 text-center m-0">{message}</p>
    </ModalShell>
  );
};

export default ConfirmModal;
