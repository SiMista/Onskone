import type { TicketStatus, TicketType } from '../../utils/ticketsApi';
import { TICKET_CATEGORY_BY_VALUE } from '../../constants/ticketCategories';

// Admin reste FR-only : libellés codés en dur ici (l'app publique passe par i18n).
const TICKET_TYPE_LABELS_FR: Record<TicketType, string> = {
  question_report: 'Question pourrie',
  bug: 'Bug technique',
  suggestion: 'Idée / suggestion',
};

// Classes partagées, style Studio (palette sombre du dev tooling)
export const CLUSTER = 'flex items-center gap-1 bg-black/30 border border-white/10 rounded-lg px-1.5 py-1';
export const INPUT_CLS =
  'bg-black/25 text-white/85 border border-white/15 rounded-lg px-2.5 py-1.5 text-[13px] ' +
  'focus:outline-none focus:border-amber-400/60 hover:border-white/25 transition-colors ' +
  'placeholder:text-white/40';

interface TicketTypeStyle {
  dot: string;
  chip: string;
  bar: string;
  ring: string;
  // Icône monochrome (teintée par `text`) : l'admin ne mélange pas les emojis couleur de ReportModal.
  icon: string;
  text: string;
}

// Styles admin-only (palette tickets - distincte des decks). Le label/glyph
// proviennent de la source centralisée pour rester aligné avec ReportModal.
const TYPE_STYLES: Record<TicketType, TicketTypeStyle> = {
  bug: {
    dot: 'bg-rose-400',
    chip: 'bg-rose-500/10 border-rose-400/40 text-rose-100',
    bar: 'bg-rose-400/70',
    ring: 'ring-rose-300/30',
    icon: 'mdi:bug-outline',
    text: 'text-rose-300',
  },
  question_report: {
    dot: 'bg-cyan-400',
    chip: 'bg-cyan-500/10 border-cyan-400/40 text-cyan-100',
    bar: 'bg-cyan-400/70',
    ring: 'ring-cyan-300/30',
    icon: 'mdi:comment-question-outline',
    text: 'text-cyan-300',
  },
  suggestion: {
    dot: 'bg-fuchsia-400',
    chip: 'bg-fuchsia-500/10 border-fuchsia-400/40 text-fuchsia-100',
    bar: 'bg-fuchsia-400/70',
    ring: 'ring-fuchsia-300/30',
    icon: 'mdi:lightbulb-on-outline',
    text: 'text-fuchsia-300',
  },
};

export type TicketTypeMeta = TicketTypeStyle & { label: string; glyph: string };

export const TYPE_META: Record<TicketType, TicketTypeMeta> = (Object.keys(TYPE_STYLES) as TicketType[])
  .reduce((acc, type) => {
    const cat = TICKET_CATEGORY_BY_VALUE[type];
    acc[type] = { ...TYPE_STYLES[type], label: TICKET_TYPE_LABELS_FR[type], glyph: cat.glyph };
    return acc;
  }, {} as Record<TicketType, TicketTypeMeta>);

export const STATUS_META: Record<TicketStatus, { label: string; icon: string; accent: string; bar: string; pill: string; dot: string; text: string }> = {
  new: {
    label: 'Nouveau',
    icon: 'mdi:inbox-arrow-down-outline',
    accent: 'border-amber-300/40',
    bar: 'from-amber-400/60 via-amber-400/20 to-transparent',
    pill: 'bg-amber-400/10 border-amber-300/40 text-amber-100',
    dot: 'bg-amber-300',
    text: 'text-amber-200/85',
  },
  in_progress: {
    label: 'En cours',
    icon: 'mdi:progress-wrench',
    accent: 'border-violet-300/40',
    bar: 'from-violet-400/60 via-violet-400/20 to-transparent',
    pill: 'bg-violet-400/10 border-violet-300/40 text-violet-100',
    dot: 'bg-violet-300',
    text: 'text-violet-200/85',
  },
  resolved: {
    label: 'Résolu',
    icon: 'mdi:check-circle-outline',
    accent: 'border-emerald-300/40',
    bar: 'from-emerald-400/60 via-emerald-400/20 to-transparent',
    pill: 'bg-emerald-400/10 border-emerald-300/40 text-emerald-100',
    dot: 'bg-emerald-300',
    text: 'text-emerald-200/85',
  },
  wont_fix: {
    label: 'Sans suite',
    icon: 'mdi:minus-circle-outline',
    accent: 'border-white/15',
    bar: 'from-white/30 via-white/10 to-transparent',
    pill: 'bg-white/[0.05] border-white/15 text-white/60',
    dot: 'bg-white/40',
    text: 'text-white/55',
  },
};

