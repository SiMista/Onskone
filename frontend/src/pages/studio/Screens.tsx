import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameMode } from '@onskone/shared';
import { VIEWPORT_PRESETS, presetById, type Orientation } from './shared';
import {
  SCREEN_SCENARIOS, TABLE_VIEWER, applyScreenEmit, getScenario, scenarioViewers,
  type RevealScreenState, type ScreenScenario,
} from './screens/scenarios';

// =====================================================================
// Onglet « Écrans » du Studio (DEV) : aperçu des écrans spéciaux sans rejouer de
// partie. On choisit un scénario (seul lui est chargé), on le regarde sur un ou
// plusieurs téléphones (iframes /studio/screen, vrai rendu du jeu), et le Studio
// joue le faux serveur : les actions d'un téléphone (Révéler, Oui/Non, Suivant)
// mettent à jour la table de tous les téléphones. Aucun backend nécessaire.
// =====================================================================

const STORAGE_KEY = 'onskone_studio_screens';
const PHONE_PRESETS = VIEWPORT_PRESETS.filter((p) => p.id !== 'free' && !p.id.startsWith('desktop'));
const ZOOMS = [0.5, 0.65, 0.8, 1];

const PILL = 'border border-white/10 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors';
const pill = (active: boolean) =>
  `${PILL} ${active ? 'bg-amber-300/15 border-amber-300/40 text-amber-200' : 'bg-white/[0.04] text-white/60 hover:text-white hover:bg-white/[0.08]'}`;

interface LogLine {
  id: number;
  at: string;
  who: string;
  event: string;
  payload: string;
  note: string;
}

const loadSaved = (): { scenarioId?: string; presetId?: string; orientation?: Orientation } => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'); } catch { return {}; }
};

