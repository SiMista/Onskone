import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { useToast } from '../../components/Toast';
import {
  Ticket,
  TicketStatus,
  TicketType,
  updateTicketStatus,
  deleteTicket,
} from '../../utils/ticketsApi';
import { CLUSTER, TYPE_META, STATUS_META, STATUS_ORDER, formatDate, formatRelative } from './shared';
import { BottomSheet } from './MobileNav';
import { ConfirmDialog } from './ConfirmDialog';

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
      <div className={`absolute left-0 top-0 bottom-0 w-[2px] ${type.bar}`} />

      <div className="px-2.5 py-2 pl-3.5">
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

          <span className={`px-1.5 py-0.5 rounded border font-mono text-[11px] uppercase tracking-wider inline-flex items-center gap-1 ${type.chip}`}>
            <span aria-hidden className="text-[12px] leading-none">{type.glyph}</span>
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

        <div className="mt-1.5 flex items-center gap-1 flex-wrap sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity">
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
      className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center sm:px-4 sm:py-6 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full sm:max-w-2xl h-full sm:h-auto sm:max-h-[85vh] overflow-y-auto custom-scroll sm:rounded-xl border-0 sm:border border-white/[0.1] bg-gradient-to-b from-[#1b1f2a] to-[#161a24] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-[#1b1f2a]/95 backdrop-blur px-4 sm:px-5 py-3 border-b border-white/[0.06] flex items-center gap-2 z-10 flex-wrap">
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

        <div className="p-4 sm:p-5 space-y-5">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-white/35 mb-1.5">Message</p>
            <p className="text-[14px] text-white/90 leading-relaxed whitespace-pre-wrap break-words">
              {ticket.message}
            </p>
          </div>

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

        <div className="sticky bottom-0 bg-[#1b1f2a]/95 backdrop-blur px-4 sm:px-5 py-3 border-t border-white/[0.06] space-y-2 sm:space-y-0 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 sm:contents">
            <span className="shrink-0 font-mono text-[11px] uppercase tracking-wider text-white/35 sm:mr-1 whitespace-nowrap">déplacer vers</span>
            {STATUS_ORDER.filter((s) => s !== ticket.status).map((s) => (
              <button
                key={s}
                onClick={() => onStatusChange(s)}
                className={`shrink-0 whitespace-nowrap px-2 py-1 rounded border font-mono text-[11px] uppercase tracking-wider transition-colors ${STATUS_META[s].pill} hover:brightness-125`}
              >
                → {STATUS_META[s].label}
              </button>
            ))}
          </div>
          <button
            onClick={onDelete}
            className="w-full sm:w-auto sm:ml-auto px-3 py-1.5 sm:py-1 rounded border border-red-400/40 bg-red-500/10 hover:bg-red-500/25 hover:border-red-400/70 text-red-200 font-mono text-[11px] uppercase tracking-wider transition-colors"
          >
            ✕ supprimer
          </button>
        </div>
      </div>
    </div>
  );
};

