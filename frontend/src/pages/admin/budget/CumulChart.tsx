import { useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import { cumulativeCost, cumulativeRevenue, formatEuros, formatMonths } from './model';
import { FLOATING } from '../ui';

// Palette sombre de l'admin (hors tokens, comme le reste de l'admin). Validée sur la surface
// des blocs (#1b202d) : contraste ≥ 3:1 et séparation daltonisme OK.
const COST_COLOR = '#d95926';
export const REVENUE_COLOR = '#3987e5';
const SURFACE = '#1b202d';

const HEIGHT = 230;
const PAD = { top: 16, right: 60, bottom: 28, left: 52 };

/** Pas de graduation « rond » (50, 100, 200, 250, 500…) pour ~4 lignes. */
const niceStep = (max: number): number => {
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow;
  return step;
};

// « Début » plutôt que « Lancement » : sur téléphone, le mot long touchait « 1 an ».
const yearLabel = (m: number): string => (m === 0 ? 'Début' : `${m / 12} an${m > 12 ? 's' : ''}`);

/**
 * Coûts cumulés (marches : un abonnement se paie chaque début d'année) contre revenus
 * cumulés du premium, sur `months` mois. Le croisement durable = point de rentabilité.
 */
export const CumulChart = ({
  salesPerMonth, price, breakEven, months = 36,
}: {
  salesPerMonth: number;
  price: number;
  breakEven: number | null;
  months?: number;
}) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => { if (el.clientWidth > 0) setWidth(el.clientWidth); };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Le dernier mois affiché clôt la dernière année : l'abonnement suivant (payé au début de
  // l'année d'après) n'est pas compté, comme dans le tableau « Au fil des années ».
  const cost = (m: number) => cumulativeCost(Math.min(m, months - 1));
  const revenue = (m: number) => cumulativeRevenue(m, salesPerMonth, price);

  const plotW = Math.max(120, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const step = niceStep(Math.max(cost(months), revenue(months)));
  const yMax = Math.ceil(Math.max(cost(months), revenue(months)) / step) * step;
  const x = (m: number) => PAD.left + (m / months) * plotW;
  const y = (v: number) => PAD.top + plotH - (v / yMax) * plotH;

  // Marches des coûts : plat sur l'année, saut au renouvellement.
  let costPath = `M ${x(0)} ${y(cost(0))}`;
  for (let m = 12; m < months; m += 12) {
    costPath += ` H ${x(m)} V ${y(cost(m))}`;
  }
  costPath += ` H ${x(months)}`;
  const revenuePath = `M ${x(0)} ${y(0)} L ${x(months)} ${y(revenue(months))}`;

  const ticks = Array.from({ length: Math.round(yMax / step) + 1 }, (_, i) => i * step);
  const yearTicks = Array.from({ length: Math.floor(months / 12) + 1 }, (_, i) => i * 12);
  const showBreakEven = breakEven !== null && breakEven <= months;

  // Valeur au bout de chaque courbe ; écartées si elles se chevauchent.
  let endCostY = y(cost(months));
  let endRevenueY = y(revenue(months));
  const gap = 14 - Math.abs(endCostY - endRevenueY);
  if (gap > 0) {
    const sign = endCostY <= endRevenueY ? -1 : 1;
    endCostY += (sign * gap) / 2;
    endRevenueY -= (sign * gap) / 2;
  }

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    setHover(Math.min(months, Math.max(0, Math.round(ratio * months))));
  };

  const balance = hover !== null ? revenue(hover) - cost(hover) : 0;
  // À côté du curseur (à droite, ou à gauche près du bord) : jamais par-dessus le point lu.
  const TOOLTIP_W = 180;
  const tooltipLeft = hover === null ? 0
    : x(hover) + 12 + TOOLTIP_W <= width ? x(hover) + 12
      : Math.max(0, x(hover) - 12 - TOOLTIP_W);

  return (
    <div>
      {/* Légende : deux séries, une clé en trait (la couleur ne porte jamais seule le sens). */}
      <div className="flex items-center gap-4 mb-2 text-[12px] text-white/70">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="w-4 h-[2px] rounded-full" style={{ background: COST_COLOR }} />
          Coûts payés
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="w-4 h-[2px] rounded-full" style={{ background: REVENUE_COLOR }} />
          Revenus du premium
        </span>
      </div>

      <div ref={boxRef} className="relative w-full">
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`Sur ${formatMonths(months)} : ${formatEuros(cost(months))} de coûts pour ${formatEuros(revenue(months))} de revenus.`}
          className="block select-none"
        >
          {/* Grille horizontale : traits fins, en retrait. */}
          {ticks.map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={PAD.left + plotW} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(v)} dy="0.32em" textAnchor="end" fontSize={11} fill="rgba(255,255,255,0.5)" className="tabular-nums">
                {formatEuros(v)}
              </text>
            </g>
          ))}
          {yearTicks.map((m) => (
            <text
              key={m}
              x={x(m)}
              y={HEIGHT - 8}
              textAnchor={m === 0 ? 'start' : m === months ? 'end' : 'middle'}
              fontSize={11}
              fill="rgba(255,255,255,0.5)"
            >
              {yearLabel(m)}
            </text>
          ))}

          {showBreakEven && (
            <line
              x1={x(breakEven)} x2={x(breakEven)} y1={PAD.top} y2={PAD.top + plotH}
              stroke="rgba(255,255,255,0.25)" strokeWidth={1}
            />
          )}

          <path d={costPath} fill="none" stroke={COST_COLOR} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <path d={revenuePath} fill="none" stroke={REVENUE_COLOR} strokeWidth={2} strokeLinecap="round" />

          <text x={x(months) + 6} y={endCostY} dy="0.32em" fontSize={11} fontWeight={600} fill="rgba(255,255,255,0.8)" className="tabular-nums">
            {formatEuros(cost(months))}
          </text>
          <text x={x(months) + 6} y={endRevenueY} dy="0.32em" fontSize={11} fontWeight={600} fill="rgba(255,255,255,0.8)" className="tabular-nums">
            {formatEuros(Math.round(revenue(months)))}
          </text>

          {showBreakEven && (
            <g>
              <circle cx={x(breakEven)} cy={y(revenue(breakEven))} r={5} fill={REVENUE_COLOR} stroke={SURFACE} strokeWidth={2} />
              <text
                x={x(breakEven) + (x(breakEven) > PAD.left + plotW - 80 ? -8 : 8)}
                y={PAD.top + 10}
                textAnchor={x(breakEven) > PAD.left + plotW - 80 ? 'end' : 'start'}
                fontSize={12}
                fontWeight={600}
                fill="rgba(255,255,255,0.85)"
              >
                Rentable
              </text>
            </g>
          )}

          {hover !== null && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} stroke="rgba(255,255,255,0.35)" strokeWidth={1} />
              <circle cx={x(hover)} cy={y(cost(hover))} r={4} fill={COST_COLOR} stroke={SURFACE} strokeWidth={2} />
              <circle cx={x(hover)} cy={y(revenue(hover))} r={4} fill={REVENUE_COLOR} stroke={SURFACE} strokeWidth={2} />
            </g>
          )}

          {/* Zone de survol plus large que les traits. */}
          <rect
            x={PAD.left} y={PAD.top} width={plotW} height={plotH}
            fill="transparent"
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>

        {hover !== null && (
          <div
            className={`${FLOATING} pointer-events-none absolute top-1 w-[180px] z-10 px-3 py-2 text-[12px]`}
            style={{ left: tooltipLeft }}
          >
            <p className="font-semibold text-white">{hover === 0 ? 'Lancement' : `Après ${formatMonths(hover)}`}</p>
            <p className="mt-1 flex items-center gap-1.5 text-white/70">
              <span aria-hidden className="w-2.5 h-[2px] rounded-full" style={{ background: COST_COLOR }} />
              Coûts <span className="ml-auto tabular-nums text-white">{formatEuros(cost(hover))}</span>
            </p>
            <p className="flex items-center gap-1.5 text-white/70">
              <span aria-hidden className="w-2.5 h-[2px] rounded-full" style={{ background: REVENUE_COLOR }} />
              Revenus <span className="ml-auto tabular-nums text-white">{formatEuros(revenue(hover))}</span>
            </p>
            <p className="mt-1 pt-1 border-t border-white/10 flex text-white/70">
              {balance >= 0 ? 'Bénéfice' : 'Reste à couvrir'}
              <span className="ml-auto tabular-nums font-semibold text-white">{formatEuros(Math.abs(balance))}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
