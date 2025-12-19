import Button from './Button';

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
  confirmText = 'Confirmer',
  cancelText = 'Annuler',
  confirmVariant = 'primary'
}: ConfirmModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal content */}
      <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800 text-center">{title}</h2>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-gray-700 text-center">{message}</p>
        </div>

        {/* Footer with buttons */}
        <div className="px-6 py-4 bg-gray-50 flex flex-col flex-row gap-3 justify-center">
          <Button
            text={confirmText}
            variant={confirmVariant}
            size="sm"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          />
          <Button
            text={cancelText}
            variant="secondary"
            size="sm"
            onClick={onClose}
          />

        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
