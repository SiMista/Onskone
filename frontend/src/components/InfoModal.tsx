import { ReactNode } from 'react';
import { LuX } from 'react-icons/lu';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

const InfoModal = ({ isOpen, onClose, title, children }: InfoModalProps) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white border-[2.5px] border-black rounded-2xl stack-shadow-lg texture-paper max-w-md w-full max-h-[82vh] overflow-hidden animate-modal-content flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b-[2.5px] border-black bg-cream-player">
          <h2 className="text-lg md:text-xl font-display font-bold text-gray-900 m-0 tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border-2 border-black hover:bg-gray-100 active:scale-95 transition-transform text-gray-800 cursor-pointer shrink-0"
            aria-label="Fermer"
          >
            <LuX size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 text-gray-800 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

export default InfoModal;
