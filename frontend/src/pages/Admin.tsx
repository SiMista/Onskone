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

// =====================================================================
// Admin Onskoné - control room (Studio-style dark UI)
// =====================================================================

// ---------- Studio-style shared classes ----------
const PILL = 'bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-md transition-colors';
const PILL_BTN = `${PILL} px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider text-white/70 hover:text-white`;
const PILL_ICON = `${PILL} w-7 h-7 flex items-center justify-center text-white/70 hover:text-white text-[13px] leading-none`;
const CLUSTER = 'flex items-center gap-1.5 bg-black/30 border border-white/[0.06] rounded-lg px-2 py-1';
const INPUT_CLS =
  'bg-[#0f1117] text-white/85 border border-white/10 rounded-md px-2.5 py-1.5 text-[12px] font-mono ' +
  'focus:outline-none focus:border-amber-400/60 hover:border-white/20 transition-colors ' +
  'placeholder:text-white/25';

// ---------- Type → accent color (Studio palette) ----------
const TYPE_META: Record<TicketType, { label: string; dot: string; chip: string; ring: string }> = {
  question_report: {
    label: 'Question',
    dot: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]',
    chip: 'bg-amber-400/10 border-amber-300/40 text-amber-100',
    ring: 'ring-amber-300/30',
  },
  bug: {
    label: 'Bug',
    dot: 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.6)]',
    chip: 'bg-red-500/10 border-red-400/40 text-red-100',
    ring: 'ring-red-300/30',
  },
  suggestion: {
    label: 'Idée',
    dot: 'bg-sky-400 shadow-[0_0_8px_rgba(125,211,240,0.6)]',
    chip: 'bg-sky-500/10 border-sky-400/40 text-sky-100',
    ring: 'ring-sky-300/30',
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
        <div className="flex items-baseline gap-1.5 font-mono">
          <span className="text-amber-400 text-[15px] leading-none">▍</span>
          <span className="text-white/55 tracking-tight">onskoné</span>
          <span className="text-white/25">/</span>
          <span className="text-amber-200 font-bold tracking-tight uppercase">admin</span>
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
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.6)]" />
            <p className="font-mono text-[11px] text-red-200">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={!password || isLoading}
          className="w-full px-5 py-2 rounded-md font-mono text-[11px] font-bold uppercase tracking-wider bg-gradient-to-br from-amber-300 to-amber-500 text-black shadow-[0_2px_0_0_rgba(0,0,0,0.4),0_0_20px_rgba(251,191,36,0.35)] hover:shadow-[0_2px_0_0_rgba(0,0,0,0.4),0_0_28px_rgba(251,191,36,0.55)] hover:-translate-y-px active:translate-y-0 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        >
          {isLoading ? '…' : '▶ Se connecter'}
        </button>
      </form>
    </div>
  );
};

// =====================================================================
// Helpers
// =====================================================================
type AdminTab = 'overview' | 'tickets' | 'lobbies' | 'decks' | 'stats';

interface TabDef {
  id: AdminTab;
  label: string;
  hint: string;
  enabled: boolean;
}

