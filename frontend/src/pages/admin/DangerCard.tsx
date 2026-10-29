import type { ReactNode } from 'react';
import { Icon } from '@iconify/react';

type Tone = 'rose' | 'violet';

// Classes littérales (Tailwind ne détecte pas les noms construits dynamiquement).
const TONES: Record<Tone, { border: string; tile: string; icon: string; glow: string }> = {
  rose: {
    border: 'border-rose-400/25',
    tile: 'bg-rose-500/15 border-rose-400/30',
    icon: 'text-rose-300',
    glow: 'from-rose-500/[0.07]',
  },
  violet: {
    border: 'border-violet-400/25',
    tile: 'bg-violet-500/15 border-violet-400/30',
    icon: 'text-violet-300',
    glow: 'from-violet-500/[0.07]',
  },
};

// Carte d'une action « danger » : même structure partout, pour que l'œil sache où lire
// l'état (en-tête), où agir (corps, en bas) et où chercher le détail (replié).
const STATUS_TONES = {
  alert: 'border-rose-400/50 bg-rose-500/15 text-rose-100',
  ok: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
  neutral: 'border-white/15 bg-white/[0.05] text-white/70',
} as const;

// L'état n'est jamais porté par la couleur seule : pastille + libellé + animation d'alerte.
export const DangerCard = ({
  tone, icon, title, summary, status, loading, details, children,
}: {
  tone: Tone;
  icon: string;
  title: string;
  // Une phrase : ce que fait cette action. Le long détail va dans `details`.
  summary: string;
  status: { tone: 'alert' | 'ok' | 'neutral'; label: string; icon?: string } | null;
  loading?: boolean;
  details?: ReactNode;
  children: ReactNode;
}) => {
  const t = TONES[tone];
  return (
    <section className={`rounded-2xl border ${t.border} bg-gradient-to-b ${t.glow} to-transparent overflow-hidden`}>
      <header className="flex items-start gap-3 p-4 pb-3">
        <span className={`shrink-0 w-11 h-11 rounded-xl border flex items-center justify-center ${t.tile}`}>
          <Icon icon={icon} className={`w-6 h-6 ${t.icon}`} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-[17px] font-semibold tracking-tight text-white">{title}</h2>
            {status && (
              <span
                role="status"
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border font-mono text-[10.5px] uppercase tracking-wider ${STATUS_TONES[status.tone]}`}
              >
                {status.icon
                  ? <Icon icon={status.icon} className="w-3.5 h-3.5" />
                  : <span className={`h-1.5 w-1.5 rounded-full ${status.tone === 'alert' ? 'bg-rose-400 animate-pulse' : 'bg-emerald-400'}`} />}
                {status.label}
              </span>
            )}
          </div>
          <p className="mt-1 text-[13px] leading-snug text-white/55">{summary}</p>
        </div>
      </header>

      <div className="px-4 pb-4 space-y-4">
        {loading ? (
          <div className="space-y-2.5 animate-pulse" aria-label="chargement">
            <div className="h-14 rounded-lg bg-white/[0.04]" />
            <div className="h-12 rounded-lg bg-white/[0.04]" />
          </div>
        ) : children}
      </div>

      {details && (
        <details className="group border-t border-white/[0.06]">
          <summary className="cursor-pointer list-none flex items-center gap-2 px-4 min-h-[44px] font-mono text-[11px] uppercase tracking-[0.14em] text-white/45 hover:text-white/75 transition-colors [&::-webkit-details-marker]:hidden">
            <Icon icon="mdi:information-outline" className="w-4 h-4" />
            Comment ça marche
            <Icon icon="mdi:chevron-down" className="w-4 h-4 ml-auto transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-4 pb-4 text-[12.5px] leading-relaxed text-white/50 space-y-2 max-w-2xl">
            {details}
          </div>
        </details>
      )}
    </section>
  );
};

// Gros bouton d'action (≥48px, pleine largeur sur mobile). `variant` = hiérarchie :
// 'danger' pour couper/contraindre, 'safe' pour lever (c'est alors l'action principale),
// 'ghost' pour une action secondaire.
type Variant = 'danger' | 'warning' | 'safe' | 'ghost';
const VARIANTS: Record<Variant, string> = {
  danger: 'border-rose-400/50 bg-rose-500/15 text-rose-50 hover:bg-rose-500/25 hover:border-rose-400/70',
  warning: 'border-amber-400/50 bg-amber-500/15 text-amber-50 hover:bg-amber-500/25 hover:border-amber-400/70',
  safe: 'border-emerald-400/50 bg-emerald-500/15 text-emerald-50 hover:bg-emerald-500/25 hover:border-emerald-400/70',
  ghost: 'border-white/10 bg-transparent text-white/60 hover:text-white/90 hover:border-white/25',
};

export const DangerButton = ({
  variant, icon, busy, disabled, onClick, children,
}: {
  variant: Variant;
  icon: string;
  busy?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={busy || disabled}
    className={`cursor-pointer w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center gap-2 px-5 rounded-xl border font-mono text-[13px] font-bold tracking-wider transition-colors
      disabled:opacity-40 disabled:cursor-not-allowed ${VARIANTS[variant]}`}
  >
    <Icon icon={busy ? 'mdi:loading' : icon} className={`w-5 h-5 ${busy ? 'animate-spin' : ''}`} />
    {children}
  </button>
);
