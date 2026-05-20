import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useToast } from '../components/Toast';
import {
  Ticket,
  TicketStatus,
  TicketType,
  adminLogin,
  setAdminToken,
  clearAdminToken,
  fetchTickets,
  updateTicketStatus,
  deleteTicket,
  checkAdminAuth,
} from '../utils/ticketsApi';
import { fetchAdminLobbies, fetchAdminDecks } from '../utils/adminDataApi';
import type { AdminLobbySummary, AdminDeckSummary } from '@onskone/shared';
import { GAME_CONSTANTS } from '@onskone/shared';
import { Icon } from '@iconify/react';
import { TIERS } from './EndGame';
import { FUN_FACTS } from '../constants/funFacts';
import { ACHIEVEMENTS } from '../utils/playerStats';
import { AVATARS, getAvatarUrl } from '../constants/game';
import { LEGAL_CONTENT } from '../constants/legal';

// =====================================================================
// Admin Onskoné - control room (Studio-style dark UI)
// =====================================================================

// ---------- Studio-style shared classes ----------
const CLUSTER = 'flex items-center gap-1.5 bg-black/30 border border-white/[0.06] rounded-lg px-2 py-1';
const INPUT_CLS =
  'bg-[#0f1117] text-white/85 border border-white/10 rounded-md px-2.5 py-1.5 text-[12px] font-mono ' +
  'focus:outline-none focus:border-amber-400/60 hover:border-white/20 transition-colors ' +
  'placeholder:text-white/25';

// ---------- Type → accent color (palette tickets - distincte des decks) ----------
// Decks utilisent sky/amber/red (ICEBREAKERS/FUN/DEEP). Tickets prennent une autre famille
// pour qu'on lise au premier coup d'œil de quoi on parle.
const TYPE_META: Record<TicketType, { label: string; dot: string; chip: string; ring: string }> = {
  question_report: {
    label: 'Question',
    dot: 'bg-orange-400',
    chip: 'bg-orange-500/10 border-orange-400/40 text-orange-100',
    ring: 'ring-orange-300/30',
  },
  bug: {
    label: 'Bug',
    dot: 'bg-rose-400',
    chip: 'bg-rose-500/10 border-rose-400/40 text-rose-100',
    ring: 'ring-rose-300/30',
  },
  suggestion: {
    label: 'Idée',
    dot: 'bg-teal-400',
    chip: 'bg-teal-500/10 border-teal-400/40 text-teal-100',
    ring: 'ring-teal-300/30',
  },
};

const STATUS_META: Record<TicketStatus, { label: string; accent: string; bar: string; pill: string }> = {
  new: {
    label: 'Nouveau',
    accent: 'border-amber-300/40',
    bar: 'from-amber-400/60 via-amber-400/20 to-transparent',
    pill: 'bg-amber-400/10 border-amber-300/40 text-amber-100',
  },
  in_progress: {
    label: 'En cours',
    accent: 'border-violet-300/40',
    bar: 'from-violet-400/60 via-violet-400/20 to-transparent',
    pill: 'bg-violet-400/10 border-violet-300/40 text-violet-100',
  },
  resolved: {
    label: 'Résolu',
    accent: 'border-emerald-300/40',
    bar: 'from-emerald-400/60 via-emerald-400/20 to-transparent',
    pill: 'bg-emerald-400/10 border-emerald-300/40 text-emerald-100',
  },
  wont_fix: {
    label: 'Pas de fix',
    accent: 'border-white/15',
    bar: 'from-white/30 via-white/10 to-transparent',
    pill: 'bg-white/[0.05] border-white/15 text-white/60',
  },
};

const STATUS_ORDER: TicketStatus[] = ['new', 'in_progress', 'resolved', 'wont_fix'];

const formatDate = (ms: number): string =>
  new Date(ms).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });

const formatRelative = (ms: number): string => {
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

// =====================================================================
// Login Screen
// =====================================================================
const LoginScreen = ({ onSuccess }: { onSuccess: () => void }) => {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setIsLoading(true);
    setError(null);
    try {
      const token = await adminLogin(password);
      setAdminToken(token);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen text-white flex items-center justify-center px-4 relative"
      style={{
        background:
          'radial-gradient(800px 500px at 50% 10%, rgba(255,199,0,0.06), transparent 60%),' +
          'radial-gradient(700px 500px at 80% 90%, rgba(125,211,240,0.05), transparent 55%),' +
          'linear-gradient(180deg, #0a0c12 0%, #0d1018 100%)',
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.18]"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.35) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
        }}
      />

      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-sm rounded-xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-white/[0.01] backdrop-blur-xl p-6 space-y-5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]"
      >
        <div className="flex items-center gap-2">
          <span className="text-amber-400 text-[15px] leading-none">▍</span>
          <span className="font-mono text-[14px] text-white/85 lowercase tracking-tight leading-none">onskoné</span>
          <span className="font-mono text-[14px] text-white/25 leading-none">/</span>
          <span className="font-mono text-[14px] font-bold text-amber-200 uppercase tracking-[0.12em] leading-none">admin</span>
        </div>

        <div className="space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/35">
            authentification requise
          </p>
          <h1 className="text-[22px] font-semibold tracking-tight leading-tight">
            Salle de contrôle
          </h1>
          <p className="text-[12px] text-white/45 font-mono">
            Accès réservé à l'équipe Onskoné.
          </p>
        </div>

        <div className="space-y-2">
          <label className="block font-mono text-[11px] uppercase tracking-wider text-white/40">
            Mot de passe
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoFocus
            className={`${INPUT_CLS} w-full`}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-red-500/10 border border-red-400/30">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            <p className="font-mono text-[11px] text-red-200">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={!password || isLoading}
          className="w-full px-5 py-2 rounded-md font-mono text-[11px] font-bold uppercase tracking-wider bg-gradient-to-br from-amber-300 to-amber-500 text-black shadow-[0_2px_0_0_rgba(0,0,0,0.4),0_0_20px_rgba(251,191,36,0.35)] hover:shadow-[0_2px_0_0_rgba(0,0,0,0.4),0_0_28px_rgba(251,191,36,0.55)] hover:-translate-y-px active:translate-y-0 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        >
          {isLoading ? '…' : 'Se connecter'}
        </button>
      </form>
    </div>
  );
};

// =====================================================================
// Helpers
// =====================================================================
type AdminTab = 'overview' | 'tickets' | 'lobbies' | 'decks' | 'content' | 'stats';

type TabGroup = 'pilotage' | 'inbox' | 'catalogue' | 'analytics';

interface TabDef {
  id: AdminTab;
  label?: string;
  icon?: string;
  ariaLabel?: string;
  hint: string;
  enabled: boolean;
  group: TabGroup;
}

const TABS: TabDef[] = [
  { id: 'overview', icon: 'mdi:home', ariaLabel: 'Accueil', hint: 'accueil', enabled: true, group: 'pilotage' },
  { id: 'lobbies', label: 'Salons live', hint: 'temps réel', enabled: true, group: 'pilotage' },
  { id: 'tickets', label: 'Tickets', hint: 'retours joueurs', enabled: true, group: 'inbox' },
  { id: 'decks', label: 'Decks de questions', hint: 'catalogue', enabled: true, group: 'catalogue' },
  { id: 'content', label: 'Contenu du site', hint: 'données fixes', enabled: true, group: 'catalogue' },
  { id: 'stats', label: 'Stats', hint: 'analytics', enabled: true, group: 'analytics' },
];

const GROUP_ORDER: TabGroup[] = ['pilotage', 'inbox', 'catalogue', 'analytics'];

// =====================================================================
// Overview
// =====================================================================
const StatTile = ({
  label, value, hint, accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent: 'amber' | 'sky' | 'violet' | 'emerald' | 'red' | 'white';
}) => {
  // Couleur du nombre seulement, plus de gradient strip "néon" sur le top.
  const textColor: Record<typeof accent, string> = {
    amber: 'text-amber-300',
    sky: 'text-sky-300',
    violet: 'text-violet-300',
    emerald: 'text-emerald-300',
    red: 'text-red-300',
    white: 'text-white',
  };
  return (
    <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/40">{label}</p>
      <p className={`mt-1.5 text-3xl font-semibold tracking-tight tabular-nums ${textColor[accent]}`}>
        {value}
      </p>
      {hint && <p className="mt-1 font-mono text-[11px] text-white/35">{hint}</p>}
    </div>
  );
};

// Panneau d'accueil - synthèse actionnable plutôt que stats décoratives.
const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/55 font-bold mb-3">
    {children}
  </p>
);

const KpiCell = ({
  label, value, hint, onClick,
}: {
  label: string;
  value: number | string;
  hint?: string;
  onClick?: () => void;
}) => {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`text-left rounded-lg border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/15 transition-colors p-3 ${onClick ? 'cursor-pointer' : ''}`}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">{label}</p>
      <p className="mt-1 text-[26px] font-semibold tracking-tight tabular-nums text-white leading-tight">
        {value}
      </p>
      {hint && <p className="mt-0.5 font-mono text-[10px] text-white/35">{hint}</p>}
    </Tag>
  );
};