export const Screens = () => {
  const saved = useMemo(loadSaved, []);
  const [scenarioId, setScenarioId] = useState(() => getScenario(saved.scenarioId ?? null).id);
  const [presetId, setPresetId] = useState(saved.presetId ?? 'iphone-17');
  const [orientation, setOrientation] = useState<Orientation>(saved.orientation ?? 'portrait');
  // Rejouer = remonter la scène : table, journal et téléphones repartent de zéro.
  const [replayKey, setReplayKey] = useState(0);
  const scenario = getScenario(scenarioId);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ scenarioId, presetId, orientation })); } catch { /* silent */ }
  }, [scenarioId, presetId, orientation]);

  const groups = useMemo(() => {
    const byGroup = new Map<string, ScreenScenario[]>();
    SCREEN_SCENARIOS.forEach((s) => byGroup.set(s.group, [...(byGroup.get(s.group) ?? []), s]));
    return [...byGroup.entries()];
  }, []);

  return (
    <div className="p-4 flex gap-4 items-start">
      <nav className="w-64 shrink-0 flex flex-col gap-4 sticky top-16">
        {groups.map(([group, list]) => (
          <div key={group} className="flex flex-col gap-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/35 px-1">{group}</p>
            {list.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => { setScenarioId(s.id); setReplayKey((k) => k + 1); }}
                className={`text-left rounded-md px-2.5 py-1.5 text-[13px] transition-colors border ${s.id === scenarioId
                  ? 'bg-amber-300/10 border-amber-300/30 text-amber-100'
                  : 'border-transparent text-white/70 hover:text-white hover:bg-white/[0.05]'}`}
              >
                {s.title}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <ScreenStage
        key={`${scenario.id}-${replayKey}`}
        scenario={scenario}
        presetId={presetId}
        setPresetId={setPresetId}
        orientation={orientation}
        setOrientation={setOrientation}
        onReplay={() => setReplayKey((k) => k + 1)}
      />
    </div>
  );
};

const ScreenStage = ({
  scenario, presetId, setPresetId, orientation, setOrientation, onReplay,
}: {
  scenario: ScreenScenario;
  presetId: string;
  setPresetId: (id: string) => void;
  orientation: Orientation;
  setOrientation: (o: Orientation) => void;
  onReplay: () => void;
}) => {
  const [viewer, setViewer] = useState(scenario.viewer);
  const [mode, setMode] = useState<GameMode>(scenario.mode);
  const viewers = scenarioViewers(scenario);
  const shown = viewer === TABLE_VIEWER ? viewers : viewers.filter((v) => v.id === viewer);
  const [zoom, setZoom] = useState(() => (scenario.viewer === TABLE_VIEWER ? 0.5 : 0.8));

  // Faux serveur : la table fait foi, chaque téléphone en reçoit une copie.
  const [table, setTable] = useState<RevealScreenState>(scenario.initial);
  const tableRef = useRef(table);
  const [log, setLog] = useState<LogLine[]>([]);
  const frames = useRef(new Map<string, HTMLIFrameElement>());

  const post = (frame: HTMLIFrameElement | undefined, message: unknown) => {
    try { frame?.contentWindow?.postMessage(message, '*'); } catch { /* silent */ }
  };

  const onMessage = useCallback((e: MessageEvent) => {
    const entry = [...frames.current.entries()].find(([, f]) => f.contentWindow === e.source);
    if (!entry) return;
    const [who, frame] = entry;
    const data = e.data as { type?: string; event?: string; payload?: unknown };
    if (data?.type === 'studio:screenReady') {
      post(frame, { type: 'studio:screenUpdate', state: tableRef.current, events: [] });
      return;
    }
    if (data?.type !== 'studio:screenEmit' || typeof data.event !== 'string') return;
    const { state, events, log: note } = applyScreenEmit(scenario, tableRef.current, data.event, data.payload);
    tableRef.current = state;
    setTable(state);
    frames.current.forEach((f) => post(f, { type: 'studio:screenUpdate', state, events }));
    setLog((prev) => [{
      id: Date.now() + Math.random(),
      at: new Date().toLocaleTimeString('fr-FR'),
      who: viewers.find((v) => v.id === who)?.name ?? who,
      event: data.event!,
      payload: JSON.stringify(data.payload ?? {}).replace(/"lobbyCode":"APERCU",?/, ''),
      note,
    }, ...prev].slice(0, 60));
  }, [scenario, viewers]);

  useEffect(() => {
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onMessage]);

  const base = presetById(presetId);
  const dims = orientation === 'landscape' ? { w: base.h, h: base.w } : { w: base.w, h: base.h };

  return (
    <div className="flex-1 min-w-0 flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-2xl text-white tracking-tight">{scenario.title}</h2>
        <p className="text-[13px] text-white/60 max-w-3xl leading-relaxed">{scenario.note}</p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-[10px] uppercase tracking-wider text-white/35 mr-1">Vu par</span>
        {viewers.map((v) => (
          <button key={v.id} type="button" className={pill(viewer === v.id)} onClick={() => setViewer(v.id)}>
            {v.name}{v.id === scenario.leader.id ? ' 👑' : ''}
          </button>
        ))}
        <button type="button" className={pill(viewer === TABLE_VIEWER)} onClick={() => { setViewer(TABLE_VIEWER); setZoom(0.5); }}>
          Toute la table
        </button>

        <span className="w-px h-5 bg-white/10 mx-1.5" />
        {(['local', 'remote'] as GameMode[]).map((m) => (
          <button key={m} type="button" className={pill(mode === m)} onClick={() => setMode(m)}>
            {m === 'local' ? 'Local' : 'À distance'}
          </button>
        ))}

        <span className="w-px h-5 bg-white/10 mx-1.5" />
        {(['portrait', 'landscape'] as Orientation[]).map((o) => (
          <button key={o} type="button" className={pill(orientation === o)} onClick={() => setOrientation(o)}>
            {o === 'portrait' ? 'Portrait' : 'Paysage'}
          </button>
        ))}
        <select
          value={presetId}
          onChange={(e) => setPresetId(e.target.value)}
          className={`${PILL} bg-black/40 text-white/70 normal-case`}
        >
          {PHONE_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <select
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className={`${PILL} bg-black/40 text-white/70`}
          title="Zoom"
        >
          {ZOOMS.map((z) => <option key={z} value={z}>{Math.round(z * 100)} %</option>)}
        </select>

        <span className="flex-1" />
        <button type="button" className={pill(false)} onClick={onReplay} title="Remet la table dans l'état du scénario">
          ↺ Rejouer
        </button>
      </div>

      <div className="flex flex-wrap gap-4 items-start">
        {shown.map((v) => (
          <div key={v.id} className="flex flex-col gap-1.5">
            <p className="font-mono text-[11px] text-white/55">
              {v.name}{v.id === scenario.leader.id ? ' · pilier' : ''}
            </p>
            <div style={{ width: dims.w * zoom, height: dims.h * zoom }}>
              <iframe
                // Changer de mode recharge le téléphone ; la table, elle, est conservée.
                key={`${v.id}-${mode}`}
                ref={(el) => { if (el) frames.current.set(v.id, el); else frames.current.delete(v.id); }}
                src={`/studio/screen?scenario=${encodeURIComponent(scenario.id)}&viewer=${encodeURIComponent(v.id)}&mode=${mode}`}
                title={`Aperçu ${scenario.title} - ${v.name}`}
                style={{
                  width: dims.w,
                  height: dims.h,
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top left',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10,
                  background: 'white',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-white/[0.07] bg-black/30 max-w-4xl">
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.06]">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">Faux serveur · journal</p>
          <p className="font-mono text-[10px] text-white/35">
            révélées [{table.revealed.join(', ')}] · en attente {table.pending ?? '-'} · validées [{table.corrections.join(', ')}]
          </p>
        </div>
        <div className="max-h-56 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed">
          {log.length === 0 ? (
            <p className="text-white/30">Aucune action pour l'instant : clique dans un téléphone (Révéler, Oui/Non, Suivant…).</p>
          ) : log.map((l) => (
            <p key={l.id} className="text-white/70">
              <span className="text-white/30">{l.at}</span>{' '}
              <span className="text-amber-200">{l.who}</span>{' '}
              <span className="text-sky-300">{l.event}</span>{' '}
              <span className="text-white/40">{l.payload}</span>{' '}
              <span className="text-emerald-300">→ {l.note}</span>
            </p>
          ))}
        </div>
      </div>
    </div>
  );
};
