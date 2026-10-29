import type { ReactNode } from 'react';
import { Icon } from '@iconify/react';
import { CLUSTER } from './shared';
import questionMarks from '../../assets/images/bg-question-marks.svg';

// Charte de l'admin : chaque rôle visuel a UN rendu, défini ici, et les onglets s'en servent
// au lieu de recoder leurs classes.
// - Arrondis : blocs 12px (rounded-xl), contrôles 8px (rounded-lg), pastilles rondes.
// - Surfaces : PANEL pour tout bloc posé sur la page, FLOATING pour ce qui flotte (menus,
//   popups, aperçus), CLUSTER (shared.ts) pour les contrôles d'une barre d'outils.
//   Attention : .surface-glass (index.css) est hors calque Tailwind et gagne sur les utilitaires
//   border-* / bg-* posés sur le même élément ; pour marquer un PANEL, passer par ring-* / outline-*.
// - Accent de sélection : ambre (onglet actif, filtre actif), comme la barre de nav et le jaune du logo.
// - Couleur d'identité (catégorie, type de ticket, niveau de log, état de salon) : une barre
//   verticale sur le bord gauche (Strip), jamais une simple pastille. Statuts : icône + libellé.
// - Typo, 5 tailles seulement : 12 (méta), 13 (texte), 14 (texte mis en avant, titre de ligne),
//   16 (titre de section), 22 (titre de page) ; les chiffres clés ont leur propre taille. Texte lu ≥ white/50. Le mono est réservé aux codes (salon, version, #id, traces).

export const PANEL = 'rounded-xl surface-glass';
export const PAGE_BG = 'bg-[#0d1018]';
// Même matière que les blocs (aplat d'ardoise bleutée, liseré de lumière en haut), mais
// opaque et un cran plus clair pour se détacher de ce qu'il recouvre.
export const FLOATING =
  'rounded-xl border border-white/10 bg-[#1f2433] ' +
  'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_24px_60px_-15px_rgba(0,0,0,0.8)]';

// ---------- Boutons ----------
type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
const BTN_VARIANTS: Record<BtnVariant, string> = {
  primary: 'border-amber-300/50 bg-amber-400/15 text-amber-50 hover:bg-amber-400/25',
  secondary: 'border-white/15 bg-white/[0.04] text-white/80 hover:bg-white/[0.08] hover:text-white',
  danger: 'border-rose-400/40 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20',
  ghost: 'border-transparent text-white/60 hover:text-white hover:bg-white/[0.06]',
};
// 'sm' pour les barres d'outils (40px au doigt, 32px à la souris), 'md' pour les actions.
export const btn = (variant: BtnVariant = 'secondary', size: 'sm' | 'md' = 'md'): string =>
  'cursor-pointer inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium whitespace-nowrap transition-colors ' +
  'disabled:opacity-40 disabled:cursor-not-allowed ' +
  (size === 'sm' ? 'px-2.5 min-h-[40px] md:min-h-[32px] text-[13px] ' : 'px-3.5 min-h-[40px] text-[14px] ') +
  BTN_VARIANTS[variant];

// Bouton icône seule : carré, 40px au doigt, 32px à la souris. Toujours avec aria-label + title.
export const iconBtn = (variant: BtnVariant = 'ghost'): string => `${btn(variant, 'sm')} p-0 w-10 h-10 md:w-8 md:h-8`;

// ---------- Pastilles ----------
type BadgeTone = 'neutral' | 'amber' | 'rose' | 'emerald' | 'violet' | 'sky';
export const BADGE = 'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[12px] font-medium whitespace-nowrap';
export const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'border-white/15 bg-white/[0.05] text-white/70',
  amber: 'border-amber-300/40 bg-amber-400/10 text-amber-100',
  rose: 'border-rose-400/40 bg-rose-500/10 text-rose-100',
  emerald: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
  violet: 'border-violet-300/40 bg-violet-400/10 text-violet-100',
  sky: 'border-sky-300/40 bg-sky-400/10 text-sky-100',
};
export const badge = (tone: BadgeTone = 'neutral'): string => `${BADGE} ${BADGE_TONES[tone]}`;

// ---------- Fond et marque ----------
// La nuit d'Onskoné : bleu nuit profond, halo du bleu du logo en haut, pointe du jaune du logo
// en bas à droite, et les « ? » du fond du jeu en filigrane, fondus vers le bas.
export const AdminBackdrop = () => (
  <div aria-hidden className="pointer-events-none fixed inset-0">
    <div
      className="absolute inset-0"
      style={{
        background:
          'radial-gradient(1100px 520px at 50% -14%, rgba(26,175,218,0.16), transparent 70%),' +
          'radial-gradient(760px 460px at 105% 105%, rgba(255,199,0,0.05), transparent 70%),' +
          '#0d1018',
      }}
    />
    <div
      className="absolute inset-0 opacity-[0.4]"
      style={{
        backgroundImage: `url(${questionMarks})`,
        backgroundSize: '440px 560px',
        maskImage: 'linear-gradient(to bottom, black 0%, transparent 80%)',
        WebkitMaskImage: 'linear-gradient(to bottom, black 0%, transparent 80%)',
      }}
    />
  </div>
);

// Marque de l'admin (masthead d'origine) : « ▍ onskoné / ADMIN ».
export const AdminBrand = ({ large = false }: { large?: boolean }) => {
  const size = large ? 'text-[14px]' : 'text-[13px] sm:text-[14px]';
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-amber-400 text-[15px] leading-none">▍</span>
      <span className={`font-mono ${size} text-white/85 lowercase tracking-tight leading-none`}>onskoné</span>
      <span className={`font-mono ${size} text-white/25 leading-none`}>/</span>
      <span className={`font-mono ${size} font-bold text-amber-200 uppercase tracking-[0.12em] leading-none`}>admin</span>
    </span>
  );
};

