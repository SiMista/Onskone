import { useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useToast } from '../../../components/Toast';
import { Ticket, TicketStatus } from '../../../utils/ticketsApi';
import { TYPE_META, STATUS_META, STATUS_ORDER, formatDate } from '../shared';
import { FLOATING, btn } from '../ui';

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[12px] font-medium text-white/55 mb-0.5">{children}</p>
);

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

  const showToast = useToast();
  const type = TYPE_META[ticket.type];
  const status = STATUS_META[ticket.status];

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast('Copié dans le presse-papiers', 'success');
    } catch {
      showToast('Copie impossible sur ce navigateur', 'error');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center sm:px-4 sm:py-6 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Ticket #${ticket.id}`}
        className={`relative w-full sm:max-w-2xl h-full sm:h-auto sm:max-h-[85vh] overflow-y-auto custom-scroll ${FLOATING} max-sm:rounded-none max-sm:border-0`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-[#1f2433]/95 backdrop-blur px-4 sm:px-5 py-3 border-b border-white/[0.06] flex items-center gap-2 z-10 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-[13px] font-semibold ${type.text}`}>
            <Icon icon={type.icon} className="w-4 h-4" aria-hidden />
            {type.label}
          </span>
          <span aria-hidden className="text-white/20">·</span>
          <span className={`inline-flex items-center gap-1 text-[13px] font-medium ${status.text}`}>
            <Icon icon={status.icon} className="w-4 h-4" aria-hidden />
            {status.label}
          </span>
          <span className="font-mono text-[12px] text-white/50 tabular-nums">#{ticket.id}</span>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer ml-auto w-10 h-10 sm:w-8 sm:h-8 inline-flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors"
            title="Fermer (Échap)"
            aria-label="Fermer"
          >
            <Icon icon="mdi:close" className="w-4 h-4" aria-hidden />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-5">
          <div>
            <FieldLabel>Message du joueur</FieldLabel>
            <p className="text-[14px] text-white/90 leading-relaxed whitespace-pre-wrap break-words mt-1">
              {ticket.message}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
            <div>
              <FieldLabel>Pseudo</FieldLabel>
              <p className="text-white/85">{ticket.pseudo || <span className="text-white/50">Non renseigné</span>}</p>
            </div>
            <div>
              <FieldLabel>Salon</FieldLabel>
              {ticket.lobby_code ? (
                <button
                  type="button"
                  onClick={() => copy(ticket.lobby_code!)}
                  className="font-mono font-bold tracking-widest text-white/85 hover:text-amber-200 transition-colors cursor-pointer"
                  title="Copier le code du salon"
                >
                  <span className="inline-flex items-center gap-1">
                    {ticket.lobby_code}
                    <Icon icon="mdi:content-copy" className="w-3.5 h-3.5 text-white/40" aria-hidden />
                  </span>
                </button>
              ) : <p className="text-white/50">Hors salon</p>}
            </div>
            <div>
              <FieldLabel>Reçu le</FieldLabel>
              <p className="text-white/85 tabular-nums">{formatDate(ticket.created_at)}</p>
            </div>
            <div>
              <FieldLabel>Dernière modification</FieldLabel>
              <p className="text-white/85 tabular-nums">{formatDate(ticket.updated_at)}</p>
            </div>
          </div>

          {ticket.context && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div>
                  <FieldLabel>Détails techniques</FieldLabel>
                  <p className="text-[12px] text-white/50">Version de l'app, appareil, page où le joueur était.</p>
                </div>
                <button
                  type="button"
                  onClick={() => copy(ticket.context!)}
                  className={btn('ghost', 'sm')}
                  title="Copier les détails techniques"
                >
                  <Icon icon="mdi:content-copy" className="w-3.5 h-3.5" aria-hidden />
                  Copier
                </button>
              </div>
              <pre className="rounded-lg border border-white/[0.06] bg-black/25 p-3 font-mono text-[12px] text-white/75 whitespace-pre-wrap break-all max-h-48 overflow-y-auto custom-scroll">
                {ticket.context}
              </pre>
            </div>
          )}

        </div>

        <div className="sticky bottom-0 bg-[#1f2433]/95 backdrop-blur px-4 sm:px-5 py-3 border-t border-white/[0.06] space-y-2 sm:space-y-0 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 sm:contents">
            <span className="shrink-0 text-[13px] text-white/60 sm:mr-1 whitespace-nowrap">Passer en</span>
            {STATUS_ORDER.filter((s) => s !== ticket.status).map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => onStatusChange(s)}
                className={`shrink-0 ${btn('secondary')}`}
              >
                <Icon icon={STATUS_META[s].icon} className={`w-4 h-4 ${STATUS_META[s].text}`} aria-hidden />
                {STATUS_META[s].label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onDelete}
            className={`w-full sm:w-auto sm:ml-auto ${btn('danger')}`}
          >
            <Icon icon="mdi:trash-can-outline" className="w-4 h-4" aria-hidden />
            Supprimer le ticket
          </button>
        </div>
      </div>
    </div>
  );
};
