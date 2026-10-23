import { useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import type { AdminDeckStatRow, AdminDeckStats } from '@onskone/shared';
import { useAdminResource } from '../../hooks';
import { fetchAdminDeckStats } from '../../utils/adminDataApi';
import { categoryStyle } from './decks/shared';

// Trafic, visiteurs et sources : suivis par Umami (script dans index.html).
const UMAMI_DASHBOARD_URL = 'https://stats.onskone.fr/';

/** Une question proposée moins de fois que ça n'a pas assez de recul pour être classée. */
const MIN_SHOWN_QUESTIONS = 5;
const MIN_SHOWN_THEMES = 5;
const QUESTIONS_LIMIT = 15;

type Order = 'best' | 'worst';

const pct = (n: number): string => `${n.toFixed(n >= 10 ? 0 : 1)}%`;

const KpiCell = ({ label, value, hint }: { label: string; value: number | string; hint?: string }) => (
  <div className="rounded-lg surface-glass p-3">
    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">{label}</p>
    <p className="mt-1 text-[26px] font-semibold tracking-tight tabular-nums text-white leading-tight">{value}</p>
    {hint && <p className="mt-0.5 font-mono text-[10px] text-white/35">{hint}</p>}
  </div>
);

const SectionLabel = ({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
    <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/55 font-bold">{children}</p>
    {right}
  </div>
);

const OrderToggle = ({ value, onChange }: { value: Order; onChange: (o: Order) => void }) => (
  <div className="inline-flex items-center gap-0.5 p-0.5 rounded-md bg-black/30 border border-white/[0.06]">
    {([['best', 'Meilleurs'], ['worst', 'Pires']] as const).map(([id, label]) => (
      <button
        key={id}
        onClick={() => onChange(id)}
        className={`cursor-pointer px-2.5 py-1 rounded font-mono text-[10px] font-bold uppercase tracking-[0.12em] transition-colors ${value === id
          ? (id === 'best' ? 'bg-emerald-400/15 text-emerald-200' : 'bg-rose-400/15 text-rose-200')
          : 'text-white/45 hover:text-white/80'
          }`}
      >
        {label}
      </button>
    ))}
  </div>
);

// Barre de taux de choix : vert au-dessus de la moyenne globale, rouge en dessous.
const RateBar = ({ rate, avg }: { rate: number; avg: number }) => (
  <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
    <div
      className={`h-full rounded-full ${rate >= avg ? 'bg-emerald-400/80' : 'bg-rose-400/70'}`}
      style={{ width: `${Math.min(100, rate)}%` }}
    />
  </div>
);

const sortRows = (rows: AdminDeckStatRow[], order: Order): AdminDeckStatRow[] =>
  [...rows].sort((a, b) => {
    const diff = order === 'best' ? b.pickRate - a.pickRate : a.pickRate - b.pickRate;
    // Départage : plus de recul statistique d'abord.
    return diff || b.shown - a.shown;
  });

export const StatsPanel = ({ active, refreshKey }: { active: boolean; refreshKey: number }) => {
  const { data, isLoading } = useAdminResource<AdminDeckStats>({
    fetcher: fetchAdminDeckStats,
    active,
    refreshKey,
  });
  const [themeOrder, setThemeOrder] = useState<Order>('best');
  const [questionOrder, setQuestionOrder] = useState<Order>('best');

  const avgRate = data && data.totalShown > 0 ? (data.totalPicks / data.totalShown) * 100 : 0;

  const themes = useMemo(
    () => sortRows((data?.themes ?? []).filter((t) => t.shown >= MIN_SHOWN_THEMES), themeOrder),
    [data, themeOrder],
  );
  const questions = useMemo(
    () => sortRows((data?.questions ?? []).filter((q) => q.shown >= MIN_SHOWN_QUESTIONS), questionOrder)
      .slice(0, QUESTIONS_LIMIT),
    [data, questionOrder],
  );

  const empty = !!data && data.totalShown === 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[12px] text-white/45 max-w-xl">
          Taux de choix = combien de fois le pilier a pris l'élément quand il lui était proposé.
          Un thème tiré plus souvent n'est pas forcément plus aimé, d'où ce ratio.
        </p>
        <a
          href={UMAMI_DASHBOARD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-sky-400/30 bg-sky-500/[0.06] text-sky-200 hover:bg-sky-500/15 font-mono text-[11px] uppercase tracking-wider transition-colors whitespace-nowrap"
        >
          <Icon icon="mdi:chart-line" className="w-3.5 h-3.5" />
          dashboard umami
          <Icon icon="mdi:open-in-new" className="w-3 h-3 opacity-60" />
        </a>
      </div>

      {isLoading && !data ? (
        <div className="text-center py-20 font-mono text-[11px] uppercase tracking-[0.3em] text-white/30">chargement…</div>
      ) : empty ? (
        <div className="text-center py-20 space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-white/30">pas encore de données</p>
          <p className="text-[12px] text-white/40">Les stats se remplissent à chaque question choisie par un pilier, à partir de maintenant.</p>
        </div>
      ) : data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCell label="Questions choisies" value={data.totalPicks} />
            <KpiCell label="Thèmes proposés" value={data.totalShown} hint="3 cartes max par manche" />
            <KpiCell label="Taux de choix moyen" value={pct(avgRate)} hint="choisis / proposés" />
            <KpiCell label="Thèmes jamais choisis" value={data.themes.filter((t) => t.picked === 0).length} hint={`sur ${data.themes.length} proposés`} />
          </div>

          <section>
            <SectionLabel right={<OrderToggle value={themeOrder} onChange={setThemeOrder} />}>
              Thèmes · taux de choix
            </SectionLabel>
            {themes.length === 0 ? (
              <p className="text-[12px] text-white/40">Aucun thème proposé au moins {MIN_SHOWN_THEMES} fois pour l'instant.</p>
            ) : (
              <div className="rounded-lg surface-glass divide-y divide-white/[0.05]">
                {themes.map((t, i) => {
                  const cat = categoryStyle(t.category);
                  return (
                    <div key={`${t.category}/${t.theme}`} className="px-3 py-2.5 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-5 font-mono text-[10px] text-white/30 tabular-nums">{i + 1}</span>
                        <span className={`w-1.5 h-1.5 rounded-full ${cat.dot}`} title={t.category} />
                        <span className="flex-1 min-w-0 truncate text-[13px] text-white/90">{t.theme}</span>
                        <span className="font-mono text-[13px] font-bold tabular-nums text-white">{pct(t.pickRate)}</span>
                      </div>
                      <RateBar rate={t.pickRate} avg={avgRate} />
                      <p className="font-mono text-[10px] text-white/35">
                        {t.picked} choisi{t.picked > 1 ? 's' : ''} / {t.shown} proposé{t.shown > 1 ? 's' : ''} · {pct(t.pickShare)} de tous les choix
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <SectionLabel right={<OrderToggle value={questionOrder} onChange={setQuestionOrder} />}>
              Questions · top {QUESTIONS_LIMIT}
            </SectionLabel>
            {questions.length === 0 ? (
              <p className="text-[12px] text-white/40">
                Aucune question proposée au moins {MIN_SHOWN_QUESTIONS} fois pour l'instant : il faut un peu de recul pour classer.
              </p>
            ) : (
              <div className="rounded-lg surface-glass divide-y divide-white/[0.05]">
                {questions.map((q, i) => (
                  <div key={`${q.theme}/${q.question}`} className="px-3 py-2.5 space-y-1.5">
                    <div className="flex items-start gap-2">
                      <span className="w-5 pt-0.5 font-mono text-[10px] text-white/30 tabular-nums">{i + 1}</span>
                      <span className="flex-1 min-w-0 text-[13px] text-white/90 leading-snug">{q.question}</span>
                      <span className="font-mono text-[13px] font-bold tabular-nums text-white">{pct(q.pickRate)}</span>
                    </div>
                    <RateBar rate={q.pickRate} avg={avgRate} />
                    <p className="font-mono text-[10px] text-white/35">
                      {q.theme} · {q.picked} choisie{q.picked > 1 ? 's' : ''} / {q.shown} proposée{q.shown > 1 ? 's' : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};
