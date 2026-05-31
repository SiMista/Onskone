import { useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { Icon } from '@iconify/react';
import Modal from './Modal';
import Button from './Button';
import Dropdown from './Dropdown';
import { useToast } from './Toast';
import { submitTicket, TicketsApiError } from '../utils/ticketsApi';
import { TICKET_CATEGORIES, TicketType } from '../constants/ticketCategories';
import { useLocale } from '../i18n';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  extraContext?: string;
  defaultType?: TicketType;
}

const ReportModal = ({ isOpen, onClose, extraContext, defaultType }: ReportModalProps) => {
  const [selectedType, setSelectedType] = useState<TicketType | null>(defaultType ?? null);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const showToast = useToast();
  const { t } = useLocale();
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
      showToast(t.report.success, 'success');
      reset();
      onClose();
    } catch (err) {
      const msg =
        err instanceof TicketsApiError ? t.apiErrors[err.code]
        : err instanceof Error ? err.message
        : t.report.unknownError;
      showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t.report.title}>
      <div className="space-y-4 min-w-0">
        <div>
          <label className="block text-sm font-bold text-gray-800 mb-1">
            {t.report.categoryLabel}
          </label>
          <Dropdown<TicketType>
            value={selectedType ?? ''}
            onChange={(v) => setSelectedType(v)}
            options={TICKET_CATEGORIES.map((cat) => {
              const meta = t.ticketCategories[cat.value];
              return {
                value: cat.value,
                label: (
                  <span className="flex flex-col min-w-0 leading-tight">
                    <span>{meta.label}</span>
                    <span className="font-normal text-gray-500 text-xs whitespace-normal mt-0.5">
                      {meta.description}
                    </span>
                  </span>
                ),
                selectedLabel: meta.label,
                prefix: <Icon icon={cat.icon} className="w-5 h-5" />,
              };
            })}
            placeholder={t.report.categoryPlaceholder}
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-800 mb-1">
            {t.report.messageLabel}
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={isSubmitting || !selectedType}
            placeholder={selectedType ? t.report.messagePlaceholder : t.report.messageDisabled}
            maxLength={2000}
            rows={5}
            cols={1}
            className="block w-full min-w-0 rounded-lg border-2 border-gray-300 px-3 py-2 text-sm text-black placeholder:text-gray-400 focus:outline-none focus:border-black disabled:bg-gray-100 resize-y"
          />
          <div className="text-[10px] text-gray-500 mt-1 text-right">{message.length} / 2000</div>
        </div>

        <div className="flex justify-end items-center gap-2 pt-2 pr-1.5 pb-1.5">
          <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>
            {t.report.cancel}
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!selectedType || message.trim().length < 3}
            isLoading={isSubmitting}
          >
            {t.report.send}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ReportModal;
