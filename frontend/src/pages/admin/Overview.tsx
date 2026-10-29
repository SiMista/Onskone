import { useMemo } from 'react';
import { Icon } from '@iconify/react';
import { Ticket, TicketStatus, TicketType } from '../../utils/ticketsApi';
import { TYPE_META, STATUS_META, formatRelative } from './shared';
import { SectionLabel, KpiCell, EmptyState, PANEL, Strip, btn } from './ui';

export const OverviewPanel = ({
  tickets, onJumpToTickets,
}: {
  tickets: Ticket[];
  onJumpToTickets: (status?: TicketStatus, type?: TicketType) => void;
}) => {
  const stats = useMemo(() => {
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
    return { byStatus, byType, hotLobbies, recent };
  }, [tickets]);

  const newCount = stats.byStatus.new || 0;
  const inProgressCount = stats.byStatus.in_progress || 0;
  const open = newCount + inProgressCount;
  const total = tickets.length || 1;

  return (
    <div className="space-y-5">
      <div>
        <SectionLabel>Vue d'ensemble</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <KpiCell
            label="À traiter"
            value={open}
            hint={`${newCount} nouveau${newCount > 1 ? 'x' : ''} · ${inProgressCount} en cours`}
            onClick={() => onJumpToTickets('new')}
          />
          <KpiCell
            label="Résolus"
            value={stats.byStatus.resolved || 0}
            hint={`+ ${stats.byStatus.wont_fix || 0} classé${(stats.byStatus.wont_fix || 0) > 1 ? 's' : ''} « ${STATUS_META.wont_fix.label} »`}
            onClick={() => onJumpToTickets('resolved')}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          <SectionLabel
            right={(
              <button
                type="button"
                onClick={() => onJumpToTickets()}
                className={btn('ghost', 'sm')}
              >
                Voir tous les tickets
                <Icon icon="mdi:chevron-right" className="w-4 h-4" aria-hidden />
              </button>
            )}
          >
            Derniers tickets
          </SectionLabel>
          {stats.recent.length === 0 ? (
            <EmptyState
              icon="mdi:inbox-outline"
              title="Aucun ticket pour l'instant"
              hint="Les signalements envoyés depuis le jeu (bug, question pourrie, idée) apparaîtront ici."
            />
          ) : (
            <div className={`${PANEL} overflow-hidden divide-y divide-white/[0.06]`}>
              {stats.recent.map((t) => {
                const type = TYPE_META[t.type];
                const status = STATUS_META[t.status];
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => onJumpToTickets()}
                    className="relative w-full text-left px-3 py-2.5 pl-4 hover:bg-white/[0.03] transition-colors cursor-pointer flex items-start group"
                  >
                    <Strip color={type.dot} row />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className={`inline-flex items-center gap-1 text-[12px] font-semibold ${type.text}`}>
                          <Icon icon={type.icon} className="w-4 h-4" aria-hidden />
                          {type.label}
                        </span>
                        <span className={`inline-flex items-center gap-1 text-[12px] font-medium ${status.text}`}>
                          <Icon icon={status.icon} className="w-3.5 h-3.5" aria-hidden />
                          {status.label}
                        </span>
                        {t.lobby_code && (
                          <span className="font-mono text-[12px] tracking-widest font-bold text-white/60" title={`Salon ${t.lobby_code}`}>{t.lobby_code}</span>
                        )}
                        <span className="ml-auto text-[12px] text-white/50 tabular-nums whitespace-nowrap">{formatRelative(t.created_at)}</span>
                      </div>
                      <p className="text-[13px] text-white/85 leading-snug line-clamp-1 group-hover:text-white transition-colors">
                        {t.message}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-5">
          <div>
            <SectionLabel>Salons signalés plusieurs fois</SectionLabel>
            {stats.hotLobbies.length === 0 ? (
              <EmptyState
                title="Aucun salon signalé plusieurs fois"
                hint="Un salon apparaît ici dès qu'il reçoit au moins 2 tickets : souvent le signe d'un vrai souci dans cette partie."
              />
            ) : (
              <div className={`${PANEL} overflow-hidden divide-y divide-white/[0.06]`}>
                {stats.hotLobbies.map(([code, count]) => (
                  <button
                    type="button"
                    key={code}
                    onClick={() => onJumpToTickets()}
                    className="w-full text-left px-3 py-2 min-h-[40px] hover:bg-white/[0.03] transition-colors cursor-pointer flex items-center gap-2"
                  >
                    <Icon icon="mdi:alert-circle-outline" className="w-4 h-4 text-rose-300" aria-hidden />
                    <span className="text-[12px] text-white/55">Salon</span>
                    <span className="font-mono text-[13px] font-bold tracking-widest text-white/85">{code}</span>
                    <span className="ml-auto text-[12px] tabular-nums text-white/65">
                      {count} tickets
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <SectionLabel>Tickets par type</SectionLabel>
            <div className={`${PANEL} p-3 space-y-3`}>
              {(['bug', 'question_report', 'suggestion'] as TicketType[]).map((t) => {
                const n = stats.byType[t] || 0;
                const pct = Math.round((n / total) * 100);
                return (
                  <button
                    type="button"
                    key={t}
                    onClick={() => onJumpToTickets(undefined, t)}
                    className="group w-full text-left cursor-pointer"
                    title={`Voir les tickets « ${TYPE_META[t].label} »`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="flex items-center gap-1.5">
                        <Icon icon={TYPE_META[t].icon} className={`w-4 h-4 ${TYPE_META[t].text}`} aria-hidden />
                        <span className="text-[13px] text-white/80 group-hover:text-white transition-colors">
                          {TYPE_META[t].label}
                        </span>
                      </span>
                      <span className="text-[13px] tabular-nums text-white/65">{n}</span>
                    </div>
                    <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${TYPE_META[t].bar}`}
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
