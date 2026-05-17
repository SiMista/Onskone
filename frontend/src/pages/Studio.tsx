import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AVATARS, getAvatarUrl } from '../constants/game';
import { purgeStudioSlot } from '../utils/studioStorage';
import StudioGallery from './StudioGallery';

// =====================================================================
// Studio - multi-iframe local test harness (DEV only)
// =====================================================================

type Orientation = 'portrait' | 'landscape';
type Layout = 'auto' | 'cols2' | 'cols3' | 'cols4';

interface ViewportPreset {
  id: string;
  label: string;
  short: string;
  w: number;
  h: number;
}

const VIEWPORT_PRESETS: ViewportPreset[] = [
  { id: 'iphone-se', label: 'iPhone SE — 375×667', short: 'SE', w: 375, h: 667 },
  { id: 'iphone-14', label: 'iPhone 14 — 390×844', short: 'iP14', w: 390, h: 844 },
  { id: 'iphone-pm', label: 'iPhone Pro Max — 430×932', short: 'iPM', w: 430, h: 932 },
  { id: 'galaxy', label: 'Galaxy S22 — 360×800', short: 'GS22', w: 360, h: 800 },
  { id: 'pixel', label: 'Pixel 7 — 412×915', short: 'Px7', w: 412, h: 915 },
  { id: 'ipad', label: 'iPad — 820×1180', short: 'iPad', w: 820, h: 1180 },
  { id: 'ipad-pro', label: 'iPad Pro — 1024×1366', short: 'iPadP', w: 1024, h: 1366 },
  { id: 'desktop-sm', label: 'Laptop — 1280×800', short: 'LT', w: 1280, h: 800 },
  { id: 'desktop-lg', label: 'Desktop — 1536×960', short: 'DT', w: 1536, h: 960 },
  { id: 'free', label: 'Libre — 480×720', short: 'Free', w: 480, h: 720 },
];

const presetById = (id: string): ViewportPreset =>
  VIEWPORT_PRESETS.find((p) => p.id === id) ?? VIEWPORT_PRESETS[1];

interface SlotConfig {
  id: string;
  name: string;
  avatarId: number;
  viewportId: string;
  orientation: Orientation;
  bot: boolean;
}

interface SlotRuntimeState {
  isLeader: boolean;
  isSubstitute: boolean;
  phase: string | null;
  playerName: string | null;
}

const FUN_NAMES = [
  'Alice', 'Bob', 'Charlie', 'Dora', 'Eli', 'Fanny', 'Gus', 'Hugo',
  'Ines', 'Jules', 'Kim', 'Lola', 'Milo', 'Nora', 'Otto', 'Pia',
];

const STORAGE_KEY = 'onskone:studio:config:v3';

const makeSlot = (i: number): SlotConfig => ({
  id: `slot-${i}-${Math.random().toString(36).slice(2, 7)}`,
  name: FUN_NAMES[i % FUN_NAMES.length],
  avatarId: i % AVATARS.length,
  viewportId: 'iphone-14',
  orientation: 'portrait',
  bot: false,
});

const loadSavedConfig = (): {
  slots: SlotConfig[];
  layout: Layout;
  zoom: number;
  debugTimers: boolean;
} | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.slots)) return null;
    parsed.slots = parsed.slots.map((s: Partial<SlotConfig>) => ({
      ...makeSlot(0),
      ...s,
      bot: !!s.bot,
      viewportId: s.viewportId && VIEWPORT_PRESETS.some((p) => p.id === s.viewportId)
        ? s.viewportId
        : 'iphone-14',
    }));
    return parsed;
  } catch { return null; }
};

const viewportDims = (slot: SlotConfig): { w: number; h: number } => {
  const base = presetById(slot.viewportId);
  return slot.orientation === 'landscape'
    ? { w: base.h, h: base.w }
    : { w: base.w, h: base.h };
};

// ---------- Unified control styles ----------
const PILL = 'bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-md transition-colors';
const PILL_ICON = `${PILL} w-7 h-7 flex items-center justify-center text-white/70 hover:text-white text-[13px] leading-none`;
const PILL_BTN = `${PILL} px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider text-white/70 hover:text-white`;
const SELECT_CLS =
  'bg-[#0f1117] text-white/85 border border-white/10 rounded-md px-2 py-1 text-[11px] font-mono ' +
  'focus:outline-none focus:border-amber-400/60 hover:border-white/20 transition-colors ' +
  '[&>option]:bg-[#0f1117] [&>option]:text-white';
