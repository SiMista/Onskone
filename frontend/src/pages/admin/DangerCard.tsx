import type { ReactNode } from 'react';
import { Icon } from '@iconify/react';
import { BADGE, BADGE_TONES } from './ui';

type Tone = 'rose' | 'violet';

// Classes littérales (Tailwind ne détecte pas les noms construits dynamiquement).
const TONES: Record<Tone, { tile: string; icon: string }> = {
  rose: { tile: 'bg-rose-500/15 border-rose-400/30', icon: 'text-rose-300' },
  violet: { tile: 'bg-violet-500/15 border-violet-400/30', icon: 'text-violet-300' },
};

const STATUS_TONES = {
  alert: BADGE_TONES.rose,
  ok: BADGE_TONES.emerald,
  neutral: BADGE_TONES.neutral,
} as const;

// Une ligne de réglage « Accès joueurs » : à gauche ce que fait l'interrupteur et son état,
// à droite (sous le texte sur téléphone) les actions, l'explication longue repliée dessous.
// Pas de cadre propre : les lignes s'empilent dans le cadre unique de la page.
// L'état n'est jamais porté par la couleur seule : pastille + libellé + fond teinté quand actif.
export const DangerCard = ({
  tone, icon, title, summary, status, meta, loading, details, children,
}: {
  tone: Tone;
  icon: string;
  title: string;
  // Une phrase : ce que fait cette action. Le long détail va dans `details`.
  summary: string;
  status: { tone: 'alert' | 'ok' | 'neutral'; label: string; icon?: string } | null;
  // Une ou deux lignes d'info sous le résumé (depuis quand, versions…).
  meta?: ReactNode;
  loading?: boolean;
  details?: ReactNode;
  children: ReactNode;
}) => {
  const t = TONES[tone];
  const alert = status?.tone === 'alert';
  return (
    <section className={alert ? 'bg-rose-500/[0.06]' : ''}>
      <div className="p-4 sm:p-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:gap-10">
        <header className="flex items-start gap-3 min-w-0">
          <span className={`shrink-0 w-10 h-10 rounded-lg border flex items-center justify-center ${t.tile}`}>
            <Icon icon={icon} className={`w-5 h-5 ${t.icon}`} />
          </span>
          <div className="min-w-0 flex-1 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[16px] font-semibold tracking-tight text-white">{title}</h2>
              {status && (
                <span
                  role="status"
                  className={`${BADGE} ${STATUS_TONES[status.tone]}`}
                >
                  <Icon
                    icon={status.icon ?? (alert ? 'mdi:alert-circle' : 'mdi:check-circle')}
                    className={`w-3.5 h-3.5 ${alert ? 'animate-pulse' : ''}`}
                    aria-hidden
                  />
                  {status.label}
                </span>
              )}
            </div>
            <p className="mt-1 text-[13px] leading-snug text-white/65">{summary}</p>
            {meta && !loading && <div className="mt-2 text-[13px] leading-snug text-white/60 space-y-1">{meta}</div>}
          </div>
        </header>

        <div className="space-y-3 min-w-0">
          {loading ? (
            <div className="space-y-2.5 animate-pulse" aria-label="chargement">
              <div className="h-12 rounded-lg bg-white/[0.04]" />
              <div className="h-12 rounded-lg bg-white/[0.04]" />
            </div>
          ) : children}
        </div>
      </div>

      {details && (
        <details className="group border-t border-white/[0.06]">
          <summary className="cursor-pointer list-none flex items-center gap-2 px-4 sm:px-5 min-h-[44px] text-[13px] font-medium text-white/60 hover:text-white/85 transition-colors [&::-webkit-details-marker]:hidden">
            <Icon icon="mdi:information-outline" className="w-4 h-4" />
            Comment ça marche
            <Icon icon="mdi:chevron-down" className="w-4 h-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-4 sm:px-5 pb-4 text-[13px] leading-relaxed text-white/60 space-y-2 max-w-3xl">
            {details}
          </div>
        </details>
      )}
    </section>
  );
};

// Gros bouton d'action (≥48px, pleine largeur de sa colonne). `variant` = hiérarchie :
// 'danger' pour couper/contraindre, 'safe' pour lever (c'est alors l'action principale),
// 'ghost' pour une action secondaire.
type Variant = 'danger' | 'warning' | 'safe' | 'ghost';
const VARIANTS: Record<Variant, string> = {
  danger: 'border-rose-400/50 bg-rose-500/15 text-rose-50 hover:bg-rose-500/25 hover:border-rose-400/70',
  warning: 'border-amber-400/50 bg-amber-500/15 text-amber-50 hover:bg-amber-500/25 hover:border-amber-400/70',
  safe: 'border-emerald-400/50 bg-emerald-500/15 text-emerald-50 hover:bg-emerald-500/25 hover:border-emerald-400/70',
  ghost: 'border-white/15 bg-transparent text-white/70 hover:text-white hover:border-white/30',
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
    className={`cursor-pointer w-full min-h-[48px] inline-flex items-center justify-center gap-2 px-5 rounded-lg border text-[14px] font-semibold transition-colors
      disabled:opacity-40 disabled:cursor-not-allowed ${VARIANTS[variant]}`}
  >
    <Icon icon={busy ? 'mdi:loading' : icon} className={`w-5 h-5 ${busy ? 'animate-spin' : ''}`} />
    {children}
  </button>
);
