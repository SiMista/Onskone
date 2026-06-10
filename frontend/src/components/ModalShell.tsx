import { ReactNode, useRef } from 'react';
import { LuX } from 'react-icons/lu';
import ScrollFade from './ScrollFade';
import { useModalChrome } from '../hooks/useModalChrome';
import { useLocale } from '../i18n';

export interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Largeur max de la carte. Défaut '2xl' (cf. Modal/InfoModal) ; 'md' pour les dialogs compacts. */
  maxWidth?: '2xl' | 'md';
  /** Police du titre : 'display' (Fredoka, défaut) ou 'accent' (Fraunces, éditorial — InfoModal). */
  titleFont?: 'display' | 'accent';
  /** Affiche le ruban washi tape rose au-dessus de la carte (InfoModal). */
  washiTape?: boolean;
  /**
   * Bloc entre le séparateur pointillé et le body scrollable, hors du scroll
   * (barre d'onglets / sous-header collé au header). Cf. Modal.subHeader.
   */
  subHeader?: ReactNode;
  /**
   * Si false, le body n'est PAS scrollable (pas de maxHeight, pas de ScrollFade) :
   * utilisé pour les dialogs courts type confirmation. Défaut true.
   */
  scrollable?: boolean;
  /** Désactive le fade blanc en bas du body scrollable (carousel qui gère son débord). */
  disableScrollFade?: boolean;
  /** Pied de carte optionnel (boutons d'action), hors du body. */
  footer?: ReactNode;
}

const MAX_WIDTH_CLASS: Record<NonNullable<ModalShellProps['maxWidth']>, string> = {
  '2xl': 'max-w-2xl',
  md: 'max-w-md',
};

const SAFE_MAX_HEIGHT =
  'min(78dvh, calc(100dvh - max(1rem, env(safe-area-inset-top, 0px)) - max(1rem, env(safe-area-inset-bottom, 0px))))';

/**
 * Shell commun aux modales papier (Modal / InfoModal / ConfirmModal).
 * (ThemePickerModal a son propre layout plein-écran et ne partage que le
 * comportement chrome via useModalChrome.)
 *
 * Mutualise : backdrop fixe + paddings safe-area, carte papier (border noir
 * [3px], rounded 28px, texture-paper, stack-shadow-lg), header avec titre +
 * bouton fermer, séparateur pointillé, body (scrollable ou non), footer, et
 * scroll-lock du body + fermeture clavier sur Escape via useModalChrome.
 */
const ModalShell = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = '2xl',
  titleFont = 'display',
  washiTape = false,
  subHeader,
  scrollable = true,
  disableScrollFade = false,
  footer,
}: ModalShellProps) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const { t } = useLocale();

  // Scroll-lock du body + fermeture sur Escape, uniquement quand ouverte.
  useModalChrome(isOpen, onClose);

  if (!isOpen) return null;

  const titleClass =
    titleFont === 'accent'
      ? 'marker-highlight font-accent text-display-lg text-gray-900 m-0'
      : 'marker-highlight text-lg md:text-xl font-display font-bold text-gray-900 m-0 tracking-tight';

  // InfoModal a un header un peu plus haut (pt-7) à cause du washi tape.
  const headerPadTop = washiTape ? 'pt-7' : 'pt-6';

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
        className={`relative ${MAX_WIDTH_CLASS[maxWidth]} w-full animate-modal-content`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Bande adhésive (washi tape) - hors de la carte pour ne pas être coupée */}
        {washiTape && (
          <div
            aria-hidden
            className="absolute -top-3 left-1/2 -translate-x-1/2 w-24 h-6 bg-pink-300/85 border-[2px] border-black rotate-[-4deg] z-20 pointer-events-none"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, rgba(0,0,0,0.12) 0 4px, transparent 4px 10px)',
              boxShadow: '1px 2px 0 0 rgba(0,0,0,0.25)',
            }}
          />
        )}

        <div
          className="relative bg-white border-[3px] border-black rounded-[28px] texture-paper overflow-hidden flex flex-col stack-shadow-lg"
          style={scrollable ? { maxHeight: SAFE_MAX_HEIGHT } : undefined}
        >
          {/* Header */}
          <div className={`relative px-5 ${headerPadTop} pb-3 flex items-start justify-between gap-3`}>
            <h2 className={titleClass}>{title}</h2>

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

          {/* Sous-header optionnel (ex : onglets) - entre le séparateur et le
              scroll body, donc PAS scrollable et PAS sticky. */}
          {subHeader && <div className="relative bg-white px-5 pt-2">{subHeader}</div>}

          {/* Body */}
          {scrollable ? (
            <>
              <div
                ref={scrollRef}
                className="relative flex-1 min-h-0 px-5 py-4 text-gray-800 overflow-y-auto overscroll-contain"
              >
                {children}
              </div>
              {!disableScrollFade && <ScrollFade scrollRef={scrollRef} className="rounded-b-[25px]" />}
            </>
          ) : (
            <div className="relative px-5 py-5 text-gray-800">{children}</div>
          )}

          {footer && <div className="px-5 pb-5 pt-1">{footer}</div>}
        </div>
      </div>
    </div>
  );
};

export default ModalShell;
