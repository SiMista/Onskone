import { useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import type { AdminDeckStatRow, AdminDeckStats } from '@onskone/shared';
import { useAdminResource } from '../../hooks';
import { fetchAdminDeckStats } from '../../utils/adminDataApi';
import { categoryStyle } from './decks/shared';
import { EmptyState, LoadingState, PANEL, SearchField, Segmented, Strip, Tabs, btn } from './ui';

// Trafic, visiteurs et sources : suivis par Umami (script dans index.html).
const UMAMI_DASHBOARD_URL = 'https://stats.onskone.fr/';

/** Une question montrée moins de fois que ça n'a pas assez de recul pour être classée. */
const MIN_SHOWN_QUESTIONS = 5;
const MIN_SHOWN_THEMES = 5;
const QUESTIONS_LIMIT = 15;
// Sous un thème déplié : en dessous de ce recul, le taux n'est qu'indicatif.
const LOW_DATA_SHOWN = 3;

type Order = 'best' | 'worst';
type StatsTab = 'themes' | 'questions';

const TABS: { value: StatsTab; label: string }[] = [
  { value: 'themes', label: 'Thèmes' },
  { value: 'questions', label: 'Questions' },
];
const ORDERS: { value: Order; label: string }[] = [
  { value: 'best', label: 'Les plus choisis' },
  { value: 'worst', label: 'Les moins choisis' },
];

const pct = (n: number): string => `${n.toFixed(n >= 10 ? 0 : 1)}%`;

// « Choisie 1 fois sur 2 » : lisible sans connaître le vocabulaire choisi / proposé.
const pickedLabel = (picked: number, shown: number, feminine: boolean): string => {
  const e = feminine ? 'e' : '';
  return picked === 0
    ? `Jamais choisi${e} (montré${e} ${shown} fois)`
    : `Choisi${e} ${picked} fois sur ${shown}`;
};

// Barre de taux de choix : verte au-dessus de la moyenne globale, grise en dessous (pas de
// rouge : il se confondrait avec la barre de catégorie DEEP à gauche). Décorative : la flèche
// de RateValue porte la même info sans passer par la couleur.
const RateBar = ({ rate, avg }: { rate: number; avg: number }) => (
  <div aria-hidden className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
    <div
      className={`h-full rounded-full ${rate >= avg ? 'bg-emerald-400/80' : 'bg-white/35'}`}
      style={{ width: `${Math.min(100, rate)}%` }}
    />
  </div>
);

const RateValue = ({ rate, avg, dim = false, className = 'text-[13px]' }: { rate: number; avg: number; dim?: boolean; className?: string }) => {
  const above = rate >= avg;
  const label = above ? 'au-dessus de la moyenne' : 'sous la moyenne';
  return (
    <span
      className={`inline-flex items-center font-bold tabular-nums whitespace-nowrap ${dim ? 'text-white/55' : 'text-white'} ${className}`}
      title={`${pct(rate)}, ${label} (${pct(avg)})`}
    >
      <Icon icon={above ? 'mdi:arrow-up-thin' : 'mdi:arrow-down-thin'} className={`w-4 h-4 ${above ? 'text-emerald-300' : 'text-rose-300'}`} aria-hidden />
      {pct(rate)}
      <span className="sr-only">, {label}</span>
    </span>
  );
};

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
  const [tab, setTab] = useState<StatsTab>('themes');
  const [order, setOrder] = useState<Order>('best');
  const [search, setSearch] = useState('');
  const [openThemes, setOpenThemes] = useState<Set<string>>(new Set());

  const toggleTheme = (key: string) =>
    setOpenThemes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  const avgRate = data && data.totalShown > 0 ? (data.totalPicks / data.totalShown) * 100 : 0;

  const query = search.trim().toLowerCase();

  // Questions regroupées par thème, pour le drill-down.
  const questionsByTheme = useMemo(() => {
    const map = new Map<string, AdminDeckStatRow[]>();
    for (const q of data?.questions ?? []) {
      const key = `${q.category}/${q.theme}`;
      const list = map.get(key);
      if (list) list.push(q); else map.set(key, [q]);
    }
    for (const list of map.values()) list.sort((a, b) => b.picked - a.picked || b.shown - a.shown);
    return map;
  }, [data]);

  // Une recherche lève le seuil de recul (on veut retrouver n'importe quoi) et filtre
  // sur le nom du thème OU le texte d'une de ses questions.
  const themes = useMemo(() => {
    const rows = data?.themes ?? [];
    if (!query) return sortRows(rows.filter((t) => t.shown >= MIN_SHOWN_THEMES), order);
    return sortRows(rows.filter((t) =>
      t.theme.toLowerCase().includes(query) ||
      (questionsByTheme.get(`${t.category}/${t.theme}`) ?? []).some((q) => q.question?.toLowerCase().includes(query)),
    ), order);
  }, [data, order, query, questionsByTheme]);
  // Même règle côté questions : une recherche lève le seuil de recul et la limite du top.
  const questions = useMemo(() => {
    const rows = data?.questions ?? [];
    if (query) return sortRows(rows.filter((q) => q.question?.toLowerCase().includes(query)), order);
    return sortRows(rows.filter((q) => q.shown >= MIN_SHOWN_QUESTIONS), order).slice(0, QUESTIONS_LIMIT);
  }, [data, order, query]);

  // « En bref » : ce qu'il faut retenir, en phrases, plutôt que des compteurs bruts.
  // Seuls les thèmes avec assez de recul comptent (un thème montré 2 fois ne dit rien).
  const insights = useMemo(() => {
    const ranked = sortRows((data?.themes ?? []).filter((t) => t.shown >= MIN_SHOWN_THEMES), 'best');
    const picked = ranked.filter((t) => t.picked > 0);
    return {
      best: picked[0] ?? null,
      worst: picked.length > 1 ? picked[picked.length - 1] : null,
      neverPicked: ranked.filter((t) => t.picked === 0).map((t) => t.theme),
    };
  }, [data]);

  const empty = !!data && data.totalShown === 0;

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <a
          href={UMAMI_DASHBOARD_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Visites du site sur Umami (nouvel onglet)"
          className={btn('secondary', 'sm')}
        >
          <Icon icon="mdi:chart-line" className="w-4 h-4" aria-hidden />
          Visites du site (Umami)
          <Icon icon="mdi:open-in-new" className="w-3.5 h-3.5 opacity-70" aria-hidden />
        </a>
      </div>

      {isLoading && !data ? (
        <LoadingState label="Chargement des stats…" />
      ) : empty ? (
        <EmptyState
          icon="mdi:chart-bar"
          title="Pas encore de données"
          hint="Les stats se remplissent à chaque question choisie par un pilier, à partir de maintenant."
        />
      ) : data && (
        <>
          <section aria-labelledby="stats-insights" className={`${PANEL} p-4`}>
            <h2 id="stats-insights" className="text-[16px] font-semibold tracking-tight text-white mb-3">En bref</h2>
            <ul className="space-y-2.5 text-[13px] leading-snug text-white/75">
              <li className="flex gap-2.5">
                <Icon icon="mdi:gamepad-variant-outline" className="w-[18px] h-[18px] shrink-0 text-white/50" aria-hidden />
                <span>
                  <strong className="font-semibold text-white">{data.totalPicks} manche{data.totalPicks > 1 ? 's' : ''}</strong> jouée{data.totalPicks > 1 ? 's' : ''} depuis le début du suivi.
                </span>
              </li>
              {insights.best ? (
                <li className="flex gap-2.5">
                  <Icon icon="mdi:heart-outline" className="w-[18px] h-[18px] shrink-0 text-emerald-300" aria-hidden />
                  <span>
                    Thème préféré : <strong className="font-semibold text-white">{insights.best.theme}</strong>, choisi {pct(insights.best.pickRate)} du temps quand il sort.
                  </span>
                </li>
              ) : (
                <li className="flex gap-2.5">
                  <Icon icon="mdi:timer-sand" className="w-[18px] h-[18px] shrink-0 text-white/50" aria-hidden />
                  <span>Pas encore assez de parties pour désigner un thème préféré.</span>
                </li>
              )}
              {insights.worst && (
                <li className="flex gap-2.5">
                  <Icon icon="mdi:thumb-down-outline" className="w-[18px] h-[18px] shrink-0 text-rose-300" aria-hidden />
                  <span>
                    Thème le moins choisi : <strong className="font-semibold text-white">{insights.worst.theme}</strong>, choisi {pct(insights.worst.pickRate)} du temps quand il sort.
                  </span>
                </li>
              )}
              {insights.neverPicked.length > 0 && (
                <li className="flex gap-2.5">
                  <Icon icon="mdi:eye-off-outline" className="w-[18px] h-[18px] shrink-0 text-rose-300" aria-hidden />
                  <span>
                    Jamais choisi alors qu'il est sorti au moins {MIN_SHOWN_THEMES} fois :{' '}
                    <strong className="font-semibold text-white">{insights.neverPicked.join(', ')}</strong>. À retravailler ?
                  </span>
                </li>
              )}
            </ul>
          </section>

          <div>
            <Tabs value={tab} onChange={setTab} tabs={TABS} ariaLabel="Classement" />

            <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-2 mt-3 mb-3">
              <SearchField
                value={search}
                onChange={setSearch}
                placeholder={tab === 'themes' ? 'Chercher un thème ou une question' : 'Chercher une question'}
              />
              <Segmented value={order} onChange={setOrder} options={ORDERS} ariaLabel="Ordre du classement" />
            </div>

            {tab === 'themes' && (
              <div role="tabpanel">
                {themes.length === 0 ? (
                  query ? (
                    <EmptyState icon="mdi:magnify" title="Aucun thème ni question ne correspond" hint="Essaie un autre mot." />
                  ) : (
                    <EmptyState
                      icon="mdi:timer-sand"
                      title="Pas encore assez de parties"
                      hint={`Un thème doit avoir été montré au moins ${MIN_SHOWN_THEMES} fois pour être classé.`}
                    />
                  )
                ) : (
                  <div className={`${PANEL} divide-y divide-white/[0.06]`}>
                    {themes.map((t, i) => {
                      const cat = categoryStyle(t.category);
                      const key = `${t.category}/${t.theme}`;
                      const themeQuestions = questionsByTheme.get(key) ?? [];
                      const isOpen = openThemes.has(key) || (!!query && themeQuestions.some((q) => q.question?.toLowerCase().includes(query)));
                      return (
                        <div key={key}>
                          <button
                            type="button"
                            onClick={() => toggleTheme(key)}
                            aria-expanded={isOpen}
                            className="relative cursor-pointer w-full text-left px-3 pl-4 py-2.5 space-y-1.5 hover:bg-white/[0.03] transition-colors"
                          >
                            <Strip color={cat.strip} row />
                            <div className="flex items-center gap-2">
                              <span className="w-6 text-[12px] text-white/50 tabular-nums">{i + 1}</span>
                              <span className="flex-1 min-w-0 truncate text-[14px] font-medium text-white/90" title={`${t.theme} (${t.category})`}>{t.theme}</span>
                              <RateValue rate={t.pickRate} avg={avgRate} />
                              <Icon icon="mdi:chevron-down" className={`w-4 h-4 text-white/50 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden />
                            </div>
                            <RateBar rate={t.pickRate} avg={avgRate} />
                            <p className="text-[12px] text-white/55">
                              {pickedLabel(t.picked, t.shown, false)} · {pct(t.pickShare)} de toutes les questions choisies
                            </p>
                          </button>
                          {isOpen && (
                            <div className="bg-black/25 border-t border-white/[0.06] divide-y divide-white/[0.06]">
                              {themeQuestions.length === 0 ? (
                                <p className="px-3 py-2.5 text-[12px] text-white/50">Aucune question montrée pour l'instant.</p>
                              ) : themeQuestions.map((q) => {
                                const highlighted = !!query && !!q.question?.toLowerCase().includes(query);
                                return (
                                  <div key={q.question} className={`pl-10 pr-3 py-2 space-y-1 ${highlighted ? 'bg-amber-400/[0.06]' : ''}`}>
                                    <div className="flex items-start gap-2">
                                      <span className="flex-1 min-w-0 text-[12px] text-white/80 leading-snug">{q.question}</span>
                                      <RateValue rate={q.pickRate} avg={avgRate} dim={q.shown < LOW_DATA_SHOWN} className="text-[12px]" />
                                    </div>
                                    <RateBar rate={q.pickRate} avg={avgRate} />
                                    <p className="text-[12px] text-white/55">
                                      {pickedLabel(q.picked, q.shown, true)}
                                      {q.shown < LOW_DATA_SHOWN && ' · trop tôt pour juger'}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {tab === 'questions' && (
              <div role="tabpanel">
                {questions.length === 0 ? (
                  query ? (
                    <EmptyState icon="mdi:magnify" title="Aucune question ne correspond" hint="Essaie un autre mot." />
                  ) : (
                    <EmptyState
                      icon="mdi:timer-sand"
                      title="Pas encore assez de parties"
                      hint={`Une question doit avoir été montrée au moins ${MIN_SHOWN_QUESTIONS} fois pour être classée.`}
                    />
                  )
                ) : (
                  <div className={`${PANEL} divide-y divide-white/[0.06]`}>
                    {questions.map((q, i) => (
                      <div key={`${q.theme}/${q.question}`} className="relative px-3 pl-4 py-2.5 space-y-1.5">
                        <Strip color={categoryStyle(q.category).strip} row />
                        <div className="flex items-start gap-2">
                          <span className="w-6 text-[12px] text-white/50 tabular-nums">{i + 1}</span>
                          <span className="flex-1 min-w-0 text-[13px] text-white/90 leading-snug">{q.question}</span>
                          <RateValue rate={q.pickRate} avg={avgRate} />
                        </div>
                        <RateBar rate={q.pickRate} avg={avgRate} />
                        <p className="text-[12px] text-white/55">
                          <span className={`font-medium ${categoryStyle(q.category).text}`}>{q.theme}</span> · {pickedLabel(q.picked, q.shown, true)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
