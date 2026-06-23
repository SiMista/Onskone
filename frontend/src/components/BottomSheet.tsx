import { ReactNode } from 'react';
import { LuX } from 'react-icons/lu';
import { useModalChrome } from '../hooks/useModalChrome';
import { useLocale } from '../i18n';

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * Feuille modale ancrée en bas d'écran (bottom sheet). Glisse depuis le bas,
 * coins hauts arrondis, ferme au clic sur le backdrop ou Escape.
 * Réutilise useModalChrome (scroll-lock + Escape) comme ModalShell.
 */
const BottomSheet = ({ isOpen, onClose, title, children }: BottomSheetProps) => {
  const { t } = useLocale();

  useModalChrome(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-modal-backdrop"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-white border-[3px] border-black border-b-0 rounded-t-[28px] texture-paper stack-shadow-lg animate-bottomsheet safe-pb"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 0px))' }}
      >
        {/* Header */}
        <div className="relative px-5 pt-5 pb-3 flex items-start justify-between gap-3">
          <h2 className="marker-highlight text-lg md:text-xl font-display font-bold text-gray-900 m-0 tracking-tight">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.common.close}
            className="shrink-0 w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-900 active:scale-90 transition-all duration-200 cursor-pointer"
          >
            <LuX size={20} strokeWidth={2.5} />
          </button>
        </div>

        {/* Séparateur pointillé */}
        <div className="mx-5 border-t-[2px] border-dashed border-black/35" />

        {/* Body */}
        <div className="relative px-5 pt-4 text-gray-800">{children}</div>
      </div>
    </div>
  );
};

export default BottomSheet;
