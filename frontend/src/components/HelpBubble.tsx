import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLocale } from '../i18n';

const BUBBLE_WIDTH = 288; // px (w-72)
const MARGIN = 12; // marge mini au bord de l'écran
const GAP = 8; // écart bouton ↔ bulle
const BUBBLE_OUT_MS = 120; // durée de .animate-help-bubble-out (index.css)
const TEASER_DELAY_MS = 900; // le teaser attend que l'écran soit posé (entrée de phase)
const TEASER_VISIBLE_MS = 4500;

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
const HelpBubble = ({ children, label, className = '', attention = false, teaser, keepFocus = false }: {
  children: ReactNode;
  /** Libellé accessible du bouton (défaut : « Aide »). */
  label?: string;
  className?: string;
  /** La pastille pulse tant que la bulle n'a jamais été ouverte (ex. astuce d'une question). */
  attention?: boolean;
  /** Avec `attention` : petite bulle d'appel (« Besoin d'aide ? ») montrée quelques secondes, une fois. */
  teaser?: ReactNode;
  /**
   * Le tap ne vole pas le focus : un champ en cours de saisie le garde. Sinon le clavier
   * mobile se ferme, le resize qui suit referme aussitôt la bulle, et le joueur doit
   * re-taper dans le champ pour continuer à écrire.
   */
  keepFocus?: boolean;
}) => {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  // Déjà ouverte une fois : fin de l'appel à l'attention (pulse + teaser).
  const [seen, setSeen] = useState(false);
  const [teaserPhase, setTeaserPhase] = useState<'off' | 'in' | 'out'>('off');
  const [teaserPos, setTeaserPos] = useState<Placement | null>(null);
  const teaserRef = useRef<HTMLDivElement>(null);
  const teasedRef = useRef(false);
  // Fermeture en cours : la bulle reste montée le temps de son animation de sortie.
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number; arrowLeft: number; above: boolean } | null>(null);
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
    setSeen(true);
  };

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  // Positionne la bulle sous le bouton (au-dessus s'il n'y a pas la place), calée dans l'écran.
  // Pas de remise à null à la fermeture : la bulle sort à sa place.
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const width = Math.min(BUBBLE_WIDTH, window.innerWidth - MARGIN * 2);
    setPos(placeNear(btnRef.current.getBoundingClientRect(), width, bubbleRef.current?.offsetHeight ?? 0));
  }, [open]);

  // ---- Teaser : une seule apparition par montage, retirée dès que l'appel n'a plus lieu
  // d'être (bulle ouverte, ou `attention` coupé par le parent, ex. réponse envoyée).
  const teasing = attention && !seen && !!teaser;
  useEffect(() => {
    if (!teasing || teasedRef.current) return;
    const showTimer = setTimeout(() => { teasedRef.current = true; setTeaserPhase('in'); }, TEASER_DELAY_MS);
    const hideTimer = setTimeout(() => setTeaserPhase(p => (p === 'in' ? 'out' : p)), TEASER_DELAY_MS + TEASER_VISIBLE_MS);
    return () => { clearTimeout(showTimer); clearTimeout(hideTimer); };
  }, [teasing]);
  useEffect(() => {
    if (!teasing) setTeaserPhase(p => (p === 'in' ? 'out' : p));
  }, [teasing]);
  useEffect(() => {
    if (teaserPhase !== 'out') return;
    const timer = setTimeout(() => setTeaserPhase('off'), BUBBLE_OUT_MS);
    return () => clearTimeout(timer);
  }, [teaserPhase]);

  const placeTeaser = useCallback(() => {
    if (!btnRef.current || !teaserRef.current) return;
    setTeaserPos(placeNear(btnRef.current.getBoundingClientRect(), teaserRef.current.offsetWidth, teaserRef.current.offsetHeight));
  }, []);
  useLayoutEffect(() => {
    if (teaserPhase === 'in') placeTeaser();
  }, [teaserPhase, placeTeaser]);
  // Suit le bouton au lieu de se fermer : le clavier mobile s'ouvre souvent pile à l'entrée
  // de phase (champ autofocus), le resize tuerait le teaser avant qu'il soit lu.
  useEffect(() => {
    if (teaserPhase !== 'in') return;
    window.addEventListener('resize', placeTeaser);
    window.addEventListener('scroll', placeTeaser, true);
    return () => {
      window.removeEventListener('resize', placeTeaser);
      window.removeEventListener('scroll', placeTeaser, true);
    };
  }, [teaserPhase, placeTeaser]);

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
        // keepFocus : pas de focus au tap (défaut du pointerdown/mousedown), le click part quand même.
        onPointerDown={keepFocus ? e => e.preventDefault() : undefined}
        onMouseDown={keepFocus ? e => e.preventDefault() : undefined}
        // Sobre : pastille bleu ciel à liseré fin, sans ombre ; ouverte, elle se remplit (lien
        // visuel avec la bulle qui en sort).
        className={`group shrink-0 inline-flex w-6 h-6 rounded-full cursor-pointer active:scale-90 transition-transform duration-200 ${
          attention && !seen ? 'animate-tip-pulse' : ''
        } ${className}`}
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
      {teaserPhase !== 'off' && createPortal(
        <div
          ref={teaserRef}
          role="status"
          // Décoratif : laisse passer les taps (le champ de réponse est souvent juste dessous).
          className={`pointer-events-none fixed z-[70] w-max max-w-[240px] bg-brand-500 text-white rounded-2xl px-3 py-1.5 help-bubble-shadow font-display font-semibold text-xs leading-snug ${
            teaserPos ? (teaserPhase === 'in' ? 'animate-help-bubble-in' : 'animate-help-bubble-out') : ''
          }`}
          style={{
            left: teaserPos?.left ?? 0,
            top: teaserPos?.top ?? 0,
            visibility: teaserPos ? 'visible' : 'hidden',
            ...(teaserPos && {
              transformOrigin: `${teaserPos.arrowLeft}px ${teaserPos.above ? '100%' : '0'}`,
              '--bubble-dy': teaserPos.above ? '4px' : '-4px',
            }),
          } as CSSProperties}
        >
          {teaserPos && (
            <span
              aria-hidden
              className={`absolute w-2.5 h-2.5 bg-brand-500 rotate-45 ${teaserPos.above ? '-bottom-[4px]' : '-top-[4px]'}`}
              style={{ left: teaserPos.arrowLeft - 5 }}
            />
          )}
          <span className="relative">{teaser}</span>
        </div>,
        document.body,
      )}
    </>
  );
};

export default HelpBubble;