export const TicketsPanel = ({
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
  const [mobileStatus, setMobileStatus] = useState<TicketStatus>('new');
  const [filtersOpen, setFiltersOpen] = useState(false);
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
      <div className="md:hidden flex items-center gap-2">
        <div className={`${CLUSTER} flex-1 min-w-0`}>
          <Icon icon="mdi:magnify" className="w-4 h-4 text-white/35 ml-0.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="rechercher"
            className="flex-1 min-w-0 bg-transparent border-0 outline-0 text-[12px] text-white/85 placeholder:text-white/25 font-mono"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-white/30 hover:text-white text-[12px] px-1"
            >×</button>
          )}
        </div>
        <button
          onClick={() => setFiltersOpen(true)}
          className={`relative shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border bg-black/30 text-[11px] font-mono uppercase tracking-wider transition-colors ${typeFilter || groupByLobby
            ? 'border-amber-300/40 text-amber-100'
            : 'border-white/[0.08] text-white/65'
            }`}
        >
          <Icon icon="mdi:tune-variant" className="w-4 h-4" />
          Filtres
          {(typeFilter || groupByLobby) && (
            <span className="ml-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-400 text-black text-[10px] font-bold tabular-nums">
              {(typeFilter ? 1 : 0) + (groupByLobby ? 1 : 0)}
            </span>
          )}
        </button>
      </div>

      <div className="hidden md:flex flex-wrap items-center gap-2.5">
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

      <BottomSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filtres">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45 mb-2">Type de ticket</p>
          <div className="grid grid-cols-2 gap-1.5">
            {(['', 'bug', 'question_report', 'suggestion'] as const).map((t) => {
              const active = typeFilter === t;
              const label = t === '' ? 'Tous' : TYPE_META[t].label;
              return (
                <button
                  key={t || 'all'}
                  onClick={() => setTypeFilter(t)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[13px] transition-colors ${active
                    ? 'border-amber-300/40 bg-amber-400/[0.08] text-white'
                    : 'border-white/[0.08] bg-white/[0.02] text-white/70'
                    }`}
                >
                  {t !== '' && <span aria-hidden className="text-[13px] leading-none">{TYPE_META[t].glyph}</span>}
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45 mb-2">Affichage</p>
          <button
            onClick={() => setGroupByLobby((v) => !v)}
            className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border transition-colors ${groupByLobby
              ? 'border-amber-300/40 bg-amber-400/[0.08]'
              : 'border-white/[0.08] bg-white/[0.02]'
              }`}
          >
            <div className="text-left">
              <p className="text-[13px] text-white">Grouper par lobby</p>
              <p className="text-[11px] text-white/45 mt-0.5">Regroupe les tickets d'un même salon</p>
            </div>
            <span
              className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${groupByLobby ? 'bg-amber-400' : 'bg-white/15'}`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${groupByLobby ? 'translate-x-4' : 'translate-x-0.5'}`}
              />
            </span>
          </button>
        </div>

        {(typeFilter || groupByLobby) && (
          <button
            onClick={() => { setTypeFilter(''); setGroupByLobby(false); }}
            className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/[0.04] text-white/70 text-[12px] font-mono uppercase tracking-wider"
          >
            Réinitialiser
          </button>
        )}
      </BottomSheet>

      <div className="md:hidden grid grid-cols-4 gap-1.5">
        {STATUS_ORDER.map((s) => {
          const meta = STATUS_META[s];
          const count = filtered.filter((t) => t.status === s).length;
          const active = mobileStatus === s;
          return (
            <button
              key={s}
              onClick={() => setMobileStatus(s)}
              className={`flex flex-col items-center justify-center gap-0.5 px-1.5 py-2 rounded-lg border transition-colors min-w-0 ${active
                ? `${meta.pill} ring-1 ring-white/10`
                : 'border-white/[0.07] bg-white/[0.02] text-white/55'
                }`}
            >
              <span className="font-mono text-[10px] uppercase tracking-wider truncate max-w-full">
                {meta.label}
              </span>
              <span className="tabular-nums font-bold text-[13px] leading-none">{count}</span>
            </button>
          );
        })}
      </div>

      <div
        className={`overflow-hidden transition-all duration-200 ${selected.size > 0 ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'
          }`}
      >
        <div className="rounded-lg border border-amber-300/30 bg-amber-400/[0.06] px-3 py-2">
          <div className="flex items-center justify-between gap-2 mb-1.5 md:mb-0 md:hidden">
            <span className="font-mono text-[11px] uppercase tracking-wider text-amber-200">
              {selected.size} sélectionné{selected.size > 1 ? 's' : ''}
            </span>
            <button
              onClick={clearSelection}
              className="text-white/50 hover:text-white font-mono text-[11px] uppercase tracking-wider"
            >
              annuler
            </button>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-3 px-3 md:mx-0 md:px-0 md:flex-wrap">
            <span className="hidden md:inline font-mono text-[11px] uppercase tracking-wider text-amber-200 whitespace-nowrap">
              {selected.size} sélectionné{selected.size > 1 ? 's' : ''}
            </span>
            <span className="hidden md:inline text-white/20">·</span>
            {STATUS_ORDER.map((s) => (
              <button
                key={s}
                onClick={() => bulkMove(s)}
                className={`shrink-0 whitespace-nowrap px-2 py-0.5 rounded border font-mono text-[11px] uppercase tracking-wider ${STATUS_META[s].pill} hover:brightness-125 transition`}
              >
                → {STATUS_META[s].label}
              </button>
            ))}
            <button
              onClick={requestBulkDelete}
              className="shrink-0 whitespace-nowrap px-2 py-0.5 rounded border border-red-400/40 bg-red-500/10 hover:bg-red-500/25 text-red-200 font-mono text-[11px] uppercase tracking-wider transition"
            >
              ✕ supprimer
            </button>
            <button
              onClick={clearSelection}
              className="hidden md:inline ml-auto text-white/50 hover:text-white font-mono text-[11px] uppercase tracking-wider"
            >
              annuler
            </button>
          </div>
        </div>
      </div>

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
            const hiddenOnMobile = status !== mobileStatus;

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
                className={`relative rounded-xl border ${meta.accent} bg-black/30 overflow-hidden flex flex-col ${hiddenOnMobile ? 'hidden md:flex' : ''}`}
              >
                <div className={`relative bg-gradient-to-r ${meta.bar} px-3 py-2.5 border-b border-white/[0.06] hidden md:flex items-center gap-2`}>
                  <p className="text-[14px] font-semibold tracking-tight text-white">
                    {meta.label}
                  </p>
                  <span className="ml-auto font-mono text-[12px] tabular-nums text-white/65 px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/10">
                    {col.length}
                  </span>
                </div>

                <div className="p-2 space-y-2 md:max-h-[calc(100vh-280px)] md:overflow-y-auto custom-scroll">
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
