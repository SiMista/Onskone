import { ReactNode, useRef } from 'react';
import { LuX } from 'react-icons/lu';
import ScrollFade from './ScrollFade';
import { useLocale } from '../i18n';

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

const InfoModal = ({
  isOpen,
  onClose,
  title,
  children,
  disableScrollFade = false,
}: InfoModalProps) => {
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
      {/* Container animé - largeur alignée sur Modal pour cohérence. */}
      <div
        className="relative max-w-2xl w-full animate-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Bande adhésive (washi tape) - hors de la carte pour ne pas être coupée */}
        <div
          aria-hidden
          className="absolute -top-3 left-1/2 -translate-x-1/2 w-24 h-6 bg-pink-300/85 border-[2px] border-black rotate-[-4deg] z-20 pointer-events-none"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, rgba(0,0,0,0.12) 0 4px, transparent 4px 10px)',
            boxShadow: '1px 2px 0 0 rgba(0,0,0,0.25)',
          }}
        />

        {/* Carte principale - blanc papier, gros contour noir, ombre stack */}
        <div
          className="relative bg-white border-[3px] border-black rounded-[28px] texture-paper overflow-hidden flex flex-col stack-shadow-lg"
          style={{
            maxHeight:
              'min(78dvh, calc(100dvh - max(1rem, env(safe-area-inset-top, 0px)) - max(1rem, env(safe-area-inset-bottom, 0px))))',
          }}
        >
          {/* Header */}
          <div className="relative px-5 pt-7 pb-3 flex items-start justify-between gap-3">
            {/* font-accent (Fraunces) donne un côté éditorial qui contraste
                avec Fredoka utilisé partout ailleurs. */}
            <h2 className="marker-highlight font-accent text-display-lg text-gray-900 m-0">
              {title}
            </h2>

            {/* Bouton X discret */}
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

          {/* Content - structure d'origine, ne pas toucher (scroll). */}
          <div
            ref={scrollRef}
            className="relative px-5 py-4 text-gray-800 overflow-y-auto overscroll-contain flex-1 min-h-0"
          >
            {children}
          </div>

          {!disableScrollFade && (
            <ScrollFade scrollRef={scrollRef} className="rounded-b-[25px]" />
          )}
        </div>
      </div>
    </div>
  );
};

export default InfoModal;
