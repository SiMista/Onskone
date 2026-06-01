import { useMemo } from 'react';
import { Ticket, TicketStatus, TicketType } from '../../utils/ticketsApi';
import { TYPE_META, STATUS_META, formatRelative } from './shared';

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
      className={`text-left rounded-lg surface-glass surface-glass-hover transition-colors p-3 ${onClick ? 'cursor-pointer' : ''}`}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">{label}</p>
      <p className="mt-1 text-[26px] font-semibold tracking-tight tabular-nums text-white leading-tight">
        {value}
      </p>
      {hint && <p className="mt-0.5 font-mono text-[10px] text-white/35">{hint}</p>}
    </Tag>
  );
};

export const OverviewPanel = ({
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
      <div>
        <SectionLabel>Vue d'ensemble</SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCell label="Ouverts" value={open} hint={`${stats.byStatus.new || 0} nouveau · ${stats.byStatus.in_progress || 0} wip`} onClick={() => onJumpToTickets('new')} />
          <KpiCell label="24 h" value={stats.last24h} hint="reçus aujourd'hui" />
          <KpiCell label="7 jours" value={stats.last7d} hint="cadence hebdo" />
          <KpiCell label="Résolus" value={stats.byStatus.resolved || 0} hint={`${stats.byStatus.wont_fix || 0} sans suite`} onClick={() => onJumpToTickets('resolved')} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
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
            <div className="rounded-lg surface-glass py-10 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-white/30">
              inbox vide
            </div>
          ) : (
            <div className="rounded-lg surface-glass overflow-hidden divide-y divide-white/[0.04]">
              {stats.recent.map((t) => {
                const type = TYPE_META[t.type];
                const status = STATUS_META[t.status];
                return (
                  <button
                    key={t.id}
                    onClick={() => onJumpToTickets()}
                    className="w-full text-left px-3 py-2.5 hover:bg-white/[0.025] transition-colors cursor-pointer flex items-start group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        <span className={`px-1.5 py-0.5 rounded border font-mono text-[10px] uppercase tracking-wider inline-flex items-center gap-1 ${type.chip}`}>
                          <span aria-hidden className="text-[11px] leading-none">{type.glyph}</span>
                          {type.label}
                        </span>
                        <span className={`inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider ${status.text}`}>
                          <span aria-hidden className={`inline-block h-1.5 w-1.5 rounded-full ${status.dot}`} />
                          {status.label}
                        </span>
                        {t.lobby_code && (
                          <span className="font-mono text-[10px] tracking-widest font-bold text-white/55">{t.lobby_code}</span>
                        )}
                        <span className="ml-auto font-mono text-[10px] text-white/35 tabular-nums whitespace-nowrap">{formatRelative(t.created_at)}</span>
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

        <div className="lg:col-span-2 space-y-5">
          <div>
            <SectionLabel>Lobbies signalés</SectionLabel>
            {stats.hotLobbies.length === 0 ? (
              <div className="rounded-lg surface-glass py-6 text-center font-mono text-[11px] text-white/30">
                aucun lobby récurrent
              </div>
            ) : (
              <div className="rounded-lg surface-glass overflow-hidden divide-y divide-white/[0.04]">
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
            <div className="rounded-lg surface-glass p-3 space-y-2.5">
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
                      <span className="flex items-center gap-1.5">
                        <span aria-hidden className="font-mono text-[12px] leading-none text-white/75">{TYPE_META[t].glyph}</span>
                        <span className="font-mono text-[11px] text-white/75 group-hover:text-white transition-colors">
                          {TYPE_META[t].label}
                        </span>
                      </span>
                      <span className="font-mono text-[11px] tabular-nums text-white/55">{n}</span>
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
