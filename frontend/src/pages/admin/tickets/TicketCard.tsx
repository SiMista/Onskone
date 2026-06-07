import { Ticket, TicketStatus } from '../../../utils/ticketsApi';
import { TYPE_META, STATUS_META, STATUS_ORDER, formatDate, formatRelative } from '../shared';

interface TicketCardProps {
  ticket: Ticket;
  isSelected: boolean;
  isHot: boolean;
  onOpen: () => void;
  onToggleSelect: () => void;
  onStatusChange: (status: TicketStatus) => void;
  onDelete: () => void;
}

export const TicketCard = ({
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
