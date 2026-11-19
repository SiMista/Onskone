import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLocale } from '../i18n';

const BUBBLE_WIDTH = 288; // px (w-72)
const MARGIN = 12; // marge mini au bord de l'écran
const GAP = 8; // écart bouton ↔ bulle
const BUBBLE_OUT_MS = 120; // durée de .animate-help-bubble-out (index.css)

type Placement = { left: number; top: number; arrowLeft: number; above: boolean };

/** Place une bulle `width`×`height` sous le bouton (au-dessus s'il n'y a pas la place), calée dans l'écran. */
const placeNear = (r: DOMRect, width: number, height: number): Placement => {
  const center = r.left + r.width / 2;
  const left = Math.max(MARGIN, Math.min(center - width / 2, window.innerWidth - width - MARGIN));
  const above = r.bottom + GAP + height > window.innerHeight - MARGIN && r.top - GAP - height > MARGIN;
  return {
    left,
    top: above ? r.top - GAP - height : r.bottom + GAP,
    arrowLeft: Math.max(14, Math.min(center - left, width - 14)),
    above,
  };
};

/**
 * Bouton « ? » qui ouvre une bulle d'aide au tap (pas de survol : marche au tactile).
 * La bulle est rendue dans un portail en position fixe : elle ne se fait ni rogner par
 * un conteneur scrollable, ni masquer par un voisin. Se ferme au tap dehors, à Échap,
 * ou si la page défile / se redimensionne.
 */
const HelpBubble = ({ children, label, className = '' }: {
  children: ReactNode;
  /** Libellé accessible du bouton (défaut : « Aide »). */
  label?: string;
  className?: string;
}) => {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  // Fermeture en cours : la bulle reste montée le temps de son animation de sortie.
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = useState<Placement | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setClosing(true);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setClosing(false), BUBBLE_OUT_MS);
  }, []);

  // Rouvrir pendant la sortie : on annule la sortie, la bulle repart de son anim d'entrée.
  const show = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setClosing(false);
    setOpen(true);
  };

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  // Positionne la bulle sous le bouton (au-dessus s'il n'y a pas la place), calée dans l'écran.
  // Pas de remise à null à la fermeture : la bulle sort à sa place.
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const width = Math.min(BUBBLE_WIDTH, window.innerWidth - MARGIN * 2);
    setPos(placeNear(btnRef.current.getBoundingClientRect(), width, bubbleRef.current?.offsetHeight ?? 0));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (bubbleRef.current?.contains(target) || btnRef.current?.contains(target)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open, close]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={label ?? t.common.help}
        aria-expanded={open}
        onClick={e => { e.stopPropagation(); if (open) close(); else show(); }}
        // Sobre : pastille bleu ciel à liseré fin, sans ombre ; ouverte, elle se remplit (lien
        // visuel avec la bulle qui en sort).
        className={`group shrink-0 inline-flex w-6 h-6 rounded-full cursor-pointer active:scale-90 transition-transform duration-200 ${className}`}
      >
        {/* Pastille ET « i » dans le même SVG : un seul repère, donc « i » pile au centre à toute
            densité d'écran. Avec un liseré CSS + une icône posée dedans, chacun était arrondi au
            pixel de son côté (demi-pixel à ×1, encore ~0,2 px à ×2,625) : « i » décalé à droite. */}
        <svg aria-hidden viewBox="0 0 24 24" width={24} height={24} className="block">
          <circle
            cx="12"
            cy="12"
            r="11.25"
            strokeWidth={1.5}
            className={`transition-[fill,stroke] duration-200 ${
              open ? 'fill-brand-500 stroke-brand-500' : 'fill-brand-100 stroke-brand-700/30 group-hover:stroke-brand-700/60'
            }`}
          />
          {/* « i » façon symbole info ℹ : point, tige fine à drapeau et pied plat, centrés sur
              x = 12. Léger trait rond pour adoucir les angles sans les gonfler. */}
          <g
            transform="translate(4 4) scale(0.6667)"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth={0.6}
            strokeLinejoin="round"
            className={`transition-colors duration-200 ${open ? 'text-white' : 'text-brand-700'}`}
          >
            <circle cx="12" cy="6.3" r="2" />
            <path d="M9.65 10H13.25V17.5H14.7V19.4H9.3V17.5H10.75V11.8H9.65Z" />
          </g>
        </svg>
      </button>
      {(open || closing) && createPortal(
        <div
          ref={bubbleRef}
          role="dialog"
          // stopPropagation : un portail propage ses clics au parent React (ex. fond d'une modale).
          onClick={e => e.stopPropagation()}
          // Anim posée seulement une fois la position connue (sinon elle tournerait cachée).
          className={`fixed z-[70] w-72 max-w-[calc(100vw-1.5rem)] bg-brand-50 text-black/80 rounded-2xl border-[1.5px] border-brand-700/25 help-bubble-shadow px-4 py-3 ${
            pos ? (open ? 'animate-help-bubble-in' : 'animate-help-bubble-out') : ''
          }`}
          style={{
            left: pos?.left ?? 0,
            top: pos?.top ?? 0,
            visibility: pos ? 'visible' : 'hidden',
            // Zoom depuis la pointe, glissement depuis le bouton (dessous : vers le bas ; dessus : vers le haut).
            ...(pos && {
              transformOrigin: `${pos.arrowLeft}px ${pos.above ? '100%' : '0'}`,
              '--bubble-dy': pos.above ? '4px' : '-4px',
            }),
          } as CSSProperties}
        >
          {pos && (
            <span
              aria-hidden
              // Pointe : même fond et même liseré que la bulle, posée à cheval sur son bord.
              className={`absolute w-3 h-3 bg-brand-50 border-brand-700/25 rotate-45 ${pos.above ? 'border-b-[1.5px] border-r-[1.5px] -bottom-[6.5px]' : 'border-t-[1.5px] border-l-[1.5px] -top-[6.5px]'}`}
              style={{ left: pos.arrowLeft - 6 }}
            />
          )}
          <div className="relative font-sans text-sm leading-normal">{children}</div>
        </div>,
        document.body,
      )}
    </>
  );
};

export default HelpBubble;
