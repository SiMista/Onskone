import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AVATARS } from '../constants/game';
import { purgeStudioSlot } from '../utils/studioStorage';
import {
  Layout, SlotConfig, SlotRuntimeState,
  FUN_NAMES, loadSavedConfig, makeSlot,
} from './studio/shared';
import { Toolbar } from './studio/Toolbar';
import { SlotCard } from './studio/SlotCard';
import { Gallery } from './studio/Gallery';

// =====================================================================
// Studio - multi-iframe local test harness (DEV only)
// =====================================================================

const Studio = () => {
  const saved = useMemo(loadSavedConfig, []);

  useEffect(() => {
    const prev = document.title;
    document.title = 'Onskoné - Studio';
    return () => { document.title = prev; };
  }, []);

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
  const [burstCount, setBurstCount] = useState<number>(10);

  const iframeRefs = useRef<Record<string, HTMLIFrameElement | null>>({});

  useEffect(() => {
    try {
      localStorage.setItem('onskone:studio:config:v3', JSON.stringify({ slots, layout, zoom, debugTimers }));
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
  const removeLastSlot = () => removeSlot(slots[slots.length - 1].id);
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
  const allBots = slots.length > 0 && slots.every((s) => s.bot);
  const toggleAllBots = () => {
    const next = !allBots;
    setSlots((s) => {
      const updated = s.map((x) => ({ ...x, bot: next }));
      if (running) {
        updated.forEach((slot) => {
          const frame = iframeRefs.current[slot.id];
          try {
            frame?.contentWindow?.postMessage(
              { type: 'studio:setBot', enabled: next },
              '*'
            );
          } catch { /* silent */ }
        });
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
  const triggerStress = (target?: string) => {
    if (!running) return;
    const send = (frame: HTMLIFrameElement | null | undefined) => {
      try {
        frame?.contentWindow?.postMessage(
          { type: 'studio:stress', count: burstCount },
          '*'
        );
      } catch { /* silent */ }
    };
    if (target) send(iframeRefs.current[target]);
    else slots.forEach((s) => send(iframeRefs.current[s.id]));
  };
  const reloadSlot = (id: string) =>
    setSlotReloadKeys((m) => ({ ...m, [id]: (m[id] ?? 0) + 1 }));

  const buildSlotUrl = useCallback(
    (slot: SlotConfig, index: number, code: string | null, isRunning: boolean): string | null => {
      const base = window.location.origin;
      const params = new URLSearchParams();
      // Slot index FIRST - read at module-load time inside the iframe to
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

      <Toolbar
        view={view}
        setView={setView}
        slots={slots}
        layout={layout}
        setLayout={setLayout}
        zoom={zoom}
        setZoom={setZoom}
        debugTimers={debugTimers}
        setDebugTimers={setDebugTimers}
        running={running}
        allBots={allBots}
        burstCount={burstCount}
        setBurstCount={setBurstCount}
        onAddSlot={addSlot}
        onRemoveLastSlot={removeLastSlot}
        onToggleAllBots={toggleAllBots}
        onResetToDefaults={resetToDefaults}
        onReloadAll={reloadAll}
        onStart={start}
        onReset={reset}
        onTriggerStress={() => triggerStress()}
      />

      {view === 'gallery' && <Gallery />}

      {view === 'rigging' && (
        <div
          className="relative p-4 grid gap-4"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {slots.map((slot, index) => (
            <SlotCard
              key={slot.id}
              slot={slot}
              index={index}
              zoom={zoom}
              url={buildSlotUrl(slot, index, lobbyCode, running)}
              state={slotStates[index]}
              running={running}
              lobbyCode={lobbyCode}
              reloadKey={reloadKey}
              slotReloadKey={slotReloadKeys[slot.id] ?? 0}
              iframeRef={(el) => { iframeRefs.current[slot.id] = el; }}
              onCycleAvatar={cycleAvatar}
              onUpdateSlot={updateSlot}
              onToggleBot={toggleBot}
              onReloadSlot={reloadSlot}
              onRemoveSlot={removeSlot}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Studio;