export const STATUS_ORDER: TicketStatus[] = ['new', 'in_progress', 'resolved', 'wont_fix'];

export const formatDate = (ms: number): string =>
  new Date(ms).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });

export const formatRelative = (ms: number): string => {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'à l\'instant';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}j`;
  return formatDate(ms);
};

// ---------- Navigation ----------
export type AdminTab = 'overview' | 'tickets' | 'logs' | 'lobbies' | 'stats' | 'decks' | 'content' | 'danger';
export type TabGroup = 'pilotage' | 'inbox' | 'catalogue' | 'system';

export interface TabDef {
  id: AdminTab;
  label?: string;
  icon?: string;
  ariaLabel?: string;
  hint: string;
  enabled: boolean;
  group: TabGroup;
}

export const TABS: TabDef[] = [
  { id: 'overview', icon: 'mdi:home', label: 'Accueil', ariaLabel: 'Accueil', hint: 'Résumé des tickets', enabled: true, group: 'pilotage' },
  { id: 'lobbies', label: 'Salons en direct', hint: 'Salons ouverts en ce moment', enabled: true, group: 'pilotage' },
  { id: 'tickets', icon: 'mdi:ticket-outline', label: 'Tickets', ariaLabel: 'Tickets', hint: 'Retours des joueurs', enabled: true, group: 'inbox' },
  { id: 'logs', icon: 'mdi:bug-outline', label: 'Logs', ariaLabel: 'Logs : erreurs remontées par l\'app', hint: 'Plantages et erreurs sur les appareils', enabled: true, group: 'system' },
  { id: 'danger', icon: 'mdi:alert-octagon-outline', label: 'Accès joueurs', ariaLabel: 'Maintenance et mise à jour obligatoire', hint: 'Maintenance et mise à jour obligatoire', enabled: true, group: 'system' },
  { id: 'stats', icon: 'mdi:chart-bar', label: 'Stats', ariaLabel: 'Stats des thèmes et questions', hint: 'Thèmes et questions préférés', enabled: true, group: 'pilotage' },
  { id: 'decks', icon: 'mdi:cards-outline', label: 'Decks', ariaLabel: 'Decks : thèmes, sujets et questions', hint: 'Thèmes, sujets et questions', enabled: true, group: 'catalogue' },
  { id: 'content', icon: 'mdi:text-box-outline', label: 'Contenu', ariaLabel: 'Contenu du site', hint: 'Paliers, succès, avatars, pages légales…', enabled: true, group: 'catalogue' },
];

export const GROUP_ORDER: TabGroup[] = ['pilotage', 'inbox', 'catalogue', 'system'];

// Groupes rendus en menu déroulant (dropdown desktop / bottom sheet mobile) : leurs
// onglets ne sont pas des entrées de nav à part entière. Les autres groupes restent à plat.
export const NAV_MENUS: Partial<Record<TabGroup, { label: string; icon: string }>> = {
  catalogue: { label: 'Catalogue', icon: 'mdi:cards-outline' },
  system: { label: 'Système', icon: 'mdi:shield-alert-outline' },
};
export const NAV_MENU_ORDER = GROUP_ORDER.filter((g) => NAV_MENUS[g]);
export const tabsOfGroup = (group: TabGroup): TabDef[] => TABS.filter((t) => t.group === group);

export const MOBILE_TAB_META: Record<AdminTab, { icon: string; label: string }> = {
  overview: { icon: 'mdi:home-variant-outline', label: 'Accueil' },
  lobbies: { icon: 'mdi:broadcast', label: 'Salons' },
  tickets: { icon: 'mdi:ticket-outline', label: 'Tickets' },
  logs: { icon: 'mdi:bug-outline', label: 'Logs' },
  stats: { icon: 'mdi:chart-bar', label: 'Stats' },
  decks: { icon: 'mdi:cards-outline', label: 'Decks' },
  content: { icon: 'mdi:text-box-outline', label: 'Contenu' },
  danger: { icon: 'mdi:alert-octagon-outline', label: 'Accès' },
};

// Les 2 derniers slots de la barre mobile sont les menus (Catalogue, Système), rendus à part.
export const MOBILE_TAB_ORDER: AdminTab[] = ['overview', 'lobbies', 'stats', 'tickets'];