const OverviewPanel = ({
  tickets, onJumpToTickets,
}: {
  tickets: Ticket[];
  onJumpToTickets: (status?: TicketStatus, type?: TicketType) => void;
}) => {
  const stats = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const last24h = tickets.filter((t) => now - t.created_at < dayMs).length;
    const last7d = tickets.filter((t) => now - t.created_at < 7 * dayMs).length;
    const byStatus = tickets.reduce((acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    }, {} as Record<TicketStatus, number>);
    const byType = tickets.reduce((acc, t) => {
      acc[t.type] = (acc[t.type] || 0) + 1;
      return acc;
    }, {} as Record<TicketType, number>);
    const lobbyCounts = tickets.reduce((acc, t) => {
      if (!t.lobby_code) return acc;
      acc[t.lobby_code] = (acc[t.lobby_code] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const hotLobbies = Object.entries(lobbyCounts)
      .filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const recent = [...tickets]
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, 6);
    return { last24h, last7d, byStatus, byType, hotLobbies, recent };
  }, [tickets]);

  const open = (stats.byStatus.new || 0) + (stats.byStatus.in_progress || 0);
  const total = tickets.length || 1;

  return (
    <div className="space-y-6">
      {/* Ligne 1 : KPIs compacts, tous neutres (le néon des stat tiles ne sert à rien) */}
      <div>
        <SectionLabel>Vue d'ensemble</SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCell label="Ouverts" value={open} hint={`${stats.byStatus.new || 0} nouveau · ${stats.byStatus.in_progress || 0} wip`} onClick={() => onJumpToTickets('new')} />
          <KpiCell label="24 h" value={stats.last24h} hint="reçus aujourd'hui" />
          <KpiCell label="7 jours" value={stats.last7d} hint="cadence hebdo" />
          <KpiCell label="Résolus" value={stats.byStatus.resolved || 0} hint={`${stats.byStatus.wont_fix || 0} sans suite`} onClick={() => onJumpToTickets('resolved')} />
        </div>
      </div>

      {/* Ligne 2 : feed actionnable (gauche) + hot lobbies + par type (droite) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Derniers tickets - colonne large */}
        <div className="lg:col-span-3">
          <div className="flex items-baseline justify-between mb-3">
            <SectionLabel>Derniers tickets</SectionLabel>
            <button
              onClick={() => onJumpToTickets()}
              className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/35 hover:text-amber-200 transition-colors cursor-pointer"
            >
              voir tout →
            </button>
          </div>
          {stats.recent.length === 0 ? (
            <div className="rounded-lg border border-white/[0.07] bg-white/[0.015] py-10 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-white/30">
              inbox vide
            </div>
          ) : (
            <div className="rounded-lg border border-white/[0.07] bg-white/[0.015] overflow-hidden divide-y divide-white/[0.04]">
              {stats.recent.map((t) => {
                const type = TYPE_META[t.type];
                const status = STATUS_META[t.status];
                return (
                  <button
                    key={t.id}
                    onClick={() => onJumpToTickets()}
                    className="w-full text-left px-3 py-2.5 hover:bg-white/[0.025] transition-colors cursor-pointer flex items-start gap-2.5 group"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${type.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`px-1.5 py-0.5 rounded border font-mono text-[10px] uppercase tracking-wider ${type.chip}`}>
                          {type.label}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded border font-mono text-[10px] uppercase tracking-wider ${status.pill}`}>
                          {status.label}
                        </span>
                        {t.lobby_code && (
                          <span className="font-mono text-[10px] tracking-widest font-bold text-white/55">{t.lobby_code}</span>
                        )}
                        <span className="ml-auto font-mono text-[10px] text-white/35 tabular-nums">{formatRelative(t.created_at)}</span>
                      </div>
                      <p className="text-[12.5px] text-white/85 leading-snug line-clamp-1 group-hover:text-white transition-colors">
                        {t.message}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Colonne droite : hot lobbies + par type */}
        <div className="lg:col-span-2 space-y-5">
          <div>
            <SectionLabel>Lobbies signalés</SectionLabel>
            {stats.hotLobbies.length === 0 ? (
              <div className="rounded-lg border border-white/[0.07] bg-white/[0.015] py-6 text-center font-mono text-[11px] text-white/30">
                aucun lobby récurrent
              </div>
            ) : (
              <div className="rounded-lg border border-white/[0.07] bg-white/[0.015] overflow-hidden divide-y divide-white/[0.04]">
                {stats.hotLobbies.map(([code, count]) => (
                  <button
                    key={code}
                    onClick={() => onJumpToTickets()}
                    className="w-full text-left px-3 py-2 hover:bg-white/[0.025] transition-colors cursor-pointer flex items-center gap-2"
                  >
                    <span className="text-rose-300 text-[12px]" title="récurrent">●</span>
                    <span className="font-mono text-[12px] font-bold tracking-widest text-white/85">{code}</span>
                    <span className="ml-auto font-mono text-[11px] tabular-nums text-white/55">
                      ×{count} tickets
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <SectionLabel>Par type</SectionLabel>
            <div className="rounded-lg border border-white/[0.07] bg-white/[0.015] p-3 space-y-2.5">
              {(['bug', 'question_report', 'suggestion'] as TicketType[]).map((t) => {
                const n = stats.byType[t] || 0;
                const pct = Math.round((n / total) * 100);
                return (
                  <button
                    key={t}
                    onClick={() => onJumpToTickets(undefined, t)}
                    className="group w-full text-left cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${TYPE_META[t].dot}`} />
                        <span className="font-mono text-[11px] text-white/75 group-hover:text-white transition-colors">
                          {TYPE_META[t].label}
                        </span>
                      </span>
                      <span className="font-mono text-[11px] tabular-nums text-white/55">{n}</span>
                    </div>
                    <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${t === 'bug' ? 'bg-rose-400/70' :
                          t === 'question_report' ? 'bg-orange-400/70' :
                            'bg-teal-400/70'
                          }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// =====================================================================
// Tickets - kanban + filters + bulk
// =====================================================================
interface TicketCardProps {
  ticket: Ticket;
  isSelected: boolean;
  isHot: boolean;
  onOpen: () => void;
  onToggleSelect: () => void;
  onStatusChange: (status: TicketStatus) => void;
  onDelete: () => void;
}

const TicketCard = ({
  ticket, isSelected, isHot,
  onOpen, onToggleSelect, onStatusChange, onDelete,
}: TicketCardProps) => {
  const type = TYPE_META[ticket.type];

  return (
    <div
      className={`group relative rounded-lg border bg-gradient-to-b from-white/[0.035] to-white/[0.01] transition-all overflow-hidden
        ${isSelected
          ? 'border-amber-300/60'
          : 'border-white/[0.07] hover:border-white/15'}`}
    >
      {/* Type accent strip */}
      <div className={`absolute left-0 top-0 bottom-0 w-[2px] ${ticket.type === 'bug' ? 'bg-rose-400/60' :
        ticket.type === 'question_report' ? 'bg-orange-400/60' :
          'bg-teal-400/60'
        }`} />

      <div className="px-2.5 py-2 pl-3.5">
        {/* Header - single dense line, ✕ top-right */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
            className={`w-4 h-4 rounded-sm border flex-shrink-0 flex items-center justify-center transition-colors ${isSelected
              ? 'bg-amber-400 border-amber-400 text-black'
              : 'border-white/20 hover:border-white/50 bg-transparent'
              }`}
            title={isSelected ? 'Désélectionner' : 'Sélectionner'}
          >
            {isSelected && <span className="text-[11px] leading-none font-bold">✓</span>}
          </button>

          <span className={`px-1.5 py-0.5 rounded border font-mono text-[11px] uppercase tracking-wider ${type.chip}`}>
            {type.label}
          </span>

          <span className="font-mono text-[11px] text-white/35 tabular-nums">#{ticket.id}</span>

          {ticket.lobby_code && (
            <span className="font-mono text-[11px] tracking-widest font-bold text-white/55 truncate" title={`lobby ${ticket.lobby_code}`}>
              {ticket.lobby_code}
            </span>
          )}

          {isHot && (
            <span
              className="font-mono text-[11px] uppercase tracking-wider px-1 py-0.5 rounded bg-red-500/15 border border-red-400/40 text-red-200"
              title="Plusieurs tickets sur le même lobby"
            >
              🔥
            </span>
          )}

          <span className="ml-auto font-mono text-[11px] text-white/40 whitespace-nowrap" title={formatDate(ticket.created_at)}>
            {formatRelative(ticket.created_at)}
          </span>

          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="flex-shrink-0 w-5 h-5 rounded border border-red-400/20 bg-red-500/5 hover:bg-red-500/25 hover:border-red-400/60 text-red-200/70 hover:text-red-100 flex items-center justify-center text-[12px] leading-none transition-colors"
            title="Supprimer"
          >
            ✕
          </button>
        </div>

        {/* Message - clickable to open modal */}
        <button onClick={onOpen} className="w-full text-left mt-1.5 cursor-pointer">
          <p className="text-[13px] text-white/85 leading-snug whitespace-pre-wrap break-words line-clamp-2">
            {ticket.message}
          </p>
          {ticket.pseudo && (
            <p className="font-mono text-[11px] text-white/45 mt-1">
              <span className="text-white/25">@</span>{ticket.pseudo}
            </p>
          )}
        </button>

        {/* Quick status actions - hover only, single compact row */}
        <div className="mt-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          {STATUS_ORDER.filter((s) => s !== ticket.status).map((s) => (
            <button
              key={s}
              onClick={(e) => { e.stopPropagation(); onStatusChange(s); }}
              className={`px-1.5 py-0.5 rounded border font-mono text-[11px] uppercase tracking-wider transition-colors ${STATUS_META[s].pill} hover:brightness-125`}
              title={`Déplacer vers "${STATUS_META[s].label}"`}
            >
              → {STATUS_META[s].label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ---------- Detail modal ----------
const TicketDetailModal = ({
  ticket, onClose, onStatusChange, onDelete,
}: {
  ticket: Ticket;
  onClose: () => void;
  onStatusChange: (status: TicketStatus) => void;
  onDelete: () => void;
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const type = TYPE_META[ticket.type];
  const status = STATUS_META[ticket.status];

  const copy = (text: string) => {
    try { navigator.clipboard?.writeText(text); } catch { /* silent */ }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto custom-scroll rounded-xl border border-white/[0.1] bg-gradient-to-b from-[#13161e] to-[#0d1018] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-[#13161e]/95 backdrop-blur px-5 py-3 border-b border-white/[0.06] flex items-center gap-2 z-10">
          <span className={`px-2 py-0.5 rounded border font-mono text-[11px] uppercase tracking-wider ${type.chip}`}>
            {type.label}
          </span>
          <span className={`px-2 py-0.5 rounded border font-mono text-[11px] uppercase tracking-wider ${status.pill}`}>
            {status.label}
          </span>
          <span className="font-mono text-[12px] text-white/40 tabular-nums">#{ticket.id}</span>
          <button
            onClick={onClose}
            className="ml-auto w-7 h-7 rounded-md border border-white/10 bg-white/[0.04] hover:bg-white/[0.1] text-white/70 hover:text-white flex items-center justify-center transition-colors"
            title="Fermer (Esc)"
          >✕</button>
        </div>

        <div className="p-5 space-y-5">
          {/* Message */}
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-white/35 mb-1.5">Message</p>
            <p className="text-[14px] text-white/90 leading-relaxed whitespace-pre-wrap break-words">
              {ticket.message}
            </p>
          </div>

          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-white/35 mb-0.5">Pseudo</p>
              <p className="text-white/85">{ticket.pseudo || <span className="text-white/30">-</span>}</p>
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-white/35 mb-0.5">Lobby</p>
              {ticket.lobby_code ? (
                <button
                  onClick={() => copy(ticket.lobby_code!)}
                  className="font-mono font-bold tracking-widest text-white/85 hover:text-amber-200 transition-colors"
                  title="Copier"
                >
                  <span className="inline-flex items-center gap-1">
                    {ticket.lobby_code}
                    <Icon icon="mdi:content-copy" className="w-3 h-3 text-white/30" />
                  </span>
                </button>
              ) : <p className="text-white/30">-</p>}
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-white/35 mb-0.5">Reçu</p>
              <p className="font-mono text-white/85">{formatDate(ticket.created_at)}</p>
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-white/35 mb-0.5">Mis à jour</p>
              <p className="font-mono text-white/85">{formatDate(ticket.updated_at)}</p>
            </div>
          </div>

          {/* Context */}
          {ticket.context && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="font-mono text-[11px] uppercase tracking-wider text-white/35">Contexte</p>
                <button
                  onClick={() => copy(ticket.context!)}
                  className="font-mono text-[11px] text-white/40 hover:text-white transition-colors"
                  title="Copier le contexte"
                >copier ⧉</button>
              </div>
              <pre className="rounded-md border border-white/[0.06] bg-black/30 p-3 font-mono text-[12px] text-white/75 whitespace-pre-wrap break-all max-h-48 overflow-y-auto custom-scroll">
                {ticket.context}
              </pre>
            </div>
          )}

          {/* User agent */}
          {ticket.user_agent && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="font-mono text-[11px] uppercase tracking-wider text-white/35">User agent</p>
                <button
                  onClick={() => copy(ticket.user_agent!)}
                  className="font-mono text-[11px] text-white/40 hover:text-white transition-colors"
                  title="Copier le user agent"
                >copier ⧉</button>
              </div>
              <p className="rounded-md border border-white/[0.06] bg-black/30 p-3 font-mono text-[12px] text-white/75 break-all">
                {ticket.user_agent}
              </p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="sticky bottom-0 bg-[#13161e]/95 backdrop-blur px-5 py-3 border-t border-white/[0.06] flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-white/35 mr-1">déplacer vers</span>
          {STATUS_ORDER.filter((s) => s !== ticket.status).map((s) => (
            <button
              key={s}
              onClick={() => onStatusChange(s)}
              className={`px-2 py-1 rounded border font-mono text-[11px] uppercase tracking-wider transition-colors ${STATUS_META[s].pill} hover:brightness-125`}
            >
              → {STATUS_META[s].label}
            </button>
          ))}
          <button
            onClick={onDelete}
            className="ml-auto px-3 py-1 rounded border border-red-400/40 bg-red-500/10 hover:bg-red-500/25 hover:border-red-400/70 text-red-200 font-mono text-[11px] uppercase tracking-wider transition-colors"
          >
            ✕ supprimer
          </button>
        </div>
      </div>
    </div>
  );
};

const TicketsPanel = ({
  tickets, isLoading, onChangeTickets,
}: {
  tickets: Ticket[];
  isLoading: boolean;
  onChangeTickets: (next: Ticket[] | ((prev: Ticket[]) => Ticket[])) => void;
}) => {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TicketType | ''>('');
  const [groupByLobby, setGroupByLobby] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [openTicketId, setOpenTicketId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ kind: 'single'; id: number } | { kind: 'bulk'; ids: number[] } | null>(null);
  const showToast = useToast();

  const lobbyCounts = useMemo(() => {
    return tickets.reduce((acc, t) => {
      if (!t.lobby_code) return acc;
      acc[t.lobby_code] = (acc[t.lobby_code] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [tickets]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (typeFilter && t.type !== typeFilter) return false;
      if (!q) return true;
      return (
        t.message.toLowerCase().includes(q) ||
        (t.pseudo && t.pseudo.toLowerCase().includes(q)) ||
        (t.lobby_code && t.lobby_code.toLowerCase().includes(q)) ||
        String(t.id) === q
      );
    });
  }, [tickets, search, typeFilter]);

  const columns = useMemo(() => {
    return STATUS_ORDER.reduce((acc, s) => {
      acc[s] = filtered.filter((t) => t.status === s);
      return acc;
    }, {} as Record<TicketStatus, Ticket[]>);
  }, [filtered]);

  const toggleSelect = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = () => setSelected(new Set());

  const handleStatusChange = async (id: number, status: TicketStatus) => {
    try {
      await updateTicketStatus(id, status);
      onChangeTickets((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur', 'error');
    }
  };

  const requestDelete = (id: number) => setPendingDelete({ kind: 'single', id });
  const requestBulkDelete = () => {
    const ids = [...selected];
    if (!ids.length) return;
    setPendingDelete({ kind: 'bulk', ids });
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const ids = pendingDelete.kind === 'single' ? [pendingDelete.id] : pendingDelete.ids;
    setPendingDelete(null);
    try {
      await Promise.all(ids.map((id) => deleteTicket(id)));
      onChangeTickets((prev) => prev.filter((t) => !ids.includes(t.id)));
      setSelected((prev) => {
        const n = new Set(prev);
        ids.forEach((id) => n.delete(id));
        return n;
      });
      if (openTicketId && ids.includes(openTicketId)) setOpenTicketId(null);
      showToast(`${ids.length} ticket${ids.length > 1 ? 's' : ''} supprimé${ids.length > 1 ? 's' : ''}`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur', 'error');
    }
  };

  const bulkMove = async (status: TicketStatus) => {
    const ids = [...selected];
    if (!ids.length) return;
    try {
      await Promise.all(ids.map((id) => updateTicketStatus(id, status)));
      onChangeTickets((prev) => prev.map((t) => (selected.has(t.id) ? { ...t, status } : t)));
      showToast(`${ids.length} ticket${ids.length > 1 ? 's' : ''} déplacé${ids.length > 1 ? 's' : ''}`, 'success');
      clearSelection();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur', 'error');
    }
  };

  const openTicket = openTicketId !== null ? tickets.find((t) => t.id === openTicketId) ?? null : null;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className={`${CLUSTER} flex-1 min-w-[200px] max-w-md`}>
          <Icon icon="mdi:magnify" className="w-4 h-4 text-white/35 ml-0.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="rechercher dans message, pseudo, lobby, #id"
            className="flex-1 bg-transparent border-0 outline-0 text-[12px] text-white/85 placeholder:text-white/25 font-mono"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-white/30 hover:text-white text-[12px] px-1"
              title="Effacer"
            >×</button>
          )}
        </div>

        <div className={CLUSTER}>
          <span className="font-mono text-[11px] uppercase tracking-wider text-white/40 px-1">Type</span>
          {(['', 'bug', 'question_report', 'suggestion'] as const).map((t) => {
            const active = typeFilter === t;
            const label = t === '' ? 'tous' : TYPE_META[t].label.toLowerCase();
            return (
              <button
                key={t || 'all'}
                onClick={() => setTypeFilter(t)}
                className={`px-2 py-0.5 rounded font-mono text-[11px] uppercase tracking-wider transition-colors ${active
                  ? 'bg-white/[0.08] text-white'
                  : 'text-white/45 hover:text-white/80'
                  }`}
              >
                {t && <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle ${TYPE_META[t].dot}`} />}
                {label}
              </button>
            );
          })}
        </div>

        <div className={CLUSTER}>
          <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] font-mono uppercase tracking-wider text-white/70 hover:text-white px-1">
            <input
              type="checkbox"
              checked={groupByLobby}
              onChange={(e) => setGroupByLobby(e.target.checked)}
              className="accent-amber-400"
            />
            <span>Group by lobby</span>
          </label>
        </div>
      </div>

      {/* Bulk actions bar - animated in when selection */}
      <div
        className={`overflow-hidden transition-all duration-200 ${selected.size > 0 ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'
          }`}
      >
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300/30 bg-amber-400/[0.06] px-3 py-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-amber-200">
            {selected.size} sélectionné{selected.size > 1 ? 's' : ''}
          </span>
          <span className="text-white/20">·</span>
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              onClick={() => bulkMove(s)}
              className={`px-2 py-0.5 rounded border font-mono text-[11px] uppercase tracking-wider ${STATUS_META[s].pill} hover:brightness-125 transition`}
            >
              → {STATUS_META[s].label}
            </button>
          ))}
          <button
            onClick={requestBulkDelete}
            className="px-2 py-0.5 rounded border border-red-400/40 bg-red-500/10 hover:bg-red-500/25 text-red-200 font-mono text-[11px] uppercase tracking-wider transition"
          >
            ✕ supprimer
          </button>
          <button
            onClick={clearSelection}
            className="ml-auto text-white/50 hover:text-white font-mono text-[11px] uppercase tracking-wider"
          >
            annuler
          </button>
        </div>
      </div>

      {/* Kanban grid */}
      {isLoading && tickets.length === 0 ? (
        <div className="text-center py-20 font-mono text-[11px] uppercase tracking-[0.3em] text-white/30">
          chargement…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-white/30">
            {tickets.length === 0 ? 'inbox vide' : 'aucun résultat'}
          </p>
          {tickets.length === 0 && (
            <p className="text-[12px] text-white/40">Les tickets envoyés depuis le jeu apparaîtront ici.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {STATUS_ORDER.map((status) => {
            const col = columns[status];
            const meta = STATUS_META[status];

            // Group by lobby if needed
            const grouped: Array<{ lobby: string | null; items: Ticket[] }> = groupByLobby
              ? (() => {
                const map = new Map<string, Ticket[]>();
                const orphans: Ticket[] = [];
                for (const t of col) {
                  if (t.lobby_code) {
                    const arr = map.get(t.lobby_code) ?? [];
                    arr.push(t);
                    map.set(t.lobby_code, arr);
                  } else {
                    orphans.push(t);
                  }
                }
                const groups: Array<{ lobby: string | null; items: Ticket[] }> = [...map.entries()]
                  .sort((a, b) => b[1].length - a[1].length)
                  .map(([lobby, items]) => ({ lobby, items }));
                if (orphans.length) groups.push({ lobby: null, items: orphans });
                return groups;
              })()
              : [{ lobby: null, items: col }];

            return (
              <div
                key={status}
                className={`relative rounded-xl border ${meta.accent} bg-black/30 overflow-hidden flex flex-col`}
              >
                {/* Column header */}
                <div className={`relative bg-gradient-to-r ${meta.bar} px-3 py-2.5 border-b border-white/[0.06] flex items-center gap-2`}>
                  <p className="text-[14px] font-semibold tracking-tight text-white">
                    {meta.label}
                  </p>
                  <span className="ml-auto font-mono text-[12px] tabular-nums text-white/65 px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/10">
                    {col.length}
                  </span>
                </div>

                {/* Column body */}
                <div className="p-2 space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto custom-scroll">
                  {col.length === 0 ? (
                    <p className="text-center py-8 font-mono text-[11px] uppercase tracking-widest text-white/20">
                      vide
                    </p>
                  ) : (
                    grouped.map((group, gIdx) => (
                      <div key={group.lobby ?? `orphan-${gIdx}`} className="space-y-2">
                        {groupByLobby && group.lobby && (
                          <div className="flex items-center gap-1.5 px-1.5 pt-1">
                            <span className="font-mono text-[11px] uppercase tracking-wider text-white/30">▣</span>
                            <span className="font-mono text-[11px] font-bold tracking-widest text-white/65">
                              {group.lobby}
                            </span>
                            <span className="font-mono text-[11px] tabular-nums text-white/30">×{group.items.length}</span>
                            <div className="flex-1 h-px bg-white/[0.05]" />
                          </div>
                        )}
                        {group.items.map((t) => (
                          <TicketCard
                            key={t.id}
                            ticket={t}
                            isSelected={selected.has(t.id)}
                            isHot={!!t.lobby_code && (lobbyCounts[t.lobby_code] || 0) >= 2}
                            onOpen={() => setOpenTicketId(t.id)}
                            onToggleSelect={() => toggleSelect(t.id)}
                            onStatusChange={(s) => handleStatusChange(t.id, s)}
                            onDelete={() => requestDelete(t.id)}
                          />
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {openTicket && (
        <TicketDetailModal
          ticket={openTicket}
          onClose={() => setOpenTicketId(null)}
          onStatusChange={(s) => handleStatusChange(openTicket.id, s)}
          onDelete={() => requestDelete(openTicket.id)}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={pendingDelete.kind === 'single'
            ? 'Supprimer ce ticket ?'
            : `Supprimer ${pendingDelete.ids.length} ticket${pendingDelete.ids.length > 1 ? 's' : ''} ?`}
          message="Action irréversible. Les données seront effacées définitivement."
          confirmLabel="Supprimer"
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
};

// =====================================================================
// Confirm dialog (replaces window.confirm - Studio styled)
// =====================================================================
const ConfirmDialog = ({
  title, message, confirmLabel, onConfirm, onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, onConfirm]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl border border-red-400/30 bg-gradient-to-b from-[#171018] to-[#0d1018] shadow-[0_30px_80px_-20px_rgba(248,113,113,0.25)] p-5 space-y-4"
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-400" />
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-red-200">danger zone</p>
        </div>
        <div>
          <h3 className="text-[16px] font-semibold tracking-tight text-white">{title}</h3>
          <p className="mt-1 text-[13px] text-white/55">{message}</p>
        </div>
        <div className="flex items-center gap-2 justify-end pt-1">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-md border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-white/75 hover:text-white font-mono text-[11px] uppercase tracking-wider transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            autoFocus
            className="px-3 py-1.5 rounded-md border border-red-400/50 bg-red-500/20 hover:bg-red-500/35 text-red-100 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors"
          >
            ✕ {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// =====================================================================
// Lobbies live - read-only with auto-refresh
// =====================================================================
const LOBBIES_REFRESH_MS = 5000;

const PHASE_META: Record<AdminLobbySummary['phase'], { label: string; pill: string; dot: string }> = {
  lobby: {
    label: 'Salon',
    pill: 'bg-sky-400/10 border-sky-300/40 text-sky-100',
    dot: 'bg-sky-400',
  },
  playing: {
    label: 'En partie',
    pill: 'bg-emerald-400/10 border-emerald-300/40 text-emerald-100',
    dot: 'bg-emerald-400 animate-pulse',
  },
  ended: {
    label: 'Terminé',
    pill: 'bg-white/[0.05] border-white/15 text-white/60',
    dot: 'bg-white/40',
  },
};

const formatAge = (ms: number): string => {
  const diff = Math.max(0, Date.now() - ms);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'maintenant';
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  const d = Math.floor(h / 24);
  return `il y a ${d}j`;
};

const summarizeDecks = (selectedDecks: AdminLobbySummary['selectedDecks']): string => {
  const parts: string[] = [];
  let total = 0;
  for (const [category, themes] of Object.entries(selectedDecks)) {
    if (!themes || themes.length === 0) continue;
    total += themes.length;
    parts.push(`${category} (${themes.length})`);
  }
  if (total === 0) return 'aucun deck';
  return parts.slice(0, 3).join(' · ') + (parts.length > 3 ? ` +${parts.length - 3}` : '');
};

const LobbyCard = ({ lobby }: { lobby: AdminLobbySummary }) => {
  const phase = PHASE_META[lobby.phase];
  return (
    <div className="relative rounded-lg border border-white/[0.07] hover:border-white/15 bg-gradient-to-b from-white/[0.035] to-white/[0.01] transition-colors p-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-[15px] font-bold tracking-[0.18em] text-white">{lobby.code}</span>
        <span className={`px-1.5 py-0.5 rounded border font-mono text-[11px] uppercase tracking-wider inline-flex items-center gap-1.5 ${phase.pill}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${phase.dot}`} />
          {phase.label}
        </span>
        <span className="font-mono text-[11px] uppercase tracking-wider text-white/40">
          {lobby.gameMode === 'remote' ? 'à distance' : 'local'}
        </span>
        {lobby.guessMyAnswerMode && (
          <span className="px-1.5 py-0.5 rounded border border-violet-300/40 bg-violet-400/[0.08] text-violet-100 font-mono text-[11px] uppercase tracking-wider">
            devine ma réponse
          </span>
        )}
        <span className="ml-auto font-mono text-[11px] text-white/40 whitespace-nowrap">
          {formatAge(lobby.lastActivity)}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2 text-[12px]">
        <span className="font-mono text-[11px] uppercase tracking-wider text-white/35">joueurs</span>
        <span className="font-mono tabular-nums text-white/75">
          {lobby.activePlayerCount}/{lobby.playerCount}
        </span>
        {lobby.phase === 'playing' && lobby.currentRound !== null && (
          <>
            <span className="text-white/15">·</span>
            <span className="font-mono text-[11px] uppercase tracking-wider text-white/35">round</span>
            <span className="font-mono tabular-nums text-white/75">
              {lobby.currentRound}{lobby.totalRounds ? `/${lobby.totalRounds}` : ''}
            </span>
          </>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {lobby.players.map((p, i) => (
          <span
            key={`${p.name}-${i}`}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border font-mono text-[11px] ${p.isActive
              ? 'border-white/15 bg-white/[0.04] text-white/80'
              : 'border-white/[0.06] bg-white/[0.02] text-white/30 line-through'
              }`}
            title={p.isActive ? 'actif' : 'déconnecté'}
          >
            {p.isHost && <span className="text-amber-300/80" title="hôte">★</span>}
            <span>{p.name}</span>
          </span>
        ))}
      </div>

      <div className="mt-2 font-mono text-[11px] text-white/40 truncate" title={summarizeDecks(lobby.selectedDecks)}>
        <span className="text-white/25">decks </span>{summarizeDecks(lobby.selectedDecks)}
      </div>
    </div>
  );
};

const LobbiesPanel = ({ active, refreshKey }: { active: boolean; refreshKey: number }) => {
  const [lobbies, setLobbies] = useState<AdminLobbySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const showToast = useToast();

  const load = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const data = await fetchAdminLobbies();
      setLobbies(data);
      setLastFetch(Date.now());
    } catch (err) {
      if (!silent) showToast(err instanceof Error ? err.message : 'Erreur', 'error');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (!active) return;
    load();
    const id = setInterval(() => load(true), LOBBIES_REFRESH_MS);
    return () => clearInterval(id);
  }, [active, load]);

  // Reload manuel déclenché depuis le masthead.
  useEffect(() => {
    if (!active || refreshKey === 0) return;
    load();
  }, [refreshKey, active, load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return lobbies;
    return lobbies.filter((l) =>
      l.code.toLowerCase().includes(q) ||
      l.players.some((p) => p.name.toLowerCase().includes(q))
    );
  }, [lobbies, search]);

  const stats = useMemo(() => {
    const playing = lobbies.filter((l) => l.phase === 'playing').length;
    const players = lobbies.reduce((acc, l) => acc + l.activePlayerCount, 0);
    return { total: lobbies.length, playing, players };
  }, [lobbies]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className={`${CLUSTER} flex-1 min-w-[200px] max-w-md`}>
          <Icon icon="mdi:magnify" className="w-4 h-4 text-white/35 ml-0.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="rechercher par code ou pseudo"
            className="flex-1 bg-transparent border-0 outline-0 text-[12px] text-white/85 placeholder:text-white/25 font-mono"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-white/30 hover:text-white text-[12px] px-1"
            >×</button>
          )}
        </div>

        <div className={CLUSTER}>
          <span className="font-mono text-[11px] uppercase tracking-wider text-white/40 px-1">
            {stats.total} salon{stats.total > 1 ? 's' : ''} · {stats.playing} en partie · {stats.players} joueurs
          </span>
        </div>

        <span className="font-mono text-[11px] text-white/30">
          {lastFetch ? `maj ${formatAge(lastFetch)}` : '…'} · refresh auto 5s
        </span>
      </div>

      {isLoading && lobbies.length === 0 ? (
        <div className="text-center py-20 font-mono text-[11px] uppercase tracking-[0.3em] text-white/30">
          chargement…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-white/30">
            {lobbies.length === 0 ? 'aucun lobby actif' : 'aucun résultat'}
          </p>
          {lobbies.length === 0 && (
            <p className="text-[12px] text-white/40">Les salons apparaissent ici dès qu'un joueur en crée un.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((lobby) => (
            <LobbyCard key={lobby.code} lobby={lobby} />
          ))}
        </div>
      )}
    </div>
  );
};

// =====================================================================
// Decks - read-only catalog from questions.json
// =====================================================================
interface CategoryStyle {
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

const categoryStyle = (category: string): CategoryStyle =>
  CATEGORY_PALETTE[category] ?? FALLBACK_PALETTE;

const deckKey = (d: { category: string; theme: string }) => `${d.category}-${d.theme}`;

const SubjectCard = ({
  subject, palette, collapsed,
}: {
  subject: AdminDeckSummary['subjects'][number];
  palette: CategoryStyle;
  collapsed: boolean;
}) => {
  const hasQuestions = subject.questions.length > 0;
  return (
    <div className="group relative rounded-lg border border-white/[0.07] hover:border-white/15 bg-black/20 transition-colors overflow-hidden">
      {/* Strip vertical gauche - couleur de catégorie */}
      <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${palette.strip}`} />
      <div className={`flex items-center gap-2 px-3 py-2 pl-4 bg-white/[0.015] rounded-tr-lg ${collapsed ? 'rounded-br-lg' : 'border-b border-white/[0.05]'}`}>
        <span className="text-[13px] text-white/90 font-medium truncate" title={subject.subject}>
          {subject.subject}
        </span>
      </div>

      {collapsed ? (
        <>
          {hasQuestions && (
            <div
              role="tooltip"
              className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-30 w-[min(420px,90vw)] opacity-0 invisible translate-y-1 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 transition-all duration-150 ease-out"
            >
              <div className="relative rounded-lg border border-white/15 bg-[#13161e]/98 backdrop-blur-md shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] overflow-hidden">
                <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${palette.strip}`} />
                <div className="px-3 py-2 pl-4 border-b border-white/[0.06]">
                  <span className="text-[12.5px] text-white/85 font-medium truncate">
                    {subject.subject}
                  </span>
                </div>
                <ol className="px-3 py-2.5 space-y-1.5 max-h-[60vh] overflow-y-auto custom-scroll">
                  {subject.questions.map((q, i) => (
                    <li key={i} className="flex gap-2 text-[12.5px] text-white/85 leading-snug">
                      <span className="font-mono text-[11px] tabular-nums text-white/30 mt-0.5 shrink-0 w-5 text-right">
                        {i + 1}.
                      </span>
                      <span className="whitespace-pre-wrap break-words">{q}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </>
      ) : !hasQuestions ? (
        <p className="px-3 py-3 text-[11px] text-white/25 italic rounded-b-lg">aucune question</p>
      ) : (
        <ol className="px-3 py-2.5 space-y-1.5 rounded-b-lg">
          {subject.questions.map((q, i) => (
            <li key={i} className="flex gap-2 text-[12.5px] text-white/80 leading-snug">
              <span className="font-mono text-[11px] tabular-nums text-white/25 mt-0.5 shrink-0 w-5 text-right">
                {i + 1}.
              </span>
              <span className="whitespace-pre-wrap break-words">{q}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};

const DeckRailItem = ({
  deck, palette, selected, onSelect,
}: {
  deck: AdminDeckSummary;
  palette: CategoryStyle;
  selected: boolean;
  onSelect: () => void;
}) => (
  <button
    onClick={onSelect}
    className={`group relative w-full flex items-center gap-2 pl-3 pr-2.5 py-1.5 rounded-md border transition-colors text-left ${selected
      ? `bg-white/[0.08] border-white/15 ring-1 ${palette.ring}`
      : 'bg-transparent border-transparent hover:bg-white/[0.04]'
      }`}
  >
    <span className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full ${palette.strip} ${selected ? '' : 'opacity-60 group-hover:opacity-100'} transition-opacity`} />
    <span className={`text-[12.5px] truncate flex-1 ${selected ? 'text-white' : 'text-white/75 group-hover:text-white/95'}`} title={deck.theme}>
      {deck.theme}
    </span>
    <span className="font-mono text-[11px] tabular-nums text-white/40" title={`${deck.subjectCount} sujet${deck.subjectCount > 1 ? 's' : ''}`}>
      {deck.subjectCount}
    </span>
  </button>
);

const DeckDetail = ({
  deck, questionsCollapsed, onToggleCollapse,
}: {
  deck: AdminDeckSummary;
  questionsCollapsed: boolean;
  onToggleCollapse: () => void;
}) => {
  const palette = categoryStyle(deck.category);
  return (
    <div className="rounded-xl border border-white/[0.07] bg-gradient-to-b from-white/[0.025] to-transparent overflow-hidden">
      <div className="relative px-5 py-4 border-b border-white/[0.06]">
        <div className="flex items-baseline gap-2.5 flex-wrap">
          <span className={`px-1.5 py-0.5 rounded border font-mono text-[11px] uppercase tracking-wider ${palette.chip}`}>
            {deck.category}
          </span>
          <h2 className="text-[22px] font-semibold tracking-tight text-white leading-none">
            {deck.theme}
          </h2>
          <span className="text-[12px] text-white/55 ml-auto">
            <span className={palette.text}>{deck.subjectCount}</span> sujet{deck.subjectCount > 1 ? 's' : ''}
          </span>
          <button
            onClick={onToggleCollapse}
            className="px-2.5 py-1 rounded-md border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-white/75 hover:text-white text-[12px] transition-colors inline-flex items-center gap-1.5"
            title={questionsCollapsed ? 'Afficher les questions de tous les sujets' : 'Cacher les questions (survoler un sujet pour les voir)'}
          >
            <Icon icon={questionsCollapsed ? 'mdi:eye-outline' : 'mdi:eye-off-outline'} className="w-3.5 h-3.5" />
            {questionsCollapsed ? 'Afficher les questions' : 'Cacher les questions'}
          </button>
        </div>
        <div className={`absolute left-0 right-0 bottom-0 h-px bg-gradient-to-r ${palette.glow}`} />
      </div>

      <div className="p-4">
        {deck.subjects.length === 0 ? (
          <p className="text-center py-10 font-mono text-[11px] uppercase tracking-[0.3em] text-white/25">
            aucun sujet
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {deck.subjects.map((s) => (
              <SubjectCard key={s.subject} subject={s} palette={palette} collapsed={questionsCollapsed} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const DecksPanel = ({ active }: { active: boolean }) => {
  const [decks, setDecks] = useState<AdminDeckSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [questionsCollapsed, setQuestionsCollapsed] = useState(true);
  const showToast = useToast();

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchAdminDecks();
      setDecks(data);
      setLoaded(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (active && !loaded) load();
  }, [active, loaded, load]);

  const totals = useMemo(() => {
    const categories = new Set<string>();
    let subjects = 0;
    let questions = 0;
    for (const d of decks) {
      categories.add(d.category);
      subjects += d.subjectCount;
      questions += d.questionCount;
    }
    return {
      categories: categories.size,
      themes: decks.length,
      subjects,
      questions,
    };
  }, [decks]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    decks.forEach((d) => set.add(d.category));
    return Array.from(set).sort();
  }, [decks]);

  const filtered = useMemo<AdminDeckSummary[]>(() => {
    const q = search.trim().toLowerCase();
    const byCategory = decks.filter((d) => !categoryFilter || d.category === categoryFilter);
    if (!q) return byCategory;
    const result: AdminDeckSummary[] = [];
    for (const d of byCategory) {
      const subjects: AdminDeckSummary['subjects'] = [];
      let questionCount = 0;
      for (const s of d.subjects) {
        const subjectMatch = s.subject.toLowerCase().includes(q);
        const questions = subjectMatch
          ? s.questions
          : s.questions.filter((qu) => qu.toLowerCase().includes(q));
        if (subjectMatch || questions.length > 0) {
          subjects.push({ ...s, questions });
          questionCount += questions.length;
        }
      }
      if (subjects.length > 0) {
        result.push({ ...d, subjects, subjectCount: subjects.length, questionCount });
      }
    }
    return result;
  }, [decks, search, categoryFilter]);

  // Groupes par catégorie pour le rail, en préservant l'ordre d'apparition des catégories.
  const grouped = useMemo(() => {
    const map = new Map<string, AdminDeckSummary[]>();
    for (const d of filtered) {
      const arr = map.get(d.category) ?? [];
      arr.push(d);
      map.set(d.category, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  // Auto-select first available when filter/list changes.
  useEffect(() => {
    if (filtered.length === 0) {
      if (selectedKey !== null) setSelectedKey(null);
      return;
    }
    const stillVisible = selectedKey && filtered.some((d) => deckKey(d) === selectedKey);
    if (!stillVisible) {
      setSelectedKey(deckKey(filtered[0]));
    }
  }, [filtered, selectedKey]);

  const selectedDeck = useMemo(
    () => filtered.find((d) => deckKey(d) === selectedKey) ?? null,
    [filtered, selectedKey],
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Catégories" value={totals.categories} accent="amber" />
        <StatTile label="Thèmes" value={totals.themes} accent="sky" />
        <StatTile label="Sujets" value={totals.subjects} accent="violet" />
        <StatTile label="Questions" value={totals.questions} accent="emerald" />
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className={`${CLUSTER} flex-1 min-w-[200px] max-w-md`}>
          <Icon icon="mdi:magnify" className="w-4 h-4 text-white/35 ml-0.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="rechercher sujet ou question"
            className="flex-1 bg-transparent border-0 outline-0 text-[12px] text-white/85 placeholder:text-white/25 font-mono"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-white/30 hover:text-white text-[12px] px-1"
            >×</button>
          )}
        </div>

        {categories.length > 0 && (
          <div className={CLUSTER}>
            <button
              onClick={() => setCategoryFilter('')}
              className={`px-2 py-0.5 rounded font-mono text-[11px] uppercase tracking-wider transition-colors ${!categoryFilter ? 'bg-white/[0.08] text-white' : 'text-white/45 hover:text-white/80'
                }`}
            >toutes</button>
            {categories.map((c) => {
              const palette = categoryStyle(c);
              const isActive = categoryFilter === c;
              return (
                <button
                  key={c}
                  onClick={() => setCategoryFilter(c)}
                  className={`inline-flex items-center px-2 py-0.5 rounded font-mono text-[11px] uppercase tracking-wider transition-colors ${isActive
                    ? `bg-white/[0.08] ${palette.text}`
                    : `${palette.text} opacity-50 hover:opacity-90`
                    }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {isLoading && decks.length === 0 ? (
        <div className="text-center py-20 font-mono text-[11px] uppercase tracking-[0.3em] text-white/30">
          chargement…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 font-mono text-[11px] uppercase tracking-[0.3em] text-white/30">
          {decks.length === 0 ? 'aucun deck' : 'aucun résultat'}
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-3">
          {/* Rail */}
          <aside className="md:w-72 shrink-0">
            <div className="rounded-xl border border-white/[0.07] bg-gradient-to-b from-white/[0.02] to-transparent overflow-hidden">
              <div className="max-h-[calc(100vh-360px)] md:max-h-[calc(100vh-300px)] overflow-y-auto custom-scroll p-2 space-y-3">
                {grouped.map(([category, items]) => {
                  const palette = categoryStyle(category);
                  return (
                    <div key={category} className="space-y-1">
                      <div className="sticky top-0 z-10 -mx-2 px-3 py-1.5 bg-[#0d1018]/95 backdrop-blur flex items-center gap-2 border-b border-white/[0.05]">
                        <span className={`font-mono text-[11px] uppercase tracking-[0.22em] font-bold ${palette.text}`}>
                          {category}
                        </span>
                        <span className="ml-auto font-mono text-[11px] tabular-nums text-white/30">
                          {items.length}
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        {items.map((d) => {
                          const k = deckKey(d);
                          return (
                            <DeckRailItem
                              key={k}
                              deck={d}
                              palette={palette}
                              selected={k === selectedKey}
                              onSelect={() => setSelectedKey(k)}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* Detail */}
          <section className="flex-1 min-w-0">
            {selectedDeck ? (
              <DeckDetail
                deck={selectedDeck}
                questionsCollapsed={questionsCollapsed && !search.trim()}
                onToggleCollapse={() => setQuestionsCollapsed((v) => !v)}
              />
            ) : (
              <div className="rounded-xl border border-white/[0.07] bg-gradient-to-b from-white/[0.02] to-transparent text-center py-20 font-mono text-[11px] uppercase tracking-[0.3em] text-white/30">
                sélectionne un thème
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

// =====================================================================
// Content - read-only catalog of fixed in-game text & data
// =====================================================================
type ContentSection = 'tiers' | 'funfacts' | 'achievements' | 'avatars' | 'legal' | 'constants';

const CONTENT_SECTIONS: { id: ContentSection; label: string; hint: string }[] = [
  { id: 'tiers', label: 'Paliers de score', hint: 'verdict de fin de partie' },
  { id: 'funfacts', label: 'Saviez-vous', hint: 'faits insolites' },
  { id: 'achievements', label: 'Succès', hint: 'badges du joueur' },
  { id: 'avatars', label: 'Avatars', hint: 'galerie' },
  { id: 'legal', label: 'Légal', hint: 'pages publiques' },
  { id: 'constants', label: 'Réglages', hint: 'durées & limites' },
];

const PHASE_LABELS_FR: Record<string, string> = {
  QUESTION_SELECTION: 'Sélection de la question',
  SUBSTITUTE_SELECTION: 'Sélection du devineur de pilier',
  ANSWERING: 'Réponse des joueurs',
  SUBSTITUTE_ANSWERING: 'Réponse du devineur de pilier',
  GUESSING: 'Devinette',
};

const SectionHeader = ({ title, hint, count }: { title: string; hint?: string; count?: number }) => (
  <div className="flex items-baseline gap-2.5 mb-3">
    <h2 className="text-[18px] font-semibold tracking-tight text-white">{title}</h2>
    {typeof count === 'number' && (
      <span className="font-mono text-[11px] tabular-nums text-white/40 px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/10">
        {count}
      </span>
    )}
    {hint && (
      <span className="text-[12px] text-white/35 ml-auto italic">
        {hint}
      </span>
    )}
  </div>
);

const TiersSection = () => (
  <div>
    <SectionHeader title="Paliers de score" count={TIERS.length} />
    <p className="text-[13px] text-white/55 mb-4 max-w-2xl">
      Le verdict affiché en fin de partie selon le pourcentage de l'équipe. Un message est tiré au sort dans la liste du palier atteint.
    </p>
    <div className="space-y-2.5">
      {TIERS.map((tier, idx) => {
        const prev = idx === 0 ? 0 : TIERS[idx - 1].max + 1;
        return (
          <div
            key={idx}
            className="rounded-lg border border-white/[0.07] bg-gradient-to-b from-white/[0.025] to-transparent overflow-hidden"
          >
            <div className="relative px-4 py-3 border-b border-white/[0.05] flex items-center gap-3">
              <div
                aria-hidden
                className="absolute left-0 top-0 bottom-0 w-[3px]"
                style={{ backgroundColor: tier.color }}
              />
              <Icon icon={tier.icon} className="w-7 h-7 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold tracking-tight text-white truncate">
                  {tier.title}
                </p>
                <p className="text-[12px] text-white/45">
                  de {prev}% à {tier.max}%
                </p>
              </div>
              <span
                aria-hidden
                className="w-5 h-5 rounded-full border border-white/15 shrink-0"
                style={{ backgroundColor: tier.color }}
              />
            </div>
            <ol className="px-4 py-3 space-y-1.5">
              {tier.messages.map((m, i) => (
                <li key={i} className="flex gap-2 text-[13px] text-white/85 leading-snug">
                  <span className="font-mono text-[11px] tabular-nums text-white/25 mt-0.5 shrink-0 w-5 text-right">
                    {i + 1}.
                  </span>
                  <span className="whitespace-pre-wrap break-words">{m}</span>
                </li>
              ))}
            </ol>
          </div>
        );
      })}
    </div>
  </div>
);

const FunFactsSection = () => (
  <div>
    <SectionHeader title="Saviez-vous" count={FUN_FACTS.length} />
    <p className="text-[13px] text-white/55 mb-4 max-w-2xl">
      Affichés en rotation pendant les phases d'attente pour faire patienter les joueurs.
    </p>
    <div className="rounded-lg border border-white/[0.07] bg-gradient-to-b from-white/[0.025] to-transparent overflow-hidden">
      <ol>
        {FUN_FACTS.map((f, i) => (
          <li
            key={i}
            className="flex gap-3 px-4 py-2.5 border-b border-white/[0.04] last:border-b-0 text-[13px] text-white/85 leading-snug"
          >
            <span className="font-mono text-[11px] tabular-nums text-white/30 shrink-0 w-6 text-right mt-0.5">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="whitespace-pre-wrap break-words">{f}</span>
          </li>
        ))}
      </ol>
    </div>
  </div>
);

const AchievementsSection = () => (
  <div>
    <SectionHeader title="Succès" count={ACHIEVEMENTS.length} />
    <p className="text-[13px] text-white/55 mb-4 max-w-2xl">
      Badges débloqués par le joueur en fin de partie, sauvegardés sur son appareil.
    </p>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
      {ACHIEVEMENTS.map((a) => (
        <div
          key={a.id}
          className="rounded-lg border border-white/[0.07] bg-gradient-to-b from-white/[0.025] to-transparent p-3 flex items-start gap-3"
        >
          <Icon icon={a.icon} className="w-9 h-9 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-white truncate">{a.title}</p>
            <p className="text-[12.5px] text-white/65 leading-snug mt-0.5">
              {a.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const AvatarsSection = () => (
  <div>
    <SectionHeader title="Avatars" count={AVATARS.length} />
    <p className="text-[13px] text-white/55 mb-4 max-w-2xl">
      Le casting visuel disponible pour les joueurs.
    </p>
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
      {AVATARS.map((a) => (
        <div
          key={a.id}
          className="rounded-lg border border-white/[0.07] bg-gradient-to-b from-white/[0.025] to-transparent overflow-hidden"
        >
          <div className="aspect-square bg-black/30 flex items-center justify-center">
            <img
              src={getAvatarUrl(a.id)}
              alt={`Avatar ${a.id + 1}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
          <div className="px-2 py-1.5 border-t border-white/[0.05] flex items-center justify-between">
            <span className="text-[12px] text-white/65">Avatar {a.id + 1}</span>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const LEGAL_LABELS_FR: Record<string, string> = {
  about: 'À propos',
  mentions: 'Mentions légales',
  privacy: 'Politique de confidentialité',
  contact: 'Nous contacter',
};

const LegalSection = () => {
  const entries = Object.entries(LEGAL_CONTENT) as Array<[
    keyof typeof LEGAL_CONTENT,
    typeof LEGAL_CONTENT[keyof typeof LEGAL_CONTENT],
  ]>;
  return (
    <div>
      <SectionHeader title="Contenu légal" count={entries.length} />
      <p className="text-[13px] text-white/55 mb-4 max-w-2xl">
        Textes affichés depuis le pied de page du site : À propos, Mentions légales, Confidentialité et Contact.
      </p>
      <div className="space-y-3">
        {entries.map(([key, block]) => {
          const sections = 'sections' in block ? block.sections : [];
          return (
            <div
              key={key}
              className="rounded-lg border border-white/[0.07] bg-gradient-to-b from-white/[0.025] to-transparent overflow-hidden"
            >
              <div className="px-4 py-2.5 border-b border-white/[0.05] flex items-baseline gap-2">
                <p className="text-[15px] font-semibold tracking-tight text-white">
                  {LEGAL_LABELS_FR[key] ?? block.title}
                </p>
                {sections.length > 0 && (
                  <span className="ml-auto text-[12px] text-white/40">
                    {sections.length} rubrique{sections.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {sections.length === 0 ? (
                <p className="px-4 py-3 text-[12.5px] text-white/40 italic">
                  Aucun texte (la page renvoie vers un formulaire de contact).
                </p>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {sections.map((s, i) => (
                    <div key={i} className="px-4 py-3">
                      <p className="text-[13px] font-semibold text-amber-200/90 mb-1.5">
                        {s.title}
                      </p>
                      <div
                        className="text-[13px] text-white/80 leading-relaxed [&_a]:text-sky-300 [&_a]:underline [&_strong]:text-white"
                        dangerouslySetInnerHTML={{ __html: s.content }}
                      />
                      {'list' in s && Array.isArray(s.list) && (
                        <ul className="mt-2 space-y-1">
                          {s.list.map((li, j) => (
                            <li key={j} className="flex gap-2 text-[12.5px] text-white/70 leading-snug">
                              <span className="text-white/30 shrink-0">·</span>
                              <span>{li}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {'extra' in s && s.extra && (
                        <div
                          className="mt-2 text-[12.5px] text-white/60 leading-snug [&_a]:text-sky-300 [&_a]:underline"
                          dangerouslySetInnerHTML={{ __html: s.extra }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ConstantsSection = () => {
  const timers = GAME_CONSTANTS.TIMERS;
  const [guessPlayers, setGuessPlayers] = useState(3);
  const guessSeconds = 120 + Math.max(0, guessPlayers - 3) * 20;
  const toMinSec = (s: number): string | null => {
    if (s < 60) return null;
    const m = Math.floor(s / 60);
    const r = s % 60;
    return r === 0 ? `${m} min` : `${m} min ${r} s`;
  };
  return (
    <div>
      <SectionHeader title="Réglages de jeu" />
      <p className="text-[13px] text-white/55 mb-4 max-w-2xl">
        Les durées de chaque phase et les limites appliquées aux parties.
      </p>

      <div className="space-y-4">
        <div>
          <p className="text-[12px] uppercase tracking-[0.18em] text-white/40 mb-2 font-semibold">
            Durée de chaque phase
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {Object.entries(timers).map(([phase, seconds]) => {
              const isGuessing = phase === 'GUESSING';
              return (
                <div
                  key={phase}
                  className="rounded-lg border border-white/[0.07] bg-gradient-to-b from-white/[0.025] to-transparent p-3"
                >
                  <p className="text-[12px] text-white/55">
                    {PHASE_LABELS_FR[phase] ?? phase}
                  </p>
                  {isGuessing ? (
                    <>
                      <p className="mt-1 text-[20px] font-semibold tabular-nums text-white">
                        {guessSeconds} secondes
                        {toMinSec(guessSeconds) && (
                          <span className="ml-2 text-[13px] font-normal text-white/40">
                            ({toMinSec(guessSeconds)})
                          </span>
                        )}
                      </p>
                      <p className="text-[12px] text-white/55 mt-0.5">
                        120 s + 20 s par joueur au-delà de 3
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          id="guess-slider"
                          type="range"
                          min={GAME_CONSTANTS.MIN_PLAYERS}
                          max={GAME_CONSTANTS.MAX_PLAYERS}
                          step={1}
                          value={guessPlayers}
                          onChange={(e) => setGuessPlayers(Number(e.target.value))}
                          aria-label="Simuler le nombre de joueurs"
                          className="admin-mini-slider flex-1 cursor-pointer"
                        />
                        <span className="text-[10px] tabular-nums text-white/45 w-14 text-right">
                          {guessPlayers} joueur{guessPlayers > 1 ? 's' : ''}
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="mt-1 text-[20px] font-semibold tabular-nums text-white">
                      {seconds} secondes
                      {toMinSec(seconds) && (
                        <span className="ml-2 text-[13px] font-normal text-white/40">
                          ({toMinSec(seconds)})
                        </span>
                      )}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-[12px] uppercase tracking-[0.18em] text-white/40 mb-2 font-semibold">
            Limites
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {[
              { label: 'Nombre de joueurs', value: `${GAME_CONSTANTS.MIN_PLAYERS} à ${GAME_CONSTANTS.MAX_PLAYERS}` },
              { label: 'Longueur du pseudo', value: `${GAME_CONSTANTS.MIN_NAME_LENGTH} à ${GAME_CONSTANTS.MAX_NAME_LENGTH} caractères` },
              { label: 'Longueur d\'une réponse', value: `${GAME_CONSTANTS.MAX_ANSWER_LENGTH} caractères max` },
              { label: 'Avatars disponibles', value: `${GAME_CONSTANTS.AVATAR_COUNT}` },
              { label: 'Relances par carte', value: `${GAME_CONSTANTS.DEFAULT_CARD_RELANCES}` },
              { label: 'Longueur du code de salon', value: `${GAME_CONSTANTS.LOBBY_CODE_LENGTH} caractères` },
            ].map((row) => (
              <div
                key={row.label}
                className="rounded-lg border border-white/[0.07] bg-gradient-to-b from-white/[0.025] to-transparent p-3"
              >
                <p className="text-[12px] text-white/55">
                  {row.label}
                </p>
                <p className="mt-1 text-[16px] font-semibold tabular-nums text-white">
                  {row.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const ContentPanel = () => {
  const [section, setSection] = useState<ContentSection>('tiers');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-1.5">
        {CONTENT_SECTIONS.map((s) => {
          const active = section === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`px-2.5 py-1 rounded-md border font-mono text-[11px] uppercase tracking-wider transition-colors ${active
                ? 'bg-white/[0.08] border-white/15 text-white'
                : 'bg-transparent border-white/[0.06] text-white/45 hover:text-white/85 hover:border-white/15'
                }`}
              title={s.hint}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <div>
        {section === 'tiers' && <TiersSection />}
        {section === 'funfacts' && <FunFactsSection />}
        {section === 'achievements' && <AchievementsSection />}
        {section === 'avatars' && <AvatarsSection />}
        {section === 'legal' && <LegalSection />}
        {section === 'constants' && <ConstantsSection />}
      </div>
    </div>
  );
};

// =====================================================================
// Stats - link to Umami dashboard
// =====================================================================
const StatsPanel = () => (
  <div className="space-y-4">
    <div className="relative rounded-xl border border-white/[0.07] bg-gradient-to-b from-white/[0.03] to-transparent p-6 overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 11px, rgba(255,255,255,0.5) 11px 12px)',
          maskImage: 'linear-gradient(180deg, black 0%, transparent 90%)',
        }}
      />
      <div className="relative">
        <div className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.22em] text-sky-200/80 border border-sky-300/40 bg-sky-500/[0.08] rounded px-1.5 py-0.5 mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
          analytics
        </div>
        <h2 className="text-[22px] font-semibold tracking-tight text-white mb-1">Trafic & visiteurs</h2>
        <p className="text-[13px] text-white/55 max-w-xl mb-5">
          Le trafic, les visiteurs uniques et les sources sont suivis via Umami (privacy-friendly, sans cookie).
        </p>
        <a
          href="https://stats.onskone.fr/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-mono text-[12px] font-bold uppercase tracking-wider bg-gradient-to-br from-sky-300 to-sky-500 text-black shadow-[0_2px_0_0_rgba(0,0,0,0.4),0_0_20px_rgba(125,211,240,0.35)] hover:shadow-[0_2px_0_0_rgba(0,0,0,0.4),0_0_28px_rgba(125,211,240,0.55)] hover:-translate-y-px active:translate-y-0 transition-all"
        >
          → Ouvrir le dashboard Umami
        </a>
      </div>
    </div>

    <div className="rounded-lg border border-white/[0.07] bg-gradient-to-b from-white/[0.02] to-transparent p-5">
      <div className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.22em] text-amber-200/80 border border-amber-300/40 bg-amber-500/[0.08] rounded px-1.5 py-0.5 mb-3">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        bientôt
      </div>
      <p className="text-[13px] text-white/55 max-w-xl">
        Les stats de jeu (parties terminées, durée moyenne, top decks, taux de complétion) arriveront ici plus tard, persistées côté serveur.
      </p>
    </div>
  </div>
);

// =====================================================================
// Dashboard shell
// =====================================================================
const Dashboard = ({ onLogout }: { onLogout: () => void }) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [lobbyCount, setLobbyCount] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const showToast = useToast();
  const ranOnce = useRef(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setRefreshKey((k) => k + 1); // déclenche aussi le reload des panels actifs (lobbies)
    try {
      const [ticketsData, lobbiesData] = await Promise.all([
        fetchTickets(),
        fetchAdminLobbies().catch(() => null),
      ]);
      setTickets(ticketsData);
      if (lobbiesData) setLobbyCount(lobbiesData.length);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur', 'error');
      if (err instanceof Error && err.message.includes('Session')) onLogout();
    } finally {
      setIsLoading(false);
    }
  }, [showToast, onLogout]);

  useEffect(() => {
    if (ranOnce.current) return;
    ranOnce.current = true;
    load();
  }, [load]);

  // Compteur de salons live affiché dans le masthead (poll 5s, silencieux).
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const data = await fetchAdminLobbies();
        if (!cancelled) setLobbyCount(data.length);
      } catch { /* silent */ }
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const jumpToTickets = useCallback((_status?: TicketStatus, _type?: TicketType) => {
    setActiveTab('tickets');
  }, []);

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
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.35) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          maskImage: 'radial-gradient(ellipse at top, black 30%, transparent 75%)',
        }}
      />

      {/* Sticky header - masthead éditorial */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-[#0a0c12]/85 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 pt-5 pb-3">
          {/* Ligne 1 : masthead */}
          <div className="flex items-center gap-2">
            <span className="text-amber-400 text-[15px] leading-none">▍</span>
            <span className="font-mono text-[14px] text-white/85 lowercase tracking-tight leading-none">
              onskoné
            </span>
            <span className="font-mono text-[14px] text-white/25 leading-none">/</span>
            <span className="font-mono text-[14px] font-bold text-amber-200 uppercase tracking-[0.12em] leading-none">
              admin
            </span>

            {/* CTA principal : voir salons live (signal vivant, garde le focus) */}
            <button
              onClick={() => setActiveTab('lobbies')}
              className={`ml-auto cursor-pointer flex items-center gap-2 px-2.5 py-1 rounded-md border transition-colors font-mono text-[10px] uppercase tracking-[0.22em] ${activeTab === 'lobbies'
                ? 'border-emerald-400/50 bg-emerald-500/10 text-emerald-100'
                : 'border-emerald-400/25 bg-emerald-500/[0.04] text-emerald-200 hover:bg-emerald-500/10 hover:border-emerald-400/50'
                }`}
              title="Voir les salons live"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              voir <span className="tabular-nums font-bold text-white">{lobbyCount ?? '…'}</span> salons live
            </button>

            {/* Actions secondaires en icônes - réduit le bruit du masthead */}
            <button
              onClick={load}
              disabled={isLoading}
              className="cursor-pointer ml-2 w-7 h-7 flex items-center justify-center rounded-md text-white/45 hover:text-white hover:bg-white/[0.05] transition-colors disabled:opacity-25"
              title="Rafraîchir"
              aria-label="Rafraîchir"
            >
              <Icon icon="mdi:refresh" className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onLogout}
              className="cursor-pointer w-7 h-7 flex items-center justify-center rounded-md text-white/45 hover:text-white hover:bg-white/[0.05] transition-colors"
              title="Déconnexion"
              aria-label="Déconnexion"
            >
              <Icon icon="mdi:logout" className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Ligne 2 : nav sections - sous-ligne style article */}
        <div className="max-w-7xl mx-auto px-6 border-t border-white/[0.06]">
          <div className="flex flex-wrap items-stretch">
            {GROUP_ORDER.map((group) => {
              // "lobbies" est promu dans le masthead - on l'exclut de la nav.
              const groupTabs = TABS.filter((t) => t.group === group && t.id !== 'lobbies');
              if (groupTabs.length === 0) return null;
              return (
                <div key={group} className="flex items-stretch">
                  {groupTabs.map((tab) => {
                    const active = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        aria-label={tab.ariaLabel ?? tab.label}
                        title={tab.ariaLabel ?? tab.label}
                        className={`relative px-4 py-3 flex items-center gap-1.5 whitespace-nowrap text-[12px] font-mono font-bold uppercase tracking-[0.12em] transition-colors ${active
                          ? 'text-white'
                          : 'text-white/40 hover:text-white/75'
                          }`}
                      >
                        {tab.icon ? (
                          <Icon icon={tab.icon} className="w-4 h-4" />
                        ) : (
                          <span>{tab.label}</span>
                        )}
                        {!tab.enabled && (
                          <span className="w-1 h-1 rounded-full bg-amber-400/80" title="bientôt" />
                        )}
                        {active && (
                          <span className="absolute left-0 right-0 bottom-[-1px] h-[2px] bg-amber-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <main className="relative max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'overview' && (
          <OverviewPanel tickets={tickets} onJumpToTickets={jumpToTickets} />
        )}
        {activeTab === 'tickets' && (
          <TicketsPanel
            tickets={tickets}
            isLoading={isLoading}
            onChangeTickets={setTickets}
          />
        )}
        {activeTab === 'lobbies' && (
          <LobbiesPanel active={activeTab === 'lobbies'} refreshKey={refreshKey} />
        )}
        {activeTab === 'decks' && (
          <DecksPanel active={activeTab === 'decks'} />
        )}
        {activeTab === 'content' && (
          <ContentPanel />
        )}
        {activeTab === 'stats' && (
          <StatsPanel />
        )}
      </main>

      <style>{`
        .custom-scroll::-webkit-scrollbar { width: 6px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.08);
          border-radius: 3px;
        }
        .custom-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.18);
        }
        .admin-mini-slider {
          -webkit-appearance: none;
          appearance: none;
          height: 3px;
          background: rgba(255,255,255,0.08);
          border-radius: 999px;
          outline: none;
        }
        .admin-mini-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: rgba(255,255,255,0.55);
          border: none;
          transition: background 0.15s;
        }
        .admin-mini-slider:hover::-webkit-slider-thumb {
          background: rgba(251,191,36,0.9);
        }
        .admin-mini-slider::-moz-range-thumb {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: rgba(255,255,255,0.55);
          border: none;
        }
        .admin-mini-slider:hover::-moz-range-thumb {
          background: rgba(251,191,36,0.9);
        }
        .admin-mini-slider::-moz-range-track {
          height: 3px;
          background: rgba(255,255,255,0.08);
          border-radius: 999px;
        }
      `}</style>
    </div>
  );
};

// =====================================================================
// Root
// =====================================================================
const Admin = () => {
  const [isAuth, setIsAuth] = useState<boolean | null>(null);

  useEffect(() => {
    const prev = document.title;
    document.title = 'Onskoné - Admin';
    return () => { document.title = prev; };
  }, []);

  useEffect(() => {
    checkAdminAuth().then(setIsAuth);
  }, []);

  const logout = () => {
    clearAdminToken();
    setIsAuth(false);
  };

  if (isAuth === null) {
    return (
      <div
        className="min-h-screen flex items-center justify-center font-mono text-[11px] uppercase tracking-[0.3em] text-white/40"
        style={{ background: 'linear-gradient(180deg, #0a0c12 0%, #0d1018 100%)' }}
      >
        <span className="w-2 h-2 rounded-full bg-amber-400/70 animate-pulse mr-2" />
        chargement…
      </div>
    );
  }
  if (!isAuth) return <LoginScreen onSuccess={() => setIsAuth(true)} />;
  return <Dashboard onLogout={logout} />;
};

export default Admin;