const CLUSTER = 'flex items-center gap-1.5 bg-black/30 border border-white/[0.06] rounded-lg px-2 py-1';

const Studio = () => {
  const navigate = useNavigate();
  const saved = useMemo(loadSavedConfig, []);

  const [slots, setSlots] = useState<SlotConfig[]>(
    saved?.slots && saved.slots.length >= 2
      ? saved.slots
      : [makeSlot(0), makeSlot(1), makeSlot(2)]
  );
  const [layout, setLayout] = useState<Layout>(saved?.layout ?? 'cols3');
  const [zoom, setZoom] = useState<number>(saved?.zoom ?? 0.8);
  const [debugTimers, setDebugTimers] = useState<boolean>(saved?.debugTimers ?? true);

  const [view, setView] = useState<'rigging' | 'gallery'>('rigging');
  const [running, setRunning] = useState(false);
  const [lobbyCode, setLobbyCode] = useState<string | null>(null);
  const [slotStates, setSlotStates] = useState<Record<number, SlotRuntimeState>>({});

  const [reloadKey, setReloadKey] = useState(0);
  const [slotReloadKeys, setSlotReloadKeys] = useState<Record<string, number>>({});

  const iframeRefs = useRef<Record<string, HTMLIFrameElement | null>>({});

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ slots, layout, zoom, debugTimers }));
    } catch { /* silent */ }
  }, [slots, layout, zoom, debugTimers]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const data = e?.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'studio:lobbyCreated' && typeof data.lobbyCode === 'string') {
        setLobbyCode(data.lobbyCode);
        return;
      }
      if (data.type === 'studio:state' && typeof data.slot === 'number') {
        const isLeader = !!data.currentPlayerId && data.currentPlayerId === data.leaderId;
        const isSubstitute = !!data.currentPlayerId && data.currentPlayerId === data.substitutePlayerId;
        setSlotStates((prev) => ({
          ...prev,
          [data.slot]: {
            isLeader,
            isSubstitute,
            phase: data.phase ?? null,
            playerName: data.playerName ?? null,
          },
        }));
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const addSlot = () => {
    if (slots.length >= 12) return;
    setSlots((s) => [...s, makeSlot(s.length)]);
  };
  const removeSlot = (id: string) => {
    setSlots((s) => (s.length > 1 ? s.filter((x) => x.id !== id) : s));
  };
  const updateSlot = (id: string, patch: Partial<SlotConfig>) => {
    setSlots((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };
  const cycleAvatar = (id: string, dir: 1 | -1) => {
    setSlots((s) =>
      s.map((x) =>
        x.id === id
          ? { ...x, avatarId: (x.avatarId + dir + AVATARS.length) % AVATARS.length }
          : x
      )
    );
  };
  const toggleBot = (id: string) => {
    setSlots((s) => {
      const updated = s.map((x) => (x.id === id ? { ...x, bot: !x.bot } : x));
      const target = updated.find((x) => x.id === id);
      if (target && running) {
        const frame = iframeRefs.current[id];
        try {
          frame?.contentWindow?.postMessage(
            { type: 'studio:setBot', enabled: target.bot },
            '*'
          );
        } catch { /* silent */ }
      }
      return updated;
    });
  };
  const resetToDefaults = () => {
    if (running) return;
    slots.forEach((_, i) => purgeStudioSlot(i));
    setSlots([makeSlot(0), makeSlot(1), makeSlot(2)]);
    setLayout('cols3');
    setZoom(0.8);
    setDebugTimers(true);
    setSlotStates({});
    setLobbyCode(null);
  };

  const randomizeNames = () => {
    setSlots((s) => s.map((x, i) => ({
      ...x,
      name: FUN_NAMES[(i + Math.floor(Math.random() * FUN_NAMES.length)) % FUN_NAMES.length],
      avatarId: Math.floor(Math.random() * AVATARS.length),
    })));
  };

  const start = () => {
    slots.forEach((_, i) => purgeStudioSlot(i));
    // Garantir l'unicité des pseudos & avatars : deux slots avec le même
    // pseudo seraient interprétés comme une reconnexion par le backend
    // (SocketHandler.joinLobby) et fusionneraient en un seul joueur.
    setSlots((s) => {
      const usedNames = new Set<string>();
      const usedAvatars = new Set<number>();
      return s.map((slot, i) => {
        let name = slot.name?.trim() || FUN_NAMES[i % FUN_NAMES.length];
        if (usedNames.has(name)) {
          const fallback = FUN_NAMES.find((n) => !usedNames.has(n));
          name = fallback ?? `${name}-${i + 1}`;
        }
        usedNames.add(name);

        let avatarId = slot.avatarId;
        if (usedAvatars.has(avatarId)) {
          for (let k = 0; k < AVATARS.length; k++) {
            const candidate = (avatarId + k) % AVATARS.length;
            if (!usedAvatars.has(candidate)) { avatarId = candidate; break; }
          }
        }
        usedAvatars.add(avatarId);

        return name === slot.name && avatarId === slot.avatarId
          ? slot
          : { ...slot, name, avatarId };
      });
    });
    setSlotStates({});
    setLobbyCode(null);
    setReloadKey((k) => k + 1);
    setRunning(true);
  };
  const reset = () => {
    slots.forEach((_, i) => purgeStudioSlot(i));
    setSlotStates({});
    setLobbyCode(null);
    setRunning(false);
    setReloadKey((k) => k + 1);
  };
  const reloadAll = () => setReloadKey((k) => k + 1);
  const reloadSlot = (id: string) =>
    setSlotReloadKeys((m) => ({ ...m, [id]: (m[id] ?? 0) + 1 }));

  const buildSlotUrl = useCallback(
    (slot: SlotConfig, index: number, code: string | null, isRunning: boolean): string | null => {
      const base = window.location.origin;
      const params = new URLSearchParams();
      // Slot index FIRST — read at module-load time inside the iframe to
      // namespace localStorage. window.name on iframes isn't reliably set
      // before src loads, so this URL param is the source of truth for the
      // slot identity (studioStorage.ts captures it at boot).
      params.set('studioSlot', String(index));
      params.set('playerName', slot.name);
      params.set('avatarId', String(slot.avatarId));
      params.set('debug', debugTimers ? '1' : '0');
      if (!isRunning) return `${base}/?${params.toString()}`;
      if (index === 0) {
        params.set('autoCreate', '1');
        return `${base}/?${params.toString()}`;
      }
      if (!code) return null;
      params.set('lobbyCode', code);
      params.set('autoJoin', '1');
      return `${base}/?${params.toString()}`;
    },
    [debugTimers]
  );

  const cols = useMemo(() => {
    if (layout === 'cols2') return 2;
    if (layout === 'cols3') return 3;
    if (layout === 'cols4') return 4;
    if (slots.length <= 2) return 2;
    if (slots.length <= 4) return 2;
    if (slots.length <= 6) return 3;
    return 4;
  }, [layout, slots.length]);

  return (
    <div
      className="min-h-screen text-white relative"
      style={{
        background:
          'radial-gradient(1200px 600px at 20% -10%, rgba(255,199,0,0.06), transparent 60%),' +
          'radial-gradient(900px 500px at 100% 0%, rgba(125,211,240,0.05), transparent 55%),' +
          'linear-gradient(180deg, #0a0c12 0%, #0d1018 100%)',
      }}
    >
      {/* Subtle dot grid backdrop */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            'radial-gradient(rgba(255,255,255,0.35) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          maskImage:
            'radial-gradient(ellipse at top, black 30%, transparent 75%)',
        }}
      />

      {/* ====== Control panel ====== */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-[#0a0c12]/85 border-b border-white/[0.07]">
        <div className="px-4 py-3 flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => navigate('/')}
            className={`${PILL_BTN} !text-white/80`}
            title="Retour à l'accueil"
          >
            ← Retour
          </button>

          <div className="flex items-center gap-2.5 ml-1">
            <span className="font-mono text-[15px] leading-none flex items-baseline gap-1.5 select-none">
              <span className="text-amber-400">▍</span>
              <span className="text-white/55 tracking-tight">onskoné</span>
              <span className="text-white/25">/</span>
              <span className="text-amber-200 font-bold tracking-tight uppercase">studio</span>
            </span>
            <span
              className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-red-200 border border-red-400/50 bg-red-500/[0.08] rounded px-1.5 py-0.5 shadow-[inset_0_0_0_1px_rgba(248,113,113,0.08)]"
              title="Page interne — non destinée à la production"
            >
              ⚠ Dev only
            </span>
          </div>

          {/* View switcher : régie ↔ galerie composants */}
          <div className="ml-2 inline-flex rounded-md border border-white/10 bg-black/30 p-0.5 font-mono text-[11px] uppercase tracking-wider">
            <button
              onClick={() => setView('rigging')}
              className={`px-2.5 py-1 rounded transition-colors ${view === 'rigging'
                ? 'bg-white/[0.08] text-white'
                : 'text-white/45 hover:text-white/80'
                }`}
            >Régie</button>
            <button
              onClick={() => setView('gallery')}
              className={`px-2.5 py-1 rounded transition-colors ${view === 'gallery'
                ? 'bg-white/[0.08] text-white'
                : 'text-white/45 hover:text-white/80'
                }`}
            >Composants</button>
          </div>

          <div className="flex-1 min-w-4" />

          {view === 'rigging' && (
          <>
          {/* Cluster: slots */}
          <div className={CLUSTER}>
            <span className="font-mono text-[10px] uppercase tracking-wider text-white/40 px-1">Slots</span>
            <button
              onClick={() => removeSlot(slots[slots.length - 1].id)}
              disabled={slots.length <= 1}
              className={`${PILL_ICON} disabled:opacity-25 disabled:cursor-not-allowed`}
              title="Retirer un slot"
            >−</button>
            <span className="font-mono text-[13px] tabular-nums w-6 text-center text-white">{slots.length}</span>
            <button
              onClick={addSlot}
              disabled={slots.length >= 12}
              className={`${PILL_ICON} disabled:opacity-25 disabled:cursor-not-allowed`}
              title="Ajouter un slot"
            >+</button>
          </div>

          {/* Cluster: layout */}
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

          {/* Cluster: zoom */}
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

          {/* Cluster: toggles */}
          <div className={CLUSTER}>
            <label
              className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] font-mono uppercase tracking-wider text-white/70 hover:text-white px-1"
              title="Timers 1h pour bosser sans pression"
            >
              <input
                type="checkbox"
                checked={debugTimers}
                onChange={(e) => setDebugTimers(e.target.checked)}
                className="accent-amber-400"
              />
              <span>Slow timers</span>
            </label>
            <button
              onClick={randomizeNames}
              className={PILL_BTN}
              title="Pseudos & avatars aléatoires"
            >🎲 Random</button>
            <button
              onClick={resetToDefaults}
              disabled={running}
              className={`${PILL_BTN} disabled:opacity-25 disabled:cursor-not-allowed`}
              title="Remettre les valeurs studio par défaut (3 slots, layout 3-col, zoom 80%, slow timers)"
            >⟲ Défaut</button>
          </div>

          {/* Lobby code chip - slot réservé pour éviter le shift quand le code arrive */}
          <div className="min-w-[140px] flex justify-end">
            {lobbyCode && (
              <button
                onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/?lobbyCode=${lobbyCode}`)}
                className="group flex items-center gap-2 bg-gradient-to-br from-amber-400/15 to-amber-500/10 border border-amber-300/40 hover:border-amber-300/80 rounded-md px-2.5 py-1 transition-all"
                title="Copier le lien d'invitation"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)] animate-pulse" />
                <span className="font-mono text-[10px] uppercase tracking-wider text-amber-200/70">Lobby</span>
                <span className="font-mono text-[12px] font-bold tracking-widest text-amber-100">{lobbyCode}</span>
                <span className="text-amber-300/60 group-hover:text-amber-200 text-xs">⧉</span>
              </button>
            )}
          </div>

          {/* Main action - fixed-width zone for stable layout (no shift between idle/running) */}
          <div className="flex items-center gap-1.5 justify-end">
            <button
              onClick={reloadAll}
              className={`${PILL_BTN} transition-opacity ${running ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              title="Recharger toutes les frames"
              aria-hidden={!running}
              tabIndex={running ? 0 : -1}
            >↻ Reload</button>
            {!running ? (
              <button
                onClick={start}
                className="relative min-w-[110px] px-5 py-1.5 rounded-md font-mono text-[11px] font-bold uppercase tracking-wider bg-gradient-to-br from-amber-300 to-amber-500 text-black shadow-[0_2px_0_0_rgba(0,0,0,0.4),0_0_20px_rgba(251,191,36,0.35)] hover:shadow-[0_2px_0_0_rgba(0,0,0,0.4),0_0_28px_rgba(251,191,36,0.55)] hover:-translate-y-px active:translate-y-0 transition-all"
              >
                ▶ Lancer
              </button>
            ) : (
              <button
                onClick={reset}
                className="min-w-[110px] px-3 py-1.5 rounded-md text-[11px] font-mono font-bold uppercase tracking-wider bg-red-500/15 hover:bg-red-500/25 border border-red-400/30 hover:border-red-400/60 text-red-200 transition-colors"
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

      {view === 'gallery' && <StudioGallery />}

      {/* ====== Slot grid ====== */}
      {view === 'rigging' && (
      <div
        className="relative p-4 grid gap-4"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {slots.map((slot, index) => {
          const dims = viewportDims(slot);
          const slotKey = `${slot.id}-${reloadKey}-${slotReloadKeys[slot.id] ?? 0}`;
          const url = buildSlotUrl(slot, index, lobbyCode, running);
          const state = slotStates[index];
          const isPilier = !!state?.isLeader;
          const isSubstitute = !!state?.isSubstitute && !isPilier;
          const preset = presetById(slot.viewportId);

          const phaseLabel = !running
            ? 'idle'
            : index === 0 && !lobbyCode
              ? 'creating'
              : !url
                ? 'waiting'
                : state?.phase
                  ? state.phase.toLowerCase()
                  : 'joining';

          return (
            <div
              key={slot.id}
              className={`relative rounded-xl overflow-hidden flex flex-col transition-all duration-300
                bg-gradient-to-b from-white/[0.03] to-white/[0.01]
                ${isPilier
                  ? 'border border-amber-300/60 shadow-[0_0_0_1px_rgba(251,191,36,0.25),0_0_28px_rgba(251,191,36,0.18)]'
                  : isSubstitute
                    ? 'border border-sky-300/50 shadow-[0_0_0_1px_rgba(125,211,240,0.2),0_0_22px_rgba(125,211,240,0.14)]'
                    : 'border border-white/[0.08]'
                }`}
            >
              {/* Slot header */}
              <div className="flex items-center gap-1.5 px-2.5 py-2 bg-black/40 border-b border-white/[0.06]">
                <span className="font-mono text-[10px] tracking-widest text-white/30 w-6 text-center">
                  {String(index + 1).padStart(2, '0')}
                </span>

                <button
                  onClick={() => cycleAvatar(slot.id, 1)}
                  onContextMenu={(e) => { e.preventDefault(); cycleAvatar(slot.id, -1); }}
                  className="flex-shrink-0 w-7 h-7 rounded-full overflow-hidden border border-white/15 hover:border-amber-300/60 bg-white/5 transition-colors"
                  title={`Avatar #${slot.avatarId} — clic suivant, clic droit précédent`}
                >
                  <img
                    src={getAvatarUrl(slot.avatarId)}
                    alt={`avatar ${slot.avatarId}`}
                    className="w-full h-full object-cover"
                  />
                </button>

                <input
                  value={slot.name}
                  onChange={(e) => updateSlot(slot.id, { name: e.target.value })}
                  className="flex-1 min-w-0 bg-white/[0.03] border border-white/[0.08] focus:border-amber-300/50 focus:bg-white/[0.06] rounded-md px-2 py-1 text-[12px] text-white placeholder-white/30 focus:outline-none transition-colors"
                  placeholder="Pseudo"
                />

                {isPilier && (
                  <span className="px-1.5 py-0.5 rounded-md bg-amber-400/15 border border-amber-300/50 text-amber-100 font-mono text-[10px] uppercase tracking-wider whitespace-nowrap">
                    👑 Pilier
                  </span>
                )}
                {isSubstitute && (
                  <span className="px-1.5 py-0.5 rounded-md bg-sky-400/15 border border-sky-300/50 text-sky-100 font-mono text-[10px] uppercase tracking-wider whitespace-nowrap">
                    🎤 Subs
                  </span>
                )}

                <select
                  value={slot.viewportId}
                  onChange={(e) => updateSlot(slot.id, { viewportId: e.target.value })}
                  className={SELECT_CLS}
                  title="Format d'écran"
                >
                  {VIEWPORT_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>

                <button
                  onClick={() => updateSlot(slot.id, {
                    orientation: slot.orientation === 'portrait' ? 'landscape' : 'portrait',
                  })}
                  className={PILL_ICON}
                  title="Pivoter portrait ↔ paysage"
                >
                  {slot.orientation === 'portrait' ? '⇋' : '⇵'}
                </button>

                <button
                  onClick={() => toggleBot(slot.id)}
                  className={`w-7 h-7 rounded-md border flex items-center justify-center text-[13px] transition-all ${slot.bot
                    ? 'bg-violet-400/20 border-violet-300/60 text-violet-100 shadow-[0_0_10px_rgba(167,139,250,0.25)]'
                    : 'bg-white/[0.04] border-white/10 text-white/50 hover:text-white/80 hover:border-white/20'
                    }`}
                  title={slot.bot ? 'Bot ACTIF — clic pour désactiver' : 'Activer mode bot auto-réponse'}
                >🤖</button>

                <button
                  onClick={() => reloadSlot(slot.id)}
                  className={PILL_ICON}
                  title="Recharger ce slot"
                >↻</button>

                <button
                  onClick={() => {
                    if (!url) return;
                    const { w, h } = dims;
                    window.open(
                      url,
                      `studio-popout-${slot.id}`,
                      `width=${Math.min(w + 40, 1400)},height=${Math.min(h + 80, 1000)},menubar=no,toolbar=no`
                    );
                  }}
                  className={`${PILL_ICON} disabled:opacity-25 disabled:cursor-not-allowed`}
                  title="Ouvrir dans une vraie fenêtre"
                  disabled={!url}
                >⇗</button>

                <button
                  onClick={() => removeSlot(slot.id)}
                  className="w-7 h-7 rounded-md border border-red-400/20 bg-red-500/10 hover:bg-red-500/25 hover:border-red-400/50 text-red-200 flex items-center justify-center text-[13px] transition-colors"
                  title="Supprimer ce slot"
                >✕</button>
              </div>

              {/* Iframe wrapper */}
              <div
                className="relative flex justify-center items-start bg-black/40 p-2 overflow-auto"
                style={{ height: dims.h * zoom + 24 }}
              >
                {/* Corner crosshairs */}
                <div aria-hidden className="pointer-events-none absolute inset-2 opacity-40">
                  <span className="absolute top-0 left-0 w-2 h-px bg-white/30" />
                  <span className="absolute top-0 left-0 w-px h-2 bg-white/30" />
                  <span className="absolute top-0 right-0 w-2 h-px bg-white/30" />
                  <span className="absolute top-0 right-0 w-px h-2 bg-white/30" />
                  <span className="absolute bottom-0 left-0 w-2 h-px bg-white/30" />
                  <span className="absolute bottom-0 left-0 w-px h-2 bg-white/30" />
                  <span className="absolute bottom-0 right-0 w-2 h-px bg-white/30" />
                  <span className="absolute bottom-0 right-0 w-px h-2 bg-white/30" />
                </div>

                <div
                  style={{
                    width: dims.w,
                    height: dims.h,
                    transform: `scale(${zoom})`,
                    transformOrigin: 'top center',
                    flexShrink: 0,
                  }}
                >
                  {url ? (
                    <iframe
                      key={slotKey}
                      ref={(el) => { iframeRefs.current[slot.id] = el; }}
                      name={`studio-slot-${index}`}
                      src={url}
                      title={`Studio slot ${index + 1} - ${slot.name}`}
                      onLoad={() => {
                        try {
                          iframeRefs.current[slot.id]?.contentWindow?.postMessage(
                            { type: 'studio:setBot', enabled: slot.bot },
                            '*'
                          );
                        } catch { /* silent */ }
                      }}
                      style={{
                        width: dims.w,
                        height: dims.h,
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 10,
                        background: 'white',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                      }}
                    />
                  ) : (
                    <div
                      style={{ width: dims.w, height: dims.h }}
                      className="flex flex-col items-center justify-center gap-3 text-white/30 border border-dashed border-white/10 rounded-lg bg-black/30"
                    >
                      <span className="w-2 h-2 rounded-full bg-amber-400/60 animate-pulse" />
                      <span className="font-mono text-[11px] uppercase tracking-[0.3em]">en attente du lobby</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer status bar */}
              <div className="flex items-center gap-3 px-3 py-1.5 bg-black/50 border-t border-white/[0.05] font-mono text-[10px] text-white/40 truncate" title={url ?? 'idle'}>
                <span className="flex items-center gap-1">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${phaseLabel === 'idle' ? 'bg-white/30'
                      : phaseLabel === 'creating' || phaseLabel === 'joining' || phaseLabel === 'waiting' ? 'bg-amber-400 animate-pulse'
                        : 'bg-emerald-400'
                      }`}
                  />
                  <span className="uppercase tracking-wider text-white/60">{phaseLabel}</span>
                </span>
                <span className="text-white/15">·</span>
                <span>{preset.short}</span>
                <span className="text-white/15">·</span>
                <span>{dims.w}×{dims.h}</span>
                <span className="text-white/15">·</span>
                <span>slot{index}</span>
                {slot.bot && (
                  <>
                    <span className="text-white/15">·</span>
                    <span className="text-violet-300">🤖 bot</span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
};

export default Studio;