const TABS: TabDef[] = [
  { id: 'overview', label: 'Vue d\'ensemble', hint: 'kpis', enabled: true },
  { id: 'tickets', label: 'Tickets', hint: 'feedback', enabled: true },
  { id: 'lobbies', label: 'Salons live', hint: 'realtime', enabled: true },
  { id: 'decks', label: 'Decks', hint: 'catalogue', enabled: true },
  { id: 'stats', label: 'Stats', hint: 'umami', enabled: true },
];

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
  const accentMap: Record<typeof accent, { bar: string; text: string }> = {
    amber: { bar: 'from-amber-400/80 to-transparent', text: 'text-amber-200' },
    sky: { bar: 'from-sky-400/80 to-transparent', text: 'text-sky-200' },
    violet: { bar: 'from-violet-400/80 to-transparent', text: 'text-violet-200' },
    emerald: { bar: 'from-emerald-400/80 to-transparent', text: 'text-emerald-200' },
    red: { bar: 'from-red-400/80 to-transparent', text: 'text-red-200' },
    white: { bar: 'from-white/50 to-transparent', text: 'text-white' },
  };
  return (
    <div className="relative rounded-lg border border-white/[0.07] bg-gradient-to-b from-white/[0.025] to-transparent p-4 overflow-hidden">
      <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r ${accentMap[accent].bar}`} />
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/35">{label}</p>
      <p className={`mt-1.5 text-3xl font-semibold tracking-tight tabular-nums ${accentMap[accent].text}`}>
        {value}
      </p>
      {hint && <p className="mt-1 font-mono text-[11px] text-white/30">{hint}</p>}
    </div>
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
    const last7d = tickets.filter((t) => now - t.created_at < 7 * dayMs).length;
    const byStatus = tickets.reduce((acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    }, {} as Record<TicketStatus, number>);
    const byType = tickets.reduce((acc, t) => {
      acc[t.type] = (acc[t.type] || 0) + 1;
      return acc;
    }, {} as Record<TicketType, number>);
    return { last7d, byStatus, byType };
  }, [tickets]);

  const open = (stats.byStatus.new || 0) + (stats.byStatus.in_progress || 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/35 mb-3">
          // signaux
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <StatTile label="Ouverts" value={open} hint={`${stats.byStatus.new || 0} nouveau · ${stats.byStatus.in_progress || 0} wip`} accent="amber" />
          <StatTile label="7 jours" value={stats.last7d} hint="cadence hebdo" accent="violet" />
          <StatTile label="Résolus" value={stats.byStatus.resolved || 0} hint={`${stats.byStatus.wont_fix || 0} no-fix`} accent="emerald" />
        </div>
      </div>

      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/35 mb-3">
          // par type
        </p>
        <div className="rounded-lg border border-white/[0.07] bg-gradient-to-b from-white/[0.025] to-transparent p-4">
          <div className="space-y-2">
            {(['bug', 'question_report', 'suggestion'] as TicketType[]).map((t) => {
              const n = stats.byType[t] || 0;
              const total = tickets.length || 1;
              const pct = Math.round((n / total) * 100);
              return (
                <button
                  key={t}
                  onClick={() => onJumpToTickets(undefined, t)}
                  className="group w-full text-left"
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
                      className={`h-full rounded-full transition-all ${t === 'bug' ? 'bg-red-400/70' :
                          t === 'question_report' ? 'bg-amber-400/70' :
                            'bg-sky-400/70'
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
          ? 'border-amber-300/60 shadow-[0_0_0_1px_rgba(251,191,36,0.25),0_4px_18px_rgba(251,191,36,0.12)]'
          : 'border-white/[0.07] hover:border-white/15'}`}
    >
      {/* Type accent strip */}
      <div className={`absolute left-0 top-0 bottom-0 w-[2px] ${ticket.type === 'bug' ? 'bg-red-400/60' :
          ticket.type === 'question_report' ? 'bg-amber-400/60' :
            'bg-sky-400/60'
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
                  {ticket.lobby_code} <span className="text-white/30 text-[11px]">⧉</span>
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
  tickets, isLoading, onReload, onChangeTickets,
}: {
  tickets: Ticket[];
  isLoading: boolean;
  onReload: () => void;
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
          <span className="text-white/30 px-1 text-[12px]">⌕</span>
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

        <button
          onClick={onReload}
          disabled={isLoading}
          className={`${PILL_BTN} disabled:opacity-25`}
          title="Recharger"
        >
          ↻ Reload
        </button>
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
          <span className="w-2 h-2 rounded-full bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.7)]" />
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
    dot: 'bg-sky-400 shadow-[0_0_8px_rgba(125,211,240,0.7)]',
  },
  playing: {
    label: 'En partie',
    pill: 'bg-emerald-400/10 border-emerald-300/40 text-emerald-100',
    dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)] animate-pulse',
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

