import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Icon } from '../../components/Icon';
import { INPUT_CLS } from './shared';
import { BADGE_TONES, BADGE, KpiCell, PANEL, SectionLabel, Segmented } from './ui';
import { CumulChart, REVENUE_COLOR } from './budget/CumulChart';
import {
  COSTS, DEFAULT_PRICE, PRICE_PRESETS, STORE_FEE, VAT_RATE, breakEvenMonth, cumulativeCost, formatEuros, formatMonthYear,
  formatMonths, formatRate, netPerSale, saleBreakdown, salesPerMonthNeeded, salesToCover, yearlyCost,
} from './budget/model';

const MAX_SALES_PER_MONTH = 40;
const DEFAULT_SALES_PER_MONTH = 10;
const HORIZONS = [1, 2, 3, 5];
/** Durées proposées pour le graphique (en mois) : jusqu'à 1 an, l'axe passe en mois. */
const CHART_MONTHS = [6, 12, 24, 36, 60];
const DEFAULT_CHART_MONTHS = 36;

// Réglages de la simulation, gardés d'une visite à l'autre sur ce navigateur (confort seulement).
const STORAGE_KEY = 'onskone_admin_budget';
type Settings = { price: number; salesPerMonth: number; chartMonths: number };
const DEFAULT_SETTINGS: Settings = { price: DEFAULT_PRICE, salesPerMonth: DEFAULT_SALES_PER_MONTH, chartMonths: DEFAULT_CHART_MONTHS };
const loadSettings = (): Settings => {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<Record<keyof Settings, unknown>> | null;
    const price = typeof raw?.price === 'number' && raw.price >= 0 ? raw.price : DEFAULT_PRICE;
    const sales = typeof raw?.salesPerMonth === 'number' && raw.salesPerMonth >= 0 && raw.salesPerMonth <= MAX_SALES_PER_MONTH
      ? raw.salesPerMonth : DEFAULT_SALES_PER_MONTH;
    const chartMonths = typeof raw?.chartMonths === 'number' && CHART_MONTHS.includes(raw.chartMonths)
      ? raw.chartMonths : DEFAULT_CHART_MONTHS;
    return { price, salesPerMonth: sales, chartMonths };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

const chartMonthsLabel = (m: number): string => (m < 12 ? `${m} mois` : `${m / 12} an${m > 12 ? 's' : ''}`);

/** Titre d'une des deux zones de la page, avec sa phrase d'explication. */
const Zone = ({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) => (
  <section className="space-y-4">
    <div>
      <h2 className="text-[16px] font-semibold tracking-tight text-white">{title}</h2>
      <p className="mt-0.5 text-[13px] text-white/55">{subtitle}</p>
    </div>
    {children}
  </section>
);

/**
 * Budget, en deux zones qui ne se répètent pas :
 * - « Ce que ça coûte » : uniquement des faits (frais fixes, cumul dans le temps) ;
 * - « Ce que ça rapporte » : tout ce qui dépend du prix et des ventes (simulation).
 */
export const BudgetPanel = () => {
  const [initial] = useState(loadSettings);
  const [price, setPrice] = useState(initial.price);
  const [salesPerMonth, setSalesPerMonth] = useState(initial.salesPerMonth);
  const [chartMonths, setChartMonths] = useState(initial.chartMonths);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ price, salesPerMonth, chartMonths })); } catch { /* navigation privée */ }
  }, [price, salesPerMonth, chartMonths]);

  const yearly = yearlyCost();
  const net = netPerSale(price);
  const salesPerYear = salesToCover(yearly, price);
  const neededPerMonth = salesPerMonthNeeded(price);
  const breakEven = useMemo(() => breakEvenMonth(salesPerMonth, price), [salesPerMonth, price]);
  const sortedCosts = useMemo(() => [...COSTS].sort((a, b) => b.amount - a.amount), []);
  const biggest = sortedCosts[0]?.amount ?? 1;

  return (
    <div className="space-y-10">
      {/* En bref : les frais, puis ce que donne la simulation (prix rappelé). */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KpiCell label="Frais par an" value={formatEuros(yearly)} hint={`soit ${formatEuros(yearly / 12)} par mois`} />
        <KpiCell label="Gain par vente" value={formatEuros(net)} hint={`à ${formatEuros(price)}, après TVA et store`} />
        {/* Sur téléphone (2 colonnes), la 3e tuile prend toute la largeur plutôt que de rester seule. */}
        <div className="col-span-2 md:col-span-1 grid">
          <KpiCell
            label="Rentable à partir de"
            value={salesPerYear === null ? '—' : `${salesPerYear} ventes par an`}
            hint={neededPerMonth === null ? 'à 0 €, une vente ne rapporte rien' : `soit ${formatRate(neededPerMonth)} par mois`}
          />
        </div>
      </div>


      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Une barre par poste, à l'échelle du plus gros. */}
        <div>
          <SectionLabel>Où part l'argent</SectionLabel>
          <div className={`${PANEL} divide-y divide-white/[0.06]`}>
            {sortedCosts.map((c) => (
              <div key={c.id} className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <Icon icon={c.icon} className="w-5 h-5 shrink-0 text-white/60" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-white truncate">{c.label}</p>
                    <p className="text-[12px] text-white/50 truncate">{c.detail}</p>
                  </div>
                  <span className={`${BADGE} ${c.period === 'year' ? BADGE_TONES.neutral : BADGE_TONES.sky}`}>
                    {c.period === 'year' ? 'par an' : 'une fois'}
                  </span>
                  <span className="w-12 text-right text-[14px] font-semibold tabular-nums text-white">{formatEuros(c.amount)}</span>
                </div>
                <div className="mt-2 ml-8 h-1.5 rounded-full bg-white/[0.06] overflow-hidden" aria-hidden>
                  <div className="h-full rounded-full bg-white/35" style={{ width: `${(c.amount / biggest) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <SectionLabel>Au fil des années</SectionLabel>
          <div className={`${PANEL} divide-y divide-white/[0.06]`}>
            {HORIZONS.map((years) => (
              <div key={years} className="px-4 py-3 flex items-center justify-between text-[14px]">
                {/* Fin du dernier mois de la période (années pleines depuis le lancement). */}
                <span className="text-white/75">
                  Fin {formatMonthYear(years * 12 - 1)}
                  <span className="ml-2 text-[12px] text-white/45">{years} an{years > 1 ? 's' : ''}</span>
                </span>
                {/* Après `years` années pleines : la dernière est payée, pas la suivante. */}
                <span className="font-semibold tabular-nums text-white">{formatEuros(cumulativeCost(years * 12 - 1))}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-white/50 leading-snug">
            Depuis le lancement ({formatMonthYear(0)}). Les abonnements se paient à chaque anniversaire :
            « fin {formatMonthYear(23)} » compte deux années payées.
          </p>
        </div>
      </div>

      <Zone title="Ce que ça rapporte" subtitle="Simulation : choisis un prix et un rythme de ventes.">
        <div className={`${PANEL} p-4 md:p-5 space-y-5`}>
          <div className="flex flex-col md:flex-row md:items-end gap-4 md:gap-8">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="budget-price" className="text-[13px] text-white/65">Prix du premium</label>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-2">
                  <input
                    id="budget-price"
                    type="number"
                    min={0}
                    step={0.5}
                    value={price}
                    onChange={(e) => setPrice(Math.max(0, Number(e.target.value) || 0))}
                    className={`${INPUT_CLS} w-24 tabular-nums`}
                  />
                  <span className="text-[13px] text-white/60">€ TTC</span>
                </span>
                <Segmented
                  ariaLabel="Prix rapides"
                  value={PRICE_PRESETS.includes(price) ? String(price) : ''}
                  onChange={(v) => setPrice(Number(v))}
                  options={PRICE_PRESETS.map((p) => ({ value: String(p), label: <span className="tabular-nums">{formatEuros(p)}</span> }))}
                  className="flex-wrap"
                />
              </div>
            </div>
            <label className="flex-1 flex flex-col gap-1.5 min-w-0">
              <span className="flex items-baseline justify-between text-[13px] text-white/65">
                Ventes par mois
                <span className="text-[16px] font-semibold tabular-nums text-white">{salesPerMonth}</span>
              </span>
              <input
                type="range"
                min={0}
                max={MAX_SALES_PER_MONTH}
                value={salesPerMonth}
                onChange={(e) => setSalesPerMonth(Number(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </label>
          </div>

          <SaleSplit price={price} />

          {/* Le verdict au rythme choisi, avant la courbe. */}
          <p className="flex items-start gap-2 text-[14px] text-white/85 leading-snug">
            <Icon
              icon={breakEven !== null ? 'mdi:check-circle-outline' : 'mdi:alert-circle-outline'}
              className={`w-5 h-5 shrink-0 ${breakEven !== null ? 'text-emerald-300' : 'text-amber-300'}`}
              aria-hidden
            />
            {breakEven !== null ? (
              <span>
                À {salesPerMonth} vente{salesPerMonth > 1 ? 's' : ''} par mois, c'est rentable{' '}
                {breakEven === 0
                  ? 'dès le lancement'
                  : <>au bout de <b className="text-white">{formatMonths(breakEven)}</b>, en {formatMonthYear(breakEven)}</>}.
              </span>
            ) : (
              <span>
                À {salesPerMonth} vente{salesPerMonth > 1 ? 's' : ''} par mois, les ventes ne couvrent pas les frais : jamais rentable.
              </span>
            )}
          </p>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="text-[13px] text-white/65">Durée du graphique</span>
              <Segmented
                ariaLabel="Durée du graphique"
                value={String(chartMonths)}
                onChange={(v) => setChartMonths(Number(v))}
                options={CHART_MONTHS.map((m) => ({ value: String(m), label: chartMonthsLabel(m) }))}
                className="flex-wrap"
              />
            </div>
            <CumulChart salesPerMonth={salesPerMonth} price={price} breakEven={breakEven} months={chartMonths} />
          </div>
        </div>

        <div>
          <SectionLabel>Et si je change le prix ?</SectionLabel>
          <PriceComparison price={price} salesPerMonth={salesPerMonth} onPick={setPrice} />
          <p className="mt-2 text-[12px] text-white/50 leading-snug">
            À {salesPerMonth} vente{salesPerMonth > 1 ? 's' : ''} par mois pour chaque prix. En vrai, un prix plus haut fait souvent vendre un peu moins :
            baisse le curseur des ventes pour voir à partir de quand la hausse ne paie plus.
          </p>
        </div>

        <p className="text-[12px] text-white/50 leading-snug">
          Hypothèses : prix TTC, TVA de {Math.round(VAT_RATE * 100)} % et commission des stores de {Math.round(STORE_FEE * 100)} %
          (sous 1 M$ par an ; chez Apple, programme « Small Business » à demander, sinon 30 %).
          Sans les revenus pub ni les cotisations URSSAF.
        </p>
      </Zone>
    </div>
  );
};

/** Où part une vente : barre en trois morceaux (2 px d'air entre eux), à l'échelle du prix. */
const SaleSplit = ({ price }: { price: number }) => {
  const { vat, fee, net } = saleBreakdown(price);
  if (price <= 0) return null;
  const parts = [
    { key: 'net', label: 'Pour toi', value: net, color: REVENUE_COLOR },
    { key: 'fee', label: `Store (${Math.round(STORE_FEE * 100)} %)`, value: fee, color: 'rgba(255,255,255,0.32)' },
    { key: 'vat', label: `TVA (${Math.round(VAT_RATE * 100)} %)`, value: vat, color: 'rgba(255,255,255,0.14)' },
  ];
  return (
    <div>
      <p className="text-[13px] text-white/65 mb-2">
        Une vente à <span className="font-semibold tabular-nums text-white">{formatEuros(price)}</span>
      </p>
      <div className="flex gap-[2px] h-2.5" aria-hidden>
        {parts.map((p) => (
          <span key={p.key} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(p.value / price) * 100}%`, background: p.color }} />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-white/65">
        {parts.map((p) => (
          <li key={p.key} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="w-2.5 h-2.5 rounded-sm" style={{ background: p.color }} />
            {p.label}
            <span className="font-semibold tabular-nums text-white">{formatEuros(p.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

/** Les prix proposés (et le prix en cours s'il n'en fait pas partie), au même rythme de ventes. */
const PriceComparison = ({
  price, salesPerMonth, onPick,
}: {
  price: number;
  salesPerMonth: number;
  onPick: (price: number) => void;
}) => {
  const yearly = yearlyCost();
  const prices = [...new Set([...PRICE_PRESETS, price])].filter((p) => p > 0).sort((a, b) => a - b);
  return (
    <div className={`${PANEL} overflow-x-auto`}>
      <table className="w-full text-[13px] min-w-[340px]">
        <thead>
          <tr className="text-left text-[12px] text-white/50">
            <th className="px-4 py-2.5 font-medium">Prix</th>
            <th className="px-4 py-2.5 font-medium text-right">Pour toi par vente</th>
            <th className="px-4 py-2.5 font-medium text-right">Bénéfice par an</th>
            <th className="px-4 py-2.5 font-medium text-right">Ventes/mois pour payer l'année</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.06]">
          {prices.map((p) => {
            const net = netPerSale(p);
            const revenue = net * salesPerMonth * 12;
            const profit = revenue - yearly;
            const needed = salesPerMonthNeeded(p);
            const current = p === price;
            return (
              <tr
                key={p}
                onClick={() => onPick(p)}
                className={`cursor-pointer transition-colors ${current ? 'bg-amber-400/10' : 'hover:bg-white/[0.04]'}`}
              >
                <td className="px-4 py-2.5">
                  {/* Bouton : la ligne entière se clique à la souris, le prix au clavier. */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onPick(p); }}
                    aria-pressed={current}
                    aria-label={`Simuler à ${formatEuros(p)}`}
                    className={`cursor-pointer rounded font-semibold tabular-nums focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 ${current ? 'text-amber-100' : 'text-white'}`}
                  >
                    {formatEuros(p)}
                  </button>
                  {current && <span className="ml-2 text-[12px] text-white/50">simulé</span>}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-white/80">{formatEuros(net)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-white">
                  {profit >= 0 ? '+' : '−'}{formatEuros(Math.abs(Math.round(profit)))}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-white/80">
                  {needed === null ? '—' : formatRate(needed)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
