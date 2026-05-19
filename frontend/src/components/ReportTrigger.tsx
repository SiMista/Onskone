import { useState } from 'react';
import { Icon } from '@iconify/react';
import ReportModal from './ReportModal';
import type { TicketType } from '../utils/ticketsApi';

type Variant = 'footer' | 'discreet';

interface ReportTriggerProps {
  variant?: Variant;
  label?: string;
  className?: string;
  extraContext?: string;
  defaultType?: TicketType;
}

const ReportTrigger = ({ variant = 'footer', label, className = '', extraContext, defaultType }: ReportTriggerProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const baseClass = variant === 'footer'
    ? 'inline-flex items-center gap-1 hover:text-white transition-colors cursor-pointer'
    : 'inline-flex items-center gap-1 text-[11px] md:text-xs text-gray-600 hover:text-gray-900 italic cursor-pointer transition-colors';

  const displayLabel = label ?? 'Signaler';

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`${baseClass} ${className}`}
      >
        {variant === 'footer' && (
          <Icon icon="ph:warning-bold" className="w-3 h-3" aria-hidden />
        )}
        {variant === 'discreet' && (
          <Icon icon="ph:warning-bold" className="w-3.5 h-3.5" aria-hidden />
        )}
        {displayLabel}
      </button>
      {isOpen && (
        <ReportModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          extraContext={extraContext}
          defaultType={defaultType}
        />
      )}
    </>
  );
};

export default ReportTrigger;
