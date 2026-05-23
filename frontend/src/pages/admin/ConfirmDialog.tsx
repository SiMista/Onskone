import { useEffect } from 'react';

export const ConfirmDialog = ({
  title, message, confirmLabel, onConfirm, onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, onConfirm]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl border border-red-400/30 bg-gradient-to-b from-[#171018] to-[#161a24] shadow-[0_30px_80px_-20px_rgba(248,113,113,0.25)] p-5 space-y-4"
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-400" />
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-red-200">danger zone</p>
        </div>
        <div>
          <h3 className="text-[16px] font-semibold tracking-tight text-white">{title}</h3>
          <p className="mt-1 text-[13px] text-white/55">{message}</p>
        </div>
        <div className="flex items-center gap-2 justify-end pt-1">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-md border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-white/75 hover:text-white font-mono text-[11px] uppercase tracking-wider transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            autoFocus
            className="px-3 py-1.5 rounded-md border border-red-400/50 bg-red-500/20 hover:bg-red-500/35 text-red-100 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors"
          >
            ✕ {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
