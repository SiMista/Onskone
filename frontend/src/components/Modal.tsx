import { ReactNode, useRef } from 'react';
import { LuX } from 'react-icons/lu';
import { useScrollFade } from '../hooks/useScrollFade';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

const Modal = ({ isOpen, onClose, title, children }: ModalProps) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const showFade = useScrollFade(scrollRef);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-modal-backdrop"
      onClick={onClose}
    >
      <div
        className="relative max-w-2xl w-full animate-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative bg-white border-[3px] border-black rounded-[28px] texture-paper overflow-hidden max-h-[82vh] flex flex-col stack-shadow-lg">
          {/* Header */}
          <div className="relative px-5 pt-6 pb-3 flex items-start justify-between gap-3">
            <h2 className="marker-highlight text-lg md:text-xl font-display font-bold text-gray-900 m-0 tracking-tight">
              {title}
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
          <div
            ref={scrollRef}
            className="relative px-5 py-4 text-gray-800 overflow-y-auto"
          >
            {children}
          </div>

          {/* Fade blanc en bas - affiché seulement quand il reste du contenu à scroller. */}
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-x-0 bottom-0 h-14 rounded-b-[25px] bg-gradient-to-t from-white via-white/85 to-transparent transition-opacity duration-150 ${showFade ? 'opacity-100' : 'opacity-0'}`}
          />
        </div>
      </div>
    </div>
  );
};

export default Modal;
