import { useEffect, useRef, useState } from 'react';
import { getAvatarUrl } from '../../constants/game';
import {
  SlotConfig, SlotRuntimeState,
  VIEWPORT_PRESETS, presetById, viewportDims,
  PILL_ICON, SELECT_CLS,
} from './shared';

interface SlotCardProps {
  slot: SlotConfig;
  index: number;
  zoom: number;
  url: string | null;
  state: SlotRuntimeState | undefined;
  running: boolean;
  lobbyCode: string | null;
  reloadKey: number;
  slotReloadKey: number;
  iframeRef: (el: HTMLIFrameElement | null) => void;
  onCycleAvatar: (id: string, dir: 1 | -1) => void;
  onUpdateSlot: (id: string, patch: Partial<SlotConfig>) => void;
  onToggleBot: (id: string) => void;
  onReloadSlot: (id: string) => void;
  onRemoveSlot: (id: string) => void;
}

export const SlotCard = ({
  slot, index, zoom, url, state, running, lobbyCode,
  reloadKey, slotReloadKey, iframeRef,
  onCycleAvatar, onUpdateSlot, onToggleBot, onReloadSlot, onRemoveSlot,
}: SlotCardProps) => {
  const dims = viewportDims(slot);
  const slotKey = `${slot.id}-${reloadKey}-${slotReloadKey}`;
  const isPilier = !!state?.isLeader;
  const isSubstitute = !!state?.isSubstitute && !isPilier;
  const preset = presetById(slot.viewportId);

  // Mesure la largeur dispo dans le slot pour shrink-to-fit si zoom utilisateur trop large.
  const viewportRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState<number>(0);
  useEffect(() => {
    if (!viewportRef.current) return;
    const el = viewportRef.current;
    const ro = new ResizeObserver((entries) => {
      setAvailableWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    setAvailableWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const fitZoom = availableWidth > 0 ? availableWidth / dims.w : zoom;
  const effectiveZoom = Math.min(zoom, fitZoom);

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
      className={`relative rounded-xl overflow-hidden flex flex-col transition-all duration-300
        bg-gradient-to-b from-white/[0.03] to-white/[0.01]
        ${isPilier
          ? 'border border-amber-300/60 shadow-[0_0_0_1px_rgba(251,191,36,0.25),0_0_28px_rgba(251,191,36,0.18)]'
          : isSubstitute
            ? 'border border-sky-300/50 shadow-[0_0_0_1px_rgba(125,211,240,0.2),0_0_22px_rgba(125,211,240,0.14)]'
            : 'border border-white/[0.08]'
        }`}
    >
      <div className="flex items-center gap-1.5 px-2.5 py-2 bg-black/40 border-b border-white/[0.06]">
        <span className="font-mono text-[10px] tracking-widest text-white/30 w-6 text-center">
          {String(index + 1).padStart(2, '0')}
        </span>

        <button
          onClick={() => onCycleAvatar(slot.id, 1)}
          onContextMenu={(e) => { e.preventDefault(); onCycleAvatar(slot.id, -1); }}
          className="flex-shrink-0 w-7 h-7 rounded-full overflow-hidden border border-white/15 hover:border-amber-300/60 bg-white/5 transition-colors"
          title={`Avatar #${slot.avatarId} - clic suivant, clic droit précédent`}
        >
          <img
            src={getAvatarUrl(slot.avatarId)}
            alt={`avatar ${slot.avatarId}`}
            className="w-full h-full object-cover"
          />
        </button>

        <input
          value={slot.name}
          onChange={(e) => onUpdateSlot(slot.id, { name: e.target.value })}
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
          onChange={(e) => onUpdateSlot(slot.id, { viewportId: e.target.value })}
          className={SELECT_CLS}
          title="Format d'écran"
        >
          {VIEWPORT_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>

        <button
          onClick={() => onUpdateSlot(slot.id, {
            orientation: slot.orientation === 'portrait' ? 'landscape' : 'portrait',
          })}
          className={PILL_ICON}
          title="Pivoter portrait ↔ paysage"
        >
          {slot.orientation === 'portrait' ? '⇋' : '⇵'}
        </button>

        <button
          onClick={() => onToggleBot(slot.id)}
          className={`w-7 h-7 rounded-md border flex items-center justify-center text-[13px] transition-all ${slot.bot
            ? 'bg-violet-400/20 border-violet-300/60 text-violet-100 shadow-[0_0_10px_rgba(167,139,250,0.25)]'
            : 'bg-white/[0.04] border-white/10 text-white/50 hover:text-white/80 hover:border-white/20'
            }`}
          title={slot.bot ? 'Bot ACTIF - clic pour désactiver' : 'Activer mode bot auto-réponse'}
        >🤖</button>

        <button
          onClick={() => onReloadSlot(slot.id)}
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
          onClick={() => onRemoveSlot(slot.id)}
          className="w-7 h-7 rounded-md border border-red-400/20 bg-red-500/10 hover:bg-red-500/25 hover:border-red-400/50 text-red-200 flex items-center justify-center text-[13px] transition-colors"
          title="Supprimer ce slot"
        >✕</button>
      </div>

      <div
        ref={viewportRef}
        className="relative flex justify-center items-start bg-black/40 p-2 overflow-hidden"
        style={{ height: dims.h * effectiveZoom + 16 }}
      >
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
            width: dims.w * effectiveZoom,
            height: dims.h * effectiveZoom,
            flexShrink: 0,
          }}
        >
        <div
          style={{
            width: dims.w,
            height: dims.h,
            transform: `scale(${effectiveZoom})`,
            transformOrigin: 'top left',
          }}
        >
          {url ? (
            <iframe
              key={slotKey}
              ref={iframeRef}
              name={`studio-slot-${index}`}
              src={url}
              title={`Studio slot ${index + 1} - ${slot.name}`}
              onLoad={(e) => {
                try {
                  (e.target as HTMLIFrameElement).contentWindow?.postMessage(
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
      </div>

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
};
