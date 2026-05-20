import { useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { Icon } from '@iconify/react';
import Modal from './Modal';
import Button from './Button';
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
      <div className="space-y-4 min-w-0 overflow-x-hidden">
        <p className="text-sm font-bold text-gray-800">
          Sélectionne la catégorie de problème
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {TYPES.map((t) => {
            const isSelected = selectedType === t.value;
            return (
              <button
                key={t.value}
                onClick={() => setSelectedType(t.value)}
                disabled={isSubmitting}
                className={`text-left rounded-xl border-2 px-2 py-1.5 transition-all ${isSelected
                    ? 'border-black bg-yellow-50 shadow-md'
                    : 'border-gray-200 bg-white hover:border-gray-400'
                  } ${isSubmitting ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Icon icon={t.icon} className="w-4 h-4" />
                  <span className="font-bold text-gray-900 text-xs">{t.label}</span>
                </div>
                <p className="text-[10px] text-gray-600 leading-snug">{t.description}</p>
              </button>
            );
          })}
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
