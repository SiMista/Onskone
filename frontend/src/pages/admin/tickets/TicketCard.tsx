import { Icon } from '@iconify/react';
import { Ticket, TicketStatus } from '../../../utils/ticketsApi';
import { TYPE_META, STATUS_META, STATUS_ORDER, formatDate, formatRelative } from '../shared';
import { Strip, badge, btn } from '../ui';

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
      className={`group relative rounded-lg border bg-black/25 transition-colors overflow-hidden
        ${isSelected
          ? 'border-amber-300/60'
          : 'border-white/[0.06] hover:border-white/15'}`}
    >
      <Strip color={type.dot} />

      <div className="px-2.5 py-2 pl-3.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Zone de clic élargie (-m/p) autour de la petite case. */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
            className="-m-1.5 p-1.5 flex-shrink-0 cursor-pointer"
            title={isSelected ? 'Désélectionner' : 'Sélectionner'}
            aria-label={isSelected ? `Désélectionner le ticket #${ticket.id}` : `Sélectionner le ticket #${ticket.id}`}
            aria-pressed={isSelected}
          >
            <span className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${isSelected
              ? 'bg-amber-400 border-amber-400 text-black'
              : 'border-white/30 hover:border-white/60 bg-transparent'
              }`}>
              {isSelected && <Icon icon="mdi:check-bold" className="w-3 h-3" aria-hidden />}
            </span>
          </button>

          <span className={`inline-flex items-center gap-1 text-[12px] font-semibold ${type.text}`}>
            <Icon icon={type.icon} className="w-4 h-4" aria-hidden />
            {type.label}
          </span>

          <span className="font-mono text-[12px] text-white/50 tabular-nums">#{ticket.id}</span>

          {ticket.lobby_code && (
            <span className="font-mono text-[12px] tracking-widest font-bold text-white/60 truncate" title={`Salon ${ticket.lobby_code}`}>
              {ticket.lobby_code}
            </span>
          )}

          {isHot && (
            <span
              className={badge('rose')}
              title="Plusieurs tickets viennent de ce salon"
            >
              <Icon icon="mdi:fire" className="w-3.5 h-3.5" aria-hidden />
              Récurrent
            </span>
          )}

          <span className="ml-auto text-[12px] text-white/50 tabular-nums whitespace-nowrap" title={formatDate(ticket.created_at)}>
            {formatRelative(ticket.created_at)}
          </span>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="cursor-pointer shrink-0 w-8 h-8 inline-flex items-center justify-center rounded-lg text-white/60 hover:text-rose-200 hover:bg-rose-500/15 transition-colors"
            title="Supprimer le ticket"
            aria-label={`Supprimer le ticket #${ticket.id}`}
          >
            <Icon icon="mdi:trash-can-outline" className="w-4 h-4" aria-hidden />
          </button>
        </div>

        <button type="button" onClick={onOpen} className="w-full text-left mt-1.5 cursor-pointer" title="Ouvrir le ticket">
          <p className="text-[13px] text-white/85 leading-snug whitespace-pre-wrap break-words line-clamp-2">
            {ticket.message}
          </p>
          {ticket.pseudo && (
            <p className="inline-flex items-center gap-1 text-[12px] text-white/60 mt-1">
              <Icon icon="mdi:account-outline" className="w-3.5 h-3.5 text-white/40" aria-hidden />
              {ticket.pseudo}
            </p>
          )}
        </button>

        <div className="mt-1.5 flex items-center gap-1 flex-wrap sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity">
          <span className="text-[12px] text-white/50 mr-0.5">Passer en</span>
          {STATUS_ORDER.filter((s) => s !== ticket.status).map((s) => (
            <button
              type="button"
              key={s}
              onClick={(e) => { e.stopPropagation(); onStatusChange(s); }}
              className={btn('secondary', 'sm')}
              title={`Passer le ticket en « ${STATUS_META[s].label} »`}
            >
              <Icon icon={STATUS_META[s].icon} className={`w-4 h-4 ${STATUS_META[s].text}`} aria-hidden />
              {STATUS_META[s].label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
