import { ReactNode, useRef } from 'react';
import { LuX } from 'react-icons/lu';
import ScrollFade from './ScrollFade';
import { useLocale } from '../i18n';

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
}

const Modal = ({ isOpen, onClose, title, children, subHeader }: ModalProps) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const { t } = useLocale();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-modal-backdrop"
      onClick={onClose}
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div
        className="relative max-w-2xl w-full animate-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="relative bg-white border-[3px] border-black rounded-[28px] texture-paper overflow-hidden flex flex-col stack-shadow-lg"
          style={{
            maxHeight:
              'min(78dvh, calc(100dvh - max(1rem, env(safe-area-inset-top, 0px)) - max(1rem, env(safe-area-inset-bottom, 0px))))',
          }}
        >
          {/* Header */}
          <div className="relative px-5 pt-6 pb-3 flex items-start justify-between gap-3">
            <h2 className="marker-highlight text-lg md:text-xl font-display font-bold text-gray-900 m-0 tracking-tight">
              {title}
            </h2>

            <button
              onClick={onClose}
              aria-label={t.common.close}
              className="shrink-0 w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-900 active:scale-90 transition-all duration-200 cursor-pointer"
            >
              <LuX size={20} strokeWidth={2.5} />
            </button>
          </div>

          {/* Séparateur pointillé */}
          <div className="mx-5 border-t-[2px] border-dashed border-black/35" />

          {/* Sous-header optionnel (ex : onglets) - posé entre le séparateur
              et le scroll body, donc PAS scrollable et PAS sticky. */}
          {subHeader && (
            <div className="relative bg-white px-5 pt-2">{subHeader}</div>
          )}

          {/* Body */}
          <div
            ref={scrollRef}
            className="relative flex-1 min-h-0 px-5 py-4 text-gray-800 overflow-y-auto overscroll-contain"
          >
            {children}
          </div>

          <ScrollFade scrollRef={scrollRef} className="rounded-b-[25px]" />
        </div>
      </div>
    </div>
  );
};

export default Modal;
