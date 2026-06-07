import { GameMode } from '@onskone/shared';
import { AVATARS } from '../../constants/game';

export type Orientation = 'portrait' | 'landscape';
export type Layout = 'auto' | 'cols2' | 'cols3' | 'cols4';

export interface ViewportPreset {
  id: string;
  label: string;
  short: string;
  w: number;
  h: number;
}

export const VIEWPORT_PRESETS: ViewportPreset[] = [
  { id: 'iphone-se', label: 'iPhone SE - 375×667', short: 'SE', w: 375, h: 667 },
  { id: 'iphone-17', label: 'iPhone 17 - 402×874', short: 'iP17', w: 402, h: 874 },
  { id: 'iphone-17-air', label: 'iPhone 17 Air - 422×917', short: 'iP17A', w: 422, h: 917 },
  { id: 'iphone-17-pro', label: 'iPhone 17 Pro - 402×874', short: 'iP17P', w: 402, h: 874 },
  { id: 'iphone-17-pmax', label: 'iPhone 17 Pro Max - 440×956', short: 'iP17PM', w: 440, h: 956 },
  { id: 'galaxy', label: 'Galaxy S22 - 360×800', short: 'GS22', w: 360, h: 800 },
  { id: 'pixel', label: 'Pixel 7 - 412×915', short: 'Px7', w: 412, h: 915 },
  { id: 'ipad', label: 'iPad - 820×1180', short: 'iPad', w: 820, h: 1180 },
  { id: 'ipad-pro', label: 'iPad Pro - 1024×1366', short: 'iPadP', w: 1024, h: 1366 },
  { id: 'desktop-sm', label: 'Laptop - 1280×800', short: 'LT', w: 1280, h: 800 },
  { id: 'desktop-lg', label: 'Desktop - 1536×960', short: 'DT', w: 1536, h: 960 },
  { id: 'free', label: 'Libre - 480×720', short: 'Free', w: 480, h: 720 },
];

const LEGACY_VIEWPORT_ALIAS: Record<string, string> = {
  'iphone-14': 'iphone-17',
  'iphone-pm': 'iphone-17-pmax',
};

export const presetById = (id: string): ViewportPreset => {
  const resolved = LEGACY_VIEWPORT_ALIAS[id] ?? id;
  return VIEWPORT_PRESETS.find((p) => p.id === resolved) ?? VIEWPORT_PRESETS[1];
};

export interface SlotConfig {
  id: string;
  name: string;
  avatarId: number;
  viewportId: string;
  orientation: Orientation;
  bot: boolean;
}

export interface SlotRuntimeState {
  isLeader: boolean;
  isSubstitute: boolean;
  phase: string | null;
}

export const FUN_NAMES = [
  'Alice', 'Bob', 'Charlie', 'Dora', 'Eli', 'Fanny', 'Gus', 'Hugo',
  'Ines', 'Jules', 'Kim', 'Lola', 'Milo', 'Nora', 'Otto', 'Pia',
];

export const STORAGE_KEY = 'onskone:studio:config:v3';

export const makeSlot = (i: number): SlotConfig => ({
  id: `slot-${i}-${Math.random().toString(36).slice(2, 7)}`,
  name: FUN_NAMES[i % FUN_NAMES.length],
  avatarId: i % AVATARS.length,
  viewportId: 'iphone-17',
  orientation: 'portrait',
  bot: false,
});

export interface SavedConfig {
  slots: SlotConfig[];
  layout: Layout;
  zoom: number;
  debugTimers: boolean;
  gameMode?: GameMode;
  timeMultiplier?: number;
}

export const loadSavedConfig = (): SavedConfig | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.slots)) return null;
    parsed.slots = parsed.slots.map((s: Partial<SlotConfig>) => {
      const aliased = s.viewportId ? LEGACY_VIEWPORT_ALIAS[s.viewportId] ?? s.viewportId : undefined;
      return {
        ...makeSlot(0),
        ...s,
        bot: !!s.bot,
        viewportId: aliased && VIEWPORT_PRESETS.some((p) => p.id === aliased)
          ? aliased
          : 'iphone-17',
      };
    });
    return parsed;
  } catch { return null; }
};

export const viewportDims = (slot: SlotConfig): { w: number; h: number } => {
  const base = presetById(slot.viewportId);
  return slot.orientation === 'landscape'
    ? { w: base.h, h: base.w }
    : { w: base.w, h: base.h };
};

// ---------- Unified control styles ----------
const PILL = 'bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-md transition-colors';
export const PILL_ICON = `${PILL} w-7 h-7 flex items-center justify-center text-white/70 hover:text-white text-[13px] leading-none`;
export const SELECT_CLS =
  'bg-[#0f1117] text-white/85 border border-white/10 rounded-md px-2 py-1 text-[11px] font-mono ' +
  'focus:outline-none focus:border-amber-400/60 hover:border-white/20 transition-colors ' +
  '[&>option]:bg-[#0f1117] [&>option]:text-white';