const LobbiesPanel = ({ active }: { active: boolean }) => {
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
          <span className="text-white/30 px-1 text-[12px]">⌕</span>
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

        <button
          onClick={() => load()}
          disabled={isLoading}
          className={`${PILL_BTN} disabled:opacity-25`}
          title="Recharger"
        >
          ↻ Reload
        </button>
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
    strip: 'bg-sky-400/70',
    chip: 'bg-sky-500/10 border-sky-400/40 text-sky-100',
    dot: 'bg-sky-400 shadow-[0_0_8px_rgba(125,211,240,0.7)]',
    text: 'text-sky-200',
    ring: 'ring-sky-300/30',
    glow: 'from-sky-400/70 to-transparent',
  },
  FUN: {
    strip: 'bg-amber-400/70',
    chip: 'bg-amber-400/10 border-amber-300/40 text-amber-100',
    dot: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]',
    text: 'text-amber-200',
    ring: 'ring-amber-300/30',
    glow: 'from-amber-400/70 to-transparent',
  },
  DEEP: {
    strip: 'bg-red-400/70',
    chip: 'bg-red-500/10 border-red-400/40 text-red-100',
    dot: 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.7)]',
    text: 'text-red-200',
    ring: 'ring-red-300/30',
    glow: 'from-red-400/70 to-transparent',
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
  subject, palette,
}: {
  subject: AdminDeckSummary['subjects'][number];
  palette: CategoryStyle;
}) => (
  <div className="rounded-lg border border-white/[0.07] bg-black/20 overflow-hidden">
    <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.05] bg-white/[0.015]">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${palette.dot}`} />
      <span className="text-[13px] text-white/90 font-medium truncate" title={subject.subject}>
        {subject.subject}
      </span>
      <span className="ml-auto font-mono text-[11px] tabular-nums text-white/40">
        {subject.questionCount} q.
      </span>
    </div>
    {subject.questions.length === 0 ? (
      <p className="px-3 py-3 font-mono text-[11px] text-white/25 italic">aucune question</p>
    ) : (
      <ol className="px-3 py-2.5 space-y-1.5">
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
    className={`group relative w-full flex items-center gap-2 pl-3 pr-2.5 py-1.5 rounded-md border transition-colors text-left ${
      selected
        ? `bg-white/[0.08] border-white/15 ring-1 ${palette.ring}`
        : 'bg-transparent border-transparent hover:bg-white/[0.04]'
    }`}
  >
    <span className={`absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full ${selected ? palette.strip : 'bg-transparent'}`} />
    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${palette.dot}`} />
    <span className={`text-[12.5px] truncate flex-1 ${selected ? 'text-white' : 'text-white/75 group-hover:text-white/95'}`} title={deck.theme}>
      {deck.theme}
    </span>
    <span className="font-mono text-[11px] tabular-nums text-white/40">
      {deck.questionCount}
    </span>
  </button>
);

const DeckDetail = ({ deck }: { deck: AdminDeckSummary }) => {
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
          <span className="font-mono text-[11px] uppercase tracking-wider text-white/40 ml-auto">
            {deck.subjectCount} sujets · <span className={palette.text}>{deck.questionCount}</span> questions
          </span>
        </div>
        <div className={`absolute left-0 right-0 bottom-0 h-px bg-gradient-to-r ${palette.glow}`} />
      </div>

      <div className="p-4">
        {deck.subjects.length === 0 ? (
          <p className="text-center py-10 font-mono text-[11px] uppercase tracking-[0.3em] text-white/25">
            aucun sujet
          </p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {deck.subjects.map((s) => (
              <SubjectCard key={s.subject} subject={s} palette={palette} />
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return decks.filter((d) => {
      if (categoryFilter && d.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        d.category.toLowerCase().includes(q) ||
        d.theme.toLowerCase().includes(q) ||
        d.subjects.some((s) =>
          s.subject.toLowerCase().includes(q) ||
          s.questions.some((qu) => qu.toLowerCase().includes(q))
        )
      );
    });
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
          <span className="text-white/30 px-1 text-[12px]">⌕</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="rechercher catégorie, thème, sujet, question"
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
            <span className="font-mono text-[11px] uppercase tracking-wider text-white/40 px-1">Cat</span>
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
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-mono text-[11px] uppercase tracking-wider transition-colors ${isActive ? 'bg-white/[0.08] text-white' : 'text-white/45 hover:text-white/80'
                    }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${palette.dot}`} />
                  {c}
                </button>
              );
            })}
          </div>
        )}

        <span className="font-mono text-[11px] text-white/30 ml-auto">
          source: <span className="text-white/55">questions.json</span>
        </span>

        <button
          onClick={() => load()}
          disabled={isLoading}
          className={`${PILL_BTN} disabled:opacity-25`}
          title="Recharger"
        >
          ↻ Reload
        </button>
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
                        <span className={`w-1.5 h-1.5 rounded-full ${palette.dot}`} />
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
              <DeckDetail deck={selectedDeck} />
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
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(125,211,240,0.7)]" />
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
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)] animate-pulse" />
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
  const showToast = useToast();
  const ranOnce = useRef(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchTickets();
      setTickets(data);
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

      {/* Sticky header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-[#0a0c12]/85 border-b border-white/[0.07]">
        <div className="px-4 py-3 flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-[15px] leading-none flex items-baseline gap-1.5 select-none">
              <span className="text-amber-400">▍</span>
              <span className="text-white/55 tracking-tight">onskoné</span>
              <span className="text-white/25">/</span>
              <span className="text-amber-200 font-bold tracking-tight uppercase">admin</span>
            </span>
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-200 border border-emerald-400/40 bg-emerald-500/[0.08] rounded px-1.5 py-0.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)] mr-1 align-middle animate-pulse" />
              live
            </span>
          </div>

          {/* Tabs */}
          <div className="ml-2 inline-flex rounded-md border border-white/10 bg-black/30 p-0.5 font-mono text-[11px] uppercase tracking-wider overflow-x-auto">
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative px-2.5 py-1 rounded transition-colors flex items-center gap-1.5 whitespace-nowrap ${active
                      ? 'bg-white/[0.08] text-white'
                      : 'text-white/45 hover:text-white/80'
                    }`}
                >
                  <span>{tab.label}</span>
                  {!tab.enabled && (
                    <span className="w-1 h-1 rounded-full bg-amber-400/80" title="bientôt" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex-1 min-w-4" />

          <button
            onClick={load}
            disabled={isLoading}
            className={`${PILL_ICON} disabled:opacity-25`}
            title="Recharger"
          >↻</button>
          <button
            onClick={onLogout}
            className={PILL_BTN}
            title="Déconnexion"
          >⏏ logout</button>
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
            onReload={load}
            onChangeTickets={setTickets}
          />
        )}
        {activeTab === 'lobbies' && (
          <LobbiesPanel active={activeTab === 'lobbies'} />
        )}
        {activeTab === 'decks' && (
          <DecksPanel active={activeTab === 'decks'} />
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

