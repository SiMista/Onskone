import { useEffect, useId, useState } from 'react';
import { Icon } from '@iconify/react';
import { FLOATING, btn } from './ui';

export const ConfirmDialog = ({
  title, message, confirmLabel, onConfirm, onCancel, requireText,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  // Action lourde : le bouton reste grisé tant que ce mot n'est pas saisi (et Entrée n'y peut rien).
  requireText?: string;
}) => {
  const [typed, setTyped] = useState('');
  const titleId = useId();
  const unlocked = !requireText || typed.trim().toUpperCase() === requireText.toUpperCase();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter' && unlocked) onConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, onConfirm, unlocked]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-sm ${FLOATING} p-5 space-y-4`}
      >
        <div className="flex items-center gap-2">
          <Icon icon="mdi:alert-outline" className="w-4 h-4 text-rose-300" aria-hidden />
          <p className="text-[12px] font-semibold text-rose-200">À confirmer</p>
        </div>
        <div>
          <h3 id={titleId} className="text-[16px] font-semibold tracking-tight text-white">{title}</h3>
          <p className="mt-1.5 text-[13px] leading-snug text-white/70">{message}</p>
        </div>
        {requireText && (
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoFocus
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder={`Tape ${requireText} pour confirmer`}
            className="w-full bg-black/25 text-white/90 border border-rose-400/30 rounded-lg px-3 py-2.5 text-[14px] font-mono
              focus:outline-none focus:border-rose-400/70 placeholder:text-white/40"
          />
        )}
        <div className="flex items-center gap-2 justify-end pt-1">
          <button
            type="button"
            onClick={onCancel}
            className={btn('secondary')}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!unlocked}
            autoFocus={!requireText}
            className={btn('danger')}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
