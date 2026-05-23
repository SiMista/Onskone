import { Layout, SlotConfig, CLUSTER, PILL_BTN, PILL_ICON, SELECT_CLS } from './shared';

interface ToolbarProps {
  view: 'rigging' | 'gallery';
  setView: (v: 'rigging' | 'gallery') => void;
  slots: SlotConfig[];
  layout: Layout;
  setLayout: (l: Layout) => void;
  zoom: number;
  setZoom: (z: number | ((prev: number) => number)) => void;
  debugTimers: boolean;
  setDebugTimers: (v: boolean | ((prev: boolean) => boolean)) => void;
  running: boolean;
  allBots: boolean;
  burstCount: number;
  setBurstCount: (n: number) => void;
  onAddSlot: () => void;
  onRemoveLastSlot: () => void;
  onToggleAllBots: () => void;
  onReloadAll: () => void;
  onStart: () => void;
  onReset: () => void;
  onTriggerStress: () => void;
}

export const Toolbar = ({
  view, setView,
  slots, layout, setLayout, zoom, setZoom, debugTimers, setDebugTimers,
  running, allBots, burstCount, setBurstCount,
  onAddSlot, onRemoveLastSlot, onToggleAllBots,
  onReloadAll, onStart, onReset, onTriggerStress,
}: ToolbarProps) => (
  <div className="sticky top-0 z-30 backdrop-blur-xl bg-[#0a0c12]/85 border-b border-white/[0.07]">
    <div className="px-4 py-3 flex flex-wrap items-center gap-2.5">
      <div className="flex items-center gap-2.5 ml-1">
        <span className="font-mono text-[15px] leading-none flex items-baseline gap-1.5 select-none">
          <span className="text-amber-400">▍</span>
          <span className="text-white/55 tracking-tight">onskoné</span>
          <span className="text-white/25">/</span>
          <span className="text-amber-200 font-bold tracking-tight uppercase">studio</span>
        </span>
        <span
          className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-red-200 border border-red-400/50 bg-red-500/[0.08] rounded px-1.5 py-0.5 shadow-[inset_0_0_0_1px_rgba(248,113,113,0.08)]"
          title="Page interne - non destinée à la production"
        >
          ⚠ Dev only
        </span>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={view === 'gallery'}
        aria-label="Basculer entre Régie et Composants"
        onClick={() => setView(view === 'rigging' ? 'gallery' : 'rigging')}
        className="ml-2 relative grid grid-cols-2 rounded-md border border-white/10 bg-black/30 p-0.5 font-mono text-[11px] uppercase tracking-wider select-none cursor-pointer overflow-hidden hover:border-white/20 transition-colors"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute top-0.5 bottom-0.5 left-0.5 rounded bg-white/[0.10] border border-white/[0.06] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] transition-transform duration-300 ease-out"
          style={{
            width: 'calc(50% - 2px)',
            transform: view === 'gallery' ? 'translateX(100%)' : 'translateX(0)',
          }}
        />
        <span
          className={`pointer-events-none relative z-10 px-3 py-1 rounded transition-colors flex items-center justify-center text-center ${view === 'rigging' ? 'text-white' : 'text-white/45'}`}
        >Régie</span>
        <span
          className={`pointer-events-none relative z-10 px-3 py-1 rounded transition-colors flex items-center justify-center text-center ${view === 'gallery' ? 'text-white' : 'text-white/45'}`}
        >Composants</span>
      </button>

      <div className="flex-1 min-w-2" />

      {view === 'rigging' && (
        <>
          <div className={CLUSTER}>
            <span className="font-mono text-[10px] uppercase tracking-wider text-white/40 px-1">Slots</span>
            <button
              onClick={onRemoveLastSlot}
              disabled={slots.length <= 1}
              className={`${PILL_ICON} disabled:opacity-25 disabled:cursor-not-allowed`}
              title="Retirer un slot"
            >−</button>
            <span className="font-mono text-[13px] tabular-nums w-6 text-center text-white">{slots.length}</span>
            <button
              onClick={onAddSlot}
              disabled={slots.length >= 12}
              className={`${PILL_ICON} disabled:opacity-25 disabled:cursor-not-allowed`}
              title="Ajouter un slot"
            >+</button>
          </div>

          <div className={CLUSTER}>
            <span className="font-mono text-[10px] uppercase tracking-wider text-white/40 px-1">Layout</span>
            <select
              value={layout}
              onChange={(e) => setLayout(e.target.value as Layout)}
              className={SELECT_CLS}
            >
              <option value="auto">auto</option>
              <option value="cols2">2 col</option>
              <option value="cols3">3 col</option>
              <option value="cols4">4 col</option>
            </select>
          </div>

          <div className={CLUSTER}>
            <span className="font-mono text-[10px] uppercase tracking-wider text-white/40 px-1">Zoom</span>
            <button
              onClick={() => setZoom((z) => Math.max(0.3, +(z - 0.05).toFixed(2)))}
              disabled={zoom <= 0.3}
              className={`${PILL_ICON} disabled:opacity-25 disabled:cursor-not-allowed`}
              title="Zoom −"
            >−</button>
            <input
              type="range"
              min={0.3} max={1} step={0.05}
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-24 accent-amber-400"
            />
            <button
              onClick={() => setZoom((z) => Math.min(1, +(z + 0.05).toFixed(2)))}
              disabled={zoom >= 1}
              className={`${PILL_ICON} disabled:opacity-25 disabled:cursor-not-allowed`}
              title="Zoom +"
            >+</button>
            <span className="font-mono text-[11px] tabular-nums w-9 text-center text-white/80">{Math.round(zoom * 100)}%</span>
          </div>

          <div className={CLUSTER}>
            <button
              type="button"
              onClick={() => setDebugTimers((v) => !v)}
              className={`${PILL_ICON} ${debugTimers ? '!bg-amber-300/15 !border-amber-300/50 !text-amber-100' : ''}`}
              title={debugTimers ? 'Slow timers ACTIFS (1h) - clic pour normal' : 'Timers normaux - clic pour passer en 1h'}
            >⏱</button>
            <button
              onClick={onToggleAllBots}
              className={`${PILL_ICON} ${allBots ? '!bg-violet-400/20 !border-violet-300/60 !text-violet-100 shadow-[0_0_10px_rgba(167,139,250,0.25)]' : ''}`}
              title={allBots ? 'Tous les slots sont des bots - clic pour tout désactiver' : 'Activer le mode bot sur tous les slots'}
            >🤖</button>
          </div>

          <div
            className={CLUSTER}
            title="Limit Breaker - spamme l'action courante de chaque iframe N fois, sans dedupe. Teste rate-limit & idempotence backend."
          >
            <input
              type="number"
              min={1}
              max={200}
              value={burstCount}
              onChange={(e) => setBurstCount(Math.max(1, Math.min(200, parseInt(e.target.value, 10) || 1)))}
              disabled={!running}
              className={`${SELECT_CLS} w-14 tabular-nums disabled:opacity-25 disabled:cursor-not-allowed`}
              title="Nombre d'émissions par iframe"
            />
            <button
              onClick={onTriggerStress}
              disabled={!running}
              className={`${PILL_BTN} !bg-red-500/15 !border-red-400/40 !text-red-200 hover:!bg-red-500/25 hover:!border-red-400/70 disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:!bg-red-500/15 disabled:hover:!border-red-400/40`}
              title={running ? `Émet ${burstCount}× l'action de phase courante depuis chaque iframe` : 'Lance la session pour activer'}
            >Break</button>
          </div>

          <div className="flex items-center gap-1.5 justify-end">
            <button
              onClick={onReloadAll}
              className={`${PILL_BTN} transition-opacity ${running ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              title="Recharger toutes les frames"
              aria-hidden={!running}
              tabIndex={running ? 0 : -1}
            >↻ Reload</button>
            {!running ? (
              <button
                onClick={onStart}
                className="relative min-w-[110px] px-5 py-1.5 rounded-md font-mono text-[11px] font-bold uppercase tracking-wider bg-gradient-to-br from-amber-300 to-amber-500 text-black shadow-[0_2px_0_0_rgba(0,0,0,0.4),0_0_20px_rgba(251,191,36,0.35)] hover:shadow-[0_2px_0_0_rgba(0,0,0,0.4),0_0_28px_rgba(251,191,36,0.55)] hover:-translate-y-px active:translate-y-0 transition-all"
              >
                ▶ Lancer
              </button>
            ) : (
              <button
                onClick={onReset}
                className="relative min-w-[110px] px-5 py-1.5 rounded-md font-mono text-[11px] font-bold uppercase tracking-wider bg-gradient-to-br from-red-400 to-red-600 text-white shadow-[0_2px_0_0_rgba(0,0,0,0.4),0_0_20px_rgba(248,113,113,0.35)] hover:shadow-[0_2px_0_0_rgba(0,0,0,0.4),0_0_28px_rgba(248,113,113,0.55)] hover:-translate-y-px active:translate-y-0 transition-all"
              >
                ✕ Reset
              </button>
            )}
          </div>
        </>
      )}
    </div>

    {view === 'rigging' && !running && (
      <div className="px-4 pb-2.5 -mt-1">
        <p className="font-mono text-[11px] text-white/35 tracking-wide">
          <span className="text-amber-300/70">→</span> Configure les slots ci-dessous, puis <span className="text-amber-200">▶ Lancer</span>. Le slot 1 crée le lobby, les autres rejoignent automatiquement.
        </p>
      </div>
    )}
  </div>
);