// Barre de couleur sur le bord gauche : le repère de catégorie / type / niveau / état de l'admin
// (comme les decks). Le parent doit être `relative` (+ overflow-hidden s'il est arrondi).
// `row` : barre arrondie en retrait, pour une ligne de liste (évite les barres qui se touchent).
export const Strip = ({ color, row = false }: { color: string; row?: boolean }) => (
  <span aria-hidden className={`absolute left-0 w-[3px] ${row ? 'top-2.5 bottom-2.5 rounded-r-full' : 'top-0 bottom-0'} ${color}`} />
);

// ---------- Titres et blocs ----------
export const SectionLabel = ({ children, right }: { children: ReactNode; right?: ReactNode }) => (
  <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
    <h2 className="text-[16px] font-semibold tracking-tight text-white">{children}</h2>
    {right}
  </div>
);

// Chiffre clé. Cliquable si `onClick` : il mène alors à la liste filtrée correspondante.
// `compact` : tuile basse pour un simple libellé + chiffre (sans hint).
export const KpiCell = ({
  label, value, hint, onClick, compact = false,
}: {
  label: string;
  value: number | string;
  hint?: string;
  onClick?: () => void;
  compact?: boolean;
}) => {
  const pad = compact ? 'px-3 py-2' : 'p-3';
  const body = (
    <>
      <p className={`font-medium text-white/65 ${compact ? 'text-[14px]' : 'text-[13px]'}`}>{label}</p>
      <p className={`font-semibold tracking-tight tabular-nums text-white leading-tight ${compact ? 'mt-0.5 text-[23px]' : 'mt-1 text-[26px]'}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[12px] text-white/50">{hint}</p>}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={`text-left ${PANEL} surface-glass-hover transition-colors cursor-pointer ${pad}`}>
      {body}
    </button>
  ) : (
    <div className={`${PANEL} ${pad}`}>{body}</div>
  );
};

// État vide : dit ce qui manque ET quand/comment ça se remplit.
export const EmptyState = ({ icon, title, hint }: { icon?: string; title: string; hint?: ReactNode }) => (
  <div className={`${PANEL} py-8 px-4 text-center`}>
    {icon && <Icon icon={icon} className="mx-auto mb-2 w-6 h-6 text-white/40" aria-hidden />}
    <p className="text-[13px] font-medium text-white/75">{title}</p>
    {hint && <p className="mt-1 text-[12px] text-white/50 max-w-sm mx-auto">{hint}</p>}
  </div>
);

// Chargement initial d'un onglet (les rafraîchissements suivants passent par la barre du header).
export const LoadingState = ({ label = 'Chargement…' }: { label?: string }) => (
  <div role="status" className="text-center py-20 text-[13px] text-white/50">{label}</div>
);

// ---------- Barre d'outils ----------
// Largeur par défaut : pleine sur téléphone, extensible jusqu'à 28rem sur grand écran.
export const SearchField = ({
  value, onChange, placeholder, className = 'w-full md:flex-1 md:min-w-[200px] md:max-w-md',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
}) => (
  <div className={`${CLUSTER} ${className}`}>
    <Icon icon="mdi:magnify" className="w-4 h-4 shrink-0 ml-0.5 text-white/50" aria-hidden />
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className="flex-1 min-w-0 min-h-[32px] bg-transparent border-0 outline-0 text-[13px] text-white/85 placeholder:text-white/40"
    />
    {value && (
      <button
        type="button"
        onClick={() => onChange('')}
        aria-label="Effacer la recherche"
        title="Effacer la recherche"
        className="cursor-pointer w-7 h-7 shrink-0 flex items-center justify-center rounded-md text-white/50 hover:text-white hover:bg-white/[0.06]"
      >
        <Icon icon="mdi:close" className="w-4 h-4" aria-hidden />
      </button>
    )}
  </div>
);

// Choix exclusif dans une barre d'outils (filtre, tri). `accent` : couleur d'identité optionnelle
// (catégorie de deck, type de ticket…), rendue en mini-barre comme les Strip des listes.
export function Segmented<T extends string>({
  value, onChange, options, ariaLabel, className = '',
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; accent?: string }[];
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className={`${CLUSTER} ${className}`}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value || 'all'}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`cursor-pointer inline-flex items-center gap-1.5 px-2.5 min-h-[40px] md:min-h-[28px] rounded-md text-[13px] font-medium whitespace-nowrap transition-colors ${active
              ? 'bg-amber-400/15 text-amber-100'
              : 'text-white/60 hover:text-white/90'}`}
          >
            {o.accent && <span aria-hidden className={`w-[3px] h-3.5 rounded-full ${o.accent}`} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Onglets d'une page (même soulignement ambre que la barre de nav du haut).
export function Tabs<T extends string>({
  value, onChange, tabs, ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  tabs: { value: T; label: ReactNode; title?: string }[];
  ariaLabel: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="flex items-center gap-1 overflow-x-auto no-scrollbar border-b border-white/10">
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={active}
            title={t.title}
            onClick={() => onChange(t.value)}
            className={`cursor-pointer relative shrink-0 px-3 py-2.5 text-[14px] font-semibold whitespace-nowrap transition-colors ${active ? 'text-white' : 'text-white/55 hover:text-white/85'}`}
          >
            {t.label}
            {active && <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-amber-400" />}
          </button>
        );
      })}
    </div>
  );
}
