import { GameMode } from '@onskone/shared';
import { Layout, SlotConfig, SELECT_CLS } from './shared';

// Variants compacts (locaux) pour la Toolbar, sans toucher au CLUSTER/PILL_*
// utilisés ailleurs.
const COMPACT_PILL = 'bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-md transition-colors';
const COMPACT_ICON = `${COMPACT_PILL} w-6 h-6 flex items-center justify-center text-white/70 hover:text-white text-[12px] leading-none`;
const COMPACT_BTN = `${COMPACT_PILL} px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-white/70 hover:text-white`;
const COMPACT_CLUSTER = 'flex items-center gap-1 bg-black/30 border border-white/[0.06] rounded-lg px-1.5 py-1';

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
  gameMode: GameMode;
  setGameMode: (m: GameMode) => void;
  running: boolean;
  allBots: boolean;
  burstCount: number;
  setBurstCount: (n: number) => void;
  limitBreaker: boolean;
  onToggleLimitBreaker: () => void;
  onAddSlot: () => void;
  onRemoveLastSlot: () => void;
  onToggleAllBots: () => void;
  onReloadAll: () => void;
  onStart: () => void;
  onReset: () => void;
}

export const Toolbar = ({
  view, setView,
  slots, layout, setLayout, zoom, setZoom, debugTimers, setDebugTimers,
  gameMode, setGameMode,
  running, allBots, burstCount, setBurstCount,
  limitBreaker, onToggleLimitBreaker,
  onAddSlot, onRemoveLastSlot, onToggleAllBots,
  onReloadAll, onStart, onReset,
}: ToolbarProps) => (
  <div className="sticky top-0 z-30 backdrop-blur-xl bg-[#0a0c12]/85 border-b border-white/[0.07]">
    <div className="px-3 py-2 flex flex-wrap items-center gap-1.5">
      <div className="flex items-center gap-2 ml-0.5">
        <span className="font-mono text-[13px] leading-none flex items-baseline gap-1 select-none">
          <span className="text-amber-400">▍</span>
          <span className="text-white/55 tracking-tight">onskoné</span>
          <span className="text-white/25">/</span>
          <span className="text-amber-200 font-bold tracking-tight uppercase">studio</span>
        </span>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={view === 'gallery'}
        aria-label="Basculer entre Régie et Composants"
        onClick={() => setView(view === 'rigging' ? 'gallery' : 'rigging')}
        className="ml-1 relative grid grid-cols-2 rounded-md border border-white/10 bg-black/30 p-0.5 font-mono text-[10px] uppercase tracking-wider select-none cursor-pointer overflow-hidden hover:border-white/20 transition-colors"
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
          className={`pointer-events-none relative z-10 px-2 py-0.5 rounded transition-colors flex items-center justify-center text-center ${view === 'rigging' ? 'text-white' : 'text-white/45'}`}
        >Régie</span>
        <span
          className={`pointer-events-none relative z-10 px-2 py-0.5 rounded transition-colors flex items-center justify-center text-center ${view === 'gallery' ? 'text-white' : 'text-white/45'}`}
        >Compos.</span>
      </button>

      <div className="flex-1 min-w-2" />

      {view === 'rigging' && (
        <>
          <div className={COMPACT_CLUSTER} title="Slots">
            <button
              onClick={onRemoveLastSlot}
              disabled={slots.length <= 1}
              className={`${COMPACT_ICON} disabled:opacity-25 disabled:cursor-not-allowed`}
              title="Retirer un slot"
            >−</button>
            <span className="font-mono text-[12px] tabular-nums w-5 text-center text-white">{slots.length}</span>
            <button
              onClick={onAddSlot}
              disabled={slots.length >= 12}
              className={`${COMPACT_ICON} disabled:opacity-25 disabled:cursor-not-allowed`}
              title="Ajouter un slot"
            >+</button>
          </div>

          <div className={COMPACT_CLUSTER} title="Layout">
            <select
              value={layout}
              onChange={(e) => setLayout(e.target.value as Layout)}
              className={`${SELECT_CLS} !px-1.5 !py-0.5 !text-[10px]`}
            >
              <option value="auto">auto</option>
              <option value="cols2">2 col</option>
              <option value="cols3">3 col</option>
              <option value="cols4">4 col</option>
            </select>
          </div>

          <div className={COMPACT_CLUSTER} title="Zoom">
            <input
              type="range"
              min={0.3} max={1} step={0.05}
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-16 accent-amber-400"
            />
            <span className="font-mono text-[10px] tabular-nums w-8 text-center text-white/80">{Math.round(zoom * 100)}%</span>
          </div>

          <div className={COMPACT_CLUSTER}>
            <button
              type="button"
              onClick={() => setDebugTimers((v) => !v)}
              className={`${COMPACT_ICON} ${debugTimers ? '!bg-amber-300/15 !border-amber-300/50 !text-amber-100' : ''}`}
              title={debugTimers ? 'Slow timers ACTIFS (1h) - clic pour normal' : 'Timers normaux - clic pour passer en 1h'}
            >⏱</button>
            <button
              onClick={onToggleAllBots}
              className={`${COMPACT_ICON} ${allBots ? '!bg-violet-400/20 !border-violet-300/60 !text-violet-100 shadow-[0_0_10px_rgba(167,139,250,0.25)]' : ''}`}
              title={allBots ? 'Tous les slots sont des bots - clic pour tout désactiver' : 'Activer le mode bot sur tous les slots'}
            >🤖</button>
          </div>

          <div
            className={COMPACT_CLUSTER}
            title="Limit Breakers - à chaque phase, chaque iframe émet son action N fois en rafale."
          >
            <input
              type="number"
              min={1}
              max={200}
              value={burstCount}
              onChange={(e) => setBurstCount(Math.max(1, Math.min(200, parseInt(e.target.value, 10) || 1)))}
              disabled={!running}
              className={`${SELECT_CLS} !px-1 !py-0.5 !text-[10px] w-10 tabular-nums disabled:opacity-25 disabled:cursor-not-allowed`}
              title="Nombre d'émissions par phase et par iframe"
            />
            <button
              type="button"
              role="switch"
              aria-checked={limitBreaker}
              onClick={onToggleLimitBreaker}
              disabled={!running}
              className={`${COMPACT_BTN} disabled:opacity-25 disabled:cursor-not-allowed ${limitBreaker
                ? '!bg-red-500/20 !border-red-400/60 !text-red-100 shadow-[0_0_10px_rgba(248,113,113,0.25)]'
                : '!bg-red-500/[0.06] !border-red-400/25 !text-red-200/80 hover:!bg-red-500/15 hover:!border-red-400/50'
                }`}
              title={running
                ? limitBreaker
                  ? `Mode ON - burst ${burstCount}× à chaque phase. Clic pour stopper.`
                  : `Activer le mode : burst ${burstCount}× à chaque phase.`
                : 'Lance la session pour activer'}
            >{limitBreaker ? '● ON' : 'Break'}</button>
          </div>

          <div className="flex items-center gap-1 justify-end">
            <button
              onClick={onReloadAll}
              className={`${COMPACT_BTN} transition-opacity ${running ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              title="Recharger toutes les frames"
              aria-hidden={!running}
              tabIndex={running ? 0 : -1}
            >↻</button>
            {!running ? (
              <>
                <button
                  type="button"
                  onClick={() => setGameMode(gameMode === 'local' ? 'remote' : 'local')}
                  className={`${COMPACT_BTN} min-w-[68px] ${gameMode === 'local'
                    ? '!bg-amber-300/15 !border-amber-300/50 !text-amber-100'
                    : '!bg-sky-400/15 !border-sky-300/50 !text-sky-100'
                  }`}
                  title={gameMode === 'local'
                    ? 'Mode SUR PLACE - clic pour basculer en À DISTANCE'
                    : 'Mode À DISTANCE - clic pour basculer en SUR PLACE'}
                >
                  {gameMode === 'local' ? '👥 Local' : '🌍 Remote'}
                </button>
                <button
                  onClick={onStart}
                  className="relative min-w-[80px] px-3 py-1 rounded-md font-mono text-[10px] font-bold uppercase tracking-wider bg-gradient-to-br from-amber-300 to-amber-500 text-black shadow-[0_2px_0_0_rgba(0,0,0,0.4),0_0_20px_rgba(251,191,36,0.35)] hover:shadow-[0_2px_0_0_rgba(0,0,0,0.4),0_0_28px_rgba(251,191,36,0.55)] hover:-translate-y-px active:translate-y-0 transition-all"
                >
                  ▶ Lancer
                </button>
              </>
            ) : (
              <button
                onClick={onReset}
                className="relative min-w-[80px] px-3 py-1 rounded-md font-mono text-[10px] font-bold uppercase tracking-wider bg-gradient-to-br from-red-400 to-red-600 text-white shadow-[0_2px_0_0_rgba(0,0,0,0.4),0_0_20px_rgba(248,113,113,0.35)] hover:shadow-[0_2px_0_0_rgba(0,0,0,0.4),0_0_28px_rgba(248,113,113,0.55)] hover:-translate-y-px active:translate-y-0 transition-all"
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
