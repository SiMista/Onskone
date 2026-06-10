export interface CategoryStyle {
  strip: string;
  chip: string;
  dot: string;
  text: string;
  ring: string;
  glow: string;
}

const CATEGORY_PALETTE: Record<string, CategoryStyle> = {
  ICEBREAKERS: {
    strip: 'bg-sky-400',
    chip: 'bg-sky-500/15 border-sky-400/50 text-sky-100',
    dot: 'bg-sky-400',
    text: 'text-sky-300',
    ring: 'ring-sky-300/40',
    glow: 'from-sky-400 to-transparent',
  },
  FUN: {
    strip: 'bg-amber-400',
    chip: 'bg-amber-400/15 border-amber-300/50 text-amber-100',
    dot: 'bg-amber-400',
    text: 'text-amber-300',
    ring: 'ring-amber-300/40',
    glow: 'from-amber-400 to-transparent',
  },
  DEEP: {
    strip: 'bg-red-400',
    chip: 'bg-red-500/15 border-red-400/50 text-red-100',
    dot: 'bg-red-400',
    text: 'text-red-300',
    ring: 'ring-red-300/40',
    glow: 'from-red-400 to-transparent',
  },
};

const FALLBACK_PALETTE: CategoryStyle = {
  strip: 'bg-white/30',
  chip: 'bg-white/[0.05] border-white/15 text-white/75',
  dot: 'bg-white/50',
  text: 'text-white/75',
  ring: 'ring-white/20',
  glow: 'from-white/40 to-transparent',
};

export const categoryStyle = (category: string): CategoryStyle =>
  CATEGORY_PALETTE[category] ?? FALLBACK_PALETTE;

export const deckKey = (d: { category: string; theme: string }) => `${d.category}-${d.theme}`;
