import { useEffect } from 'react';
import { Icon } from '@iconify/react';
import { AdminTab, MOBILE_TAB_META, MOBILE_TAB_ORDER } from './shared';

export const MobileBottomNav = ({
  activeTab, setActiveTab, lobbyCount, ticketCount,
}: {
  activeTab: AdminTab;
  setActiveTab: (t: AdminTab) => void;
  lobbyCount: number | null;
  ticketCount: number;
}) => (
  <nav
    aria-label="Navigation"
    className="md:hidden fixed bottom-0 left-0 right-0 z-40 backdrop-blur-xl bg-[#12151e]/92 border-t border-white/10"
    style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
  >
    <div className="grid grid-cols-6">
      {MOBILE_TAB_ORDER.map((id) => {
        const meta = MOBILE_TAB_META[id];
        const active = activeTab === id;
        const showLive = id === 'lobbies' && (lobbyCount ?? 0) > 0;
        const showTickets = id === 'tickets' && ticketCount > 0;
        return (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            aria-label={meta.label}
            className={`relative flex flex-col items-center justify-center gap-0.5 py-2 px-0.5 transition-colors ${active ? 'text-amber-300' : 'text-white/55 active:text-white/85'
              }`}
          >
            <span className="relative">
              <Icon icon={meta.icon} className="w-[22px] h-[22px]" />
              {showLive && (
                <span className="absolute -top-1.5 -right-2 inline-flex items-center justify-center min-w-[14px] h-[14px] px-1 rounded-full bg-emerald-400 text-[8.5px] font-bold leading-none text-[#0a0c12] tabular-nums ring-1 ring-[#12151e] animate-pulse">
                  {lobbyCount ?? 0}
                </span>
              )}
              {showTickets && (
                <span className="absolute -top-1.5 -right-2 inline-flex items-center justify-center min-w-[14px] h-[14px] px-1 rounded-full bg-amber-400 text-[8.5px] font-bold leading-none text-[#0a0c12] tabular-nums ring-1 ring-[#12151e]">
                  {ticketCount}
                </span>
              )}
            </span>
            <span className="font-mono text-[9.5px] uppercase tracking-[0.05em] leading-none">
              {meta.label}
            </span>
            {active && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-7 h-[2px] bg-amber-400 rounded-b-full" />
            )}
          </button>
        );
      })}
    </div>
  </nav>
);

// Bottom sheet générique (mobile).
export const BottomSheet = ({
  open, onClose, title, children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 md:hidden" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-0 left-0 right-0 rounded-t-2xl border-t border-white/10 bg-gradient-to-b from-[#1b1f2a] to-[#161a24] shadow-[0_-20px_60px_-10px_rgba(0,0,0,0.7)] animate-sheet-up max-h-[85vh] flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="pt-2.5 flex justify-center">
          <span className="w-10 h-1 rounded-full bg-white/15" />
        </div>
        <div className="px-4 pt-2 pb-3 flex items-center justify-between">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/65 font-bold">
            {title}
          </p>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-white/70 hover:text-white flex items-center justify-center transition-colors text-[12px]"
            aria-label="Fermer"
          >✕</button>
        </div>
        <div className="overflow-y-auto custom-scroll px-4 pb-5 space-y-5">
          {children}
        </div>
      </div>
    </div>
  );
};
