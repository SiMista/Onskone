import { useEffect } from 'react';
import { Icon } from '@iconify/react';
import { Ticket, TicketStatus } from '../../../utils/ticketsApi';
import { TYPE_META, STATUS_META, STATUS_ORDER, formatDate } from '../shared';

export const TicketDetailModal = ({
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
