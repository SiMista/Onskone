import { LuX } from 'react-icons/lu';
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-modal-backdrop"
      onClick={onClose}
    >
      <div
        className="relative max-w-md w-full animate-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative bg-white border-[3px] border-black rounded-[28px] texture-paper overflow-hidden flex flex-col stack-shadow-lg">
          {/* Header */}
          <div className="relative px-5 pt-6 pb-3 flex items-start justify-between gap-3">
            <h2 className="relative inline-block text-lg md:text-xl font-display font-bold text-gray-900 m-0 tracking-tight">
              <span
                aria-hidden
                className="absolute left-[-4px] right-[-6px] bottom-[2px] h-[55%] -z-0 bg-yellow-300"
                style={{
                  transform: 'skew(-6deg, -1deg) rotate(-1deg)',
                  borderRadius: '40% 60% 55% 45% / 60% 40% 60% 40%',
                }}
              />
              <span className="relative z-10">{title}</span>
            </h2>

            <button
              onClick={onClose}
              aria-label="Fermer"
              className="shrink-0 w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-900 active:scale-90 transition-all duration-200 cursor-pointer"
            >
              <LuX size={20} strokeWidth={2.5} />
            </button>
          </div>

          {/* Séparateur pointillé */}
          <div className="mx-5 border-t-[2px] border-dashed border-black/35" />

          {/* Body */}
          <div className="relative px-5 py-5">
            <p className="text-gray-700 text-center m-0">{message}</p>
          </div>

          {/* Footer */}
          <div className="px-5 pb-5 pt-1 flex flex-row gap-3 justify-center">
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
              variant="quit"
              size="sm"
              onClick={onClose}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
