import { useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { Icon } from '@iconify/react';
import Modal from './Modal';
import Button from './Button';
import Dropdown from './Dropdown';
import { useToast } from './Toast';
import { submitTicket, TicketType } from '../utils/ticketsApi';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  extraContext?: string;
  defaultType?: TicketType;
}

interface TypeOption {
  value: TicketType;
  label: string;
  description: string;
  icon: string;
}

const TYPES: TypeOption[] = [
  {
    value: 'question_report',
    label: 'Question pourrie',
    description: 'Une question gênante, ambiguë ou mal formulée.',
    icon: 'fluent-emoji-flat:warning',
  },
  {
    value: 'bug',
    label: 'Bug technique',
    description: 'Un truc qui marche pas comme attendu.',
    icon: 'fluent-emoji-flat:bug',
  },
  {
    value: 'suggestion',
    label: 'Idée / suggestion',
    description: 'Une proposition de fonctionnalité ou de contenu.',
    icon: 'fluent-emoji-flat:light-bulb',
  },
];

const ReportModal = ({ isOpen, onClose, extraContext, defaultType }: ReportModalProps) => {
  const [selectedType, setSelectedType] = useState<TicketType | null>(defaultType ?? null);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const showToast = useToast();
  const location = useLocation();
  const params = useParams();
  const lobbyCode = (params as { lobbyCode?: string }).lobbyCode;

  const reset = () => {
    setSelectedType(defaultType ?? null);
    setMessage('');
  };

  const handleClose = () => {
    if (isSubmitting) return;
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedType || message.trim().length < 3) return;
    setIsSubmitting(true);
    try {
      const contextParts = [`URL: ${location.pathname}${location.search}`];
      if (extraContext) contextParts.push(extraContext);
      await submitTicket({
        type: selectedType,
        message: message.trim(),
        context: contextParts.join('\n'),
        lobbyCode,
      });
      showToast('Merci ! Ton signalement a été envoyé.', 'success');
      reset();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Signaler un problème">
      <div className="space-y-4 min-w-0">
        <div>
          <label className="block text-sm font-bold text-gray-800 mb-1">
            Catégorie de problème
          </label>
          <Dropdown<TicketType>
            value={selectedType ?? ''}
            onChange={(v) => setSelectedType(v)}
            options={TYPES.map((t) => ({
              value: t.value,
              label: (
                <span className="flex items-baseline gap-2 min-w-0">
                  <span className="shrink-0">{t.label}</span>
                  <span className="font-normal text-gray-500 text-xs truncate">
                    {t.description}
                  </span>
                </span>
              ),
              prefix: <Icon icon={t.icon} className="w-5 h-5" />,
            }))}
            placeholder="Sélectionne une catégorie…"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-800 mb-1">
            Message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={isSubmitting || !selectedType}
            placeholder={selectedType ? 'Décris en quelques mots…' : 'Sélectionne d\'abord un type ci-dessus.'}
            maxLength={2000}
            rows={5}
            cols={1}
            className="block w-full min-w-0 rounded-lg border-2 border-gray-300 px-3 py-2 text-sm text-black placeholder:text-gray-400 focus:outline-none focus:border-black disabled:bg-gray-100 resize-y"
          />
          <div className="text-[10px] text-gray-500 mt-1 text-right">{message.length} / 2000</div>
        </div>

        <div className="flex justify-end items-center gap-2 pt-2 pr-1.5 pb-1.5">
          <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!selectedType || message.trim().length < 3}
            isLoading={isSubmitting}
          >
            Envoyer
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ReportModal;
