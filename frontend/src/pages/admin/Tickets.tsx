import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { Ticket, TicketStatus, TicketType } from '../../utils/ticketsApi';
import { CLUSTER, TYPE_META, STATUS_META, STATUS_ORDER } from './shared';
import { BottomSheet } from './MobileNav';
import { ConfirmDialog } from './ConfirmDialog';
import { TicketCard } from './tickets/TicketCard';
import { TicketDetailModal } from './tickets/TicketDetailModal';
import { useTicketCrud } from './tickets/useTicketCrud';
import { EmptyState, LoadingState, PANEL, SearchField, Segmented, Tabs, badge, btn } from './ui';

export const TicketsPanel = ({
  tickets, isLoading, onChangeTickets,
  initialStatusFilter, initialTypeFilter,
}: {
  tickets: Ticket[];
  isLoading: boolean;
  onChangeTickets: (next: Ticket[] | ((prev: Ticket[]) => Ticket[])) => void;
  /**
   * Filtres initiaux appliqués au montage (jump depuis l'Overview). Le statut
   * pilote la colonne affichée sur mobile ; le type filtre tous les écrans.
   */
  initialStatusFilter?: TicketStatus;
  initialTypeFilter?: TicketType;
}) => {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TicketType | ''>(initialTypeFilter ?? '');
  const [groupByLobby, setGroupByLobby] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [openTicketId, setOpenTicketId] = useState<number | null>(null);
  const [mobileStatus, setMobileStatus] = useState<TicketStatus>(initialStatusFilter ?? 'new');
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Réapplique les filtres initiaux quand le jump depuis l'Overview change
  // (ex: clic successif sur "Ouverts" puis un type).
  useEffect(() => {
    if (initialStatusFilter) setMobileStatus(initialStatusFilter);
  }, [initialStatusFilter]);
  useEffect(() => {
    if (initialTypeFilter) setTypeFilter(initialTypeFilter);
  }, [initialTypeFilter]);

  const clearSelection = useCallback(() => setSelected(new Set()), []);
  const removeFromSelection = useCallback((ids: number[]) => {
    setSelected((prev) => {
      const n = new Set(prev);
      ids.forEach((id) => n.delete(id));
      return n;
    });
  }, []);
  const handleDeleted = useCallback((ids: number[]) => {
    setOpenTicketId((cur) => (cur !== null && ids.includes(cur) ? null : cur));
  }, []);

  const {
    pendingDelete, cancelDelete, changeStatus,
    requestDelete, requestBulkDelete, confirmDelete, bulkMove,
  } = useTicketCrud({
    onChangeTickets,
    selectedIds: useMemo(() => [...selected], [selected]),
    clearSelection,
    removeFromSelection,
    onDeleted: handleDeleted,
  });

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

  const openTicket = openTicketId !== null ? tickets.find((t) => t.id === openTicketId) ?? null : null;

  return (
    <div className="space-y-5">
      <div className="md:hidden flex items-center gap-2">
        <SearchField value={search} onChange={setSearch} placeholder="Rechercher un ticket" className="flex-1 min-w-0" />
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className={`relative shrink-0 ${btn(typeFilter || groupByLobby ? 'primary' : 'secondary')}`}
        >
          <Icon icon="mdi:tune-variant" className="w-4 h-4" />
          Filtres
          {(typeFilter || groupByLobby) && (
            <span className="ml-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-400 text-black text-[11px] font-bold tabular-nums">
              {(typeFilter ? 1 : 0) + (groupByLobby ? 1 : 0)}
            </span>
          )}
        </button>
      </div>

      <div className="hidden md:flex md:flex-wrap md:items-center gap-2">
        <SearchField value={search} onChange={setSearch} placeholder="Rechercher : message, pseudo, code salon, n° de ticket" />

        <Segmented<TicketType | ''>
          ariaLabel="Type de ticket"
          value={typeFilter}
          onChange={setTypeFilter}
          options={(['', 'bug', 'question_report', 'suggestion'] as const).map((t) => (
            t === '' ? { value: t, label: 'Tous les types' } : { value: t, label: TYPE_META[t].label, accent: TYPE_META[t].dot }
          ))}
        />

        <div className={CLUSTER}>
          <label className="flex items-center gap-1.5 cursor-pointer select-none text-[13px] font-medium text-white/70 hover:text-white px-1.5 py-1">
            <input
              type="checkbox"
              checked={groupByLobby}
              onChange={(e) => setGroupByLobby(e.target.checked)}
              className="accent-amber-400"
            />
            <span>Grouper par salon</span>
          </label>
        </div>
      </div>

      <BottomSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filtres">
        <div>
          <p className="text-[13px] font-medium text-white/65 mb-2">Type de ticket</p>
          <div className="grid grid-cols-2 gap-1.5">
            {(['', 'bug', 'question_report', 'suggestion'] as const).map((t) => {
              const active = typeFilter === t;
              const label = t === '' ? 'Tous' : TYPE_META[t].label;
              return (
                <button
                  type="button"
                  key={t || 'all'}
                  onClick={() => setTypeFilter(t)}
                  aria-pressed={active}
                  className={`flex items-center gap-2 px-3 min-h-[44px] rounded-lg border text-[13px] font-medium cursor-pointer transition-colors ${active
                    ? 'border-amber-300/50 bg-amber-400/15 text-amber-100'
                    : 'border-white/15 bg-white/[0.04] text-white/70'
                    }`}
                >
                  {t !== '' && <Icon icon={TYPE_META[t].icon} className={`w-4 h-4 ${TYPE_META[t].text}`} aria-hidden />}
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-[13px] font-medium text-white/65 mb-2">Affichage</p>
          <button
            type="button"
            role="switch"
            aria-checked={groupByLobby}
            onClick={() => setGroupByLobby((v) => !v)}
            className={`cursor-pointer w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border transition-colors ${groupByLobby
              ? 'border-amber-300/50 bg-amber-400/15'
              : 'border-white/15 bg-white/[0.04]'
              }`}
          >
            <div className="text-left">
              <p className="text-[13px] text-white">Grouper par salon</p>
              <p className="text-[12px] text-white/55 mt-0.5">Rassemble les tickets venus d'une même partie</p>
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
            type="button"
            onClick={() => { setTypeFilter(''); setGroupByLobby(false); }}
            className={`w-full ${btn('secondary')}`}
          >
            Réinitialiser les filtres
          </button>
        )}
      </BottomSheet>

      <div className="md:hidden">
        <Tabs<TicketStatus>
          ariaLabel="Statut des tickets"
          value={mobileStatus}
          onChange={setMobileStatus}
          tabs={STATUS_ORDER.map((s) => ({
            value: s,
            label: (
              <span className="inline-flex items-center gap-1.5">
                <Icon icon={STATUS_META[s].icon} className={`w-4 h-4 ${STATUS_META[s].text}`} aria-hidden />
                {STATUS_META[s].label}
                <span className="text-[12px] tabular-nums text-white/50">{columns[s].length}</span>
              </span>
            ),
          }))}
        />
      </div>

      <div
        className={`overflow-hidden transition-all duration-200 ${selected.size > 0 ? 'max-h-28 opacity-100' : 'max-h-0 opacity-0'
          }`}
      >
        <div className="rounded-xl border border-amber-300/30 bg-amber-400/[0.06] px-3 py-2">
          <div className="flex items-center justify-between gap-2 mb-1.5 md:mb-0 md:hidden">
            <span className="text-[13px] font-medium text-amber-200">
              {selected.size} ticket{selected.size > 1 ? 's' : ''} sélectionné{selected.size > 1 ? 's' : ''}
            </span>
            <button
              type="button"
              onClick={clearSelection}
              className={btn('ghost', 'sm')}
            >
              Annuler
            </button>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-3 px-3 md:mx-0 md:px-0 md:flex-wrap">
            <span className="hidden md:inline text-[13px] font-medium text-amber-200 whitespace-nowrap">
              {selected.size} ticket{selected.size > 1 ? 's' : ''} sélectionné{selected.size > 1 ? 's' : ''}
            </span>
            <span aria-hidden className="hidden md:inline text-white/20">·</span>
            <span className="shrink-0 text-[13px] text-white/60 whitespace-nowrap">Passer en</span>
            {STATUS_ORDER.map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => bulkMove(s)}
                className={`shrink-0 ${btn('secondary', 'sm')}`}
              >
                <Icon icon={STATUS_META[s].icon} className={`w-4 h-4 ${STATUS_META[s].text}`} aria-hidden />
                {STATUS_META[s].label}
              </button>
            ))}
            <button
              type="button"
              onClick={requestBulkDelete}
              className={`shrink-0 ${btn('danger', 'sm')}`}
            >
              <Icon icon="mdi:trash-can-outline" className="w-4 h-4" aria-hidden />
              Supprimer
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className={`hidden md:inline-flex ml-auto ${btn('ghost', 'sm')}`}
            >
              Annuler la sélection
            </button>
          </div>
        </div>
      </div>

      {isLoading && tickets.length === 0 ? (
        <LoadingState label="Chargement des tickets…" />
      ) : filtered.length === 0 ? (
        tickets.length === 0 ? (
          <EmptyState
            icon="mdi:inbox-outline"
            title="Aucun ticket pour l'instant"
            hint="Les signalements envoyés depuis le jeu (bug, question pourrie, idée) apparaîtront ici."
          />
        ) : (
          <EmptyState
            icon="mdi:magnify"
            title="Aucun ticket ne correspond"
            hint="Essaie un autre mot, ou retire le filtre de type."
          />
        )
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
                className={`relative ${PANEL} overflow-hidden flex flex-col ${hiddenOnMobile ? 'hidden md:flex' : ''}`}
              >
                <div className="px-3 py-2.5 border-b border-white/[0.06] hidden md:flex items-center gap-2">
                  <Icon icon={meta.icon} className={`w-[18px] h-[18px] ${meta.text}`} aria-hidden />
                  <p className="text-[14px] font-semibold tracking-tight text-white">
                    {meta.label}
                  </p>
                  <span className={`ml-auto tabular-nums ${badge('neutral')}`}>
                    {col.length}
                  </span>
                </div>

                <div className="p-2 space-y-2 md:max-h-[calc(100vh-280px)] md:overflow-y-auto custom-scroll">
                  {col.length === 0 ? (
                    <p className="text-center py-8 text-[12px] text-white/50">
                      Aucun ticket
                    </p>
                  ) : (
                    grouped.map((group, gIdx) => (
                      <div key={group.lobby ?? `orphan-${gIdx}`} className="space-y-2">
                        {groupByLobby && group.lobby && (
                          <div className="flex items-center gap-1.5 px-1.5 pt-1">
                            <span className="text-[12px] text-white/55">Salon</span>
                            <span className="font-mono text-[12px] font-bold tracking-widest text-white/75">
                              {group.lobby}
                            </span>
                            <span className="text-[12px] tabular-nums text-white/55">
                              · {group.items.length} ticket{group.items.length > 1 ? 's' : ''}
                            </span>
                            <div aria-hidden className="flex-1 h-px bg-white/[0.05]" />
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
                            onStatusChange={(s) => changeStatus(t.id, s)}
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
          onStatusChange={(s) => changeStatus(openTicket.id, s)}
          onDelete={() => requestDelete(openTicket.id)}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={pendingDelete.kind === 'single'
            ? 'Supprimer ce ticket ?'
            : `Supprimer ${pendingDelete.ids.length} ticket${pendingDelete.ids.length > 1 ? 's' : ''} ?`}
          message={pendingDelete.kind === 'single'
            ? 'Il sera effacé définitivement, impossible de revenir en arrière.'
            : 'Ils seront effacés définitivement, impossible de revenir en arrière.'}
          confirmLabel="Supprimer"
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
      )}
    </div>
  );
};
