import { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { fetchVersionGate } from '../../utils/adminDataApi';
import { VersionGatePanel } from './VersionGate';

// Entrée "Maj forcée" dans la barre du haut de l'admin : pastille de statut +
// popover ancrée sous le bouton (menu déroulant). Auto-charge le statut pour
// colorer l'icône.
export const VersionGateButton = () => {
  const [open, setOpen] = useState(false);
  const [blocking, setBlocking] = useState(false);
  // Une confirmation (portalée) est ouverte : on masque la popover derrière.
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    fetchVersionGate().then((s) => setBlocking(s.blocking)).catch(() => { /* silent */ });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Mise à jour forcée"
        aria-label="Mise à jour forcée"
        aria-expanded={open}
        className={`relative flex cursor-pointer items-center gap-1.5 px-2.5 py-1 rounded-md border transition-colors font-mono text-[10px] uppercase tracking-[0.22em] ${open || blocking
          ? 'border-violet-400/50 bg-violet-500/15 text-violet-100'
          : 'border-violet-400/25 bg-violet-500/[0.06] text-violet-200/80 hover:text-violet-100 hover:bg-violet-500/15 hover:border-violet-400/50'
          }`}
      >
        <Icon icon="mdi:cellphone-arrow-down" className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">version</span>
        {blocking && (
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
        )}
        <Icon icon="mdi:chevron-down" className={`w-3 h-3 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          {/* Capteur de clic extérieur (désactivé pendant une confirmation) */}
          <div className={`fixed inset-0 z-40 ${confirming ? 'hidden' : ''}`} onClick={() => setOpen(false)} />
          <div
            className={`absolute left-0 top-full mt-2 z-50 w-[360px] max-w-[calc(100vw-1.5rem)] max-h-[75vh] overflow-y-auto custom-scroll
              rounded-xl border border-violet-400/25 bg-gradient-to-b from-[#1d1830] to-[#161a24]
              shadow-[0_30px_80px_-20px_rgba(124,58,237,0.35)] p-4 animate-fade-in ${confirming ? 'hidden' : ''}`}
          >
            <VersionGatePanel
              onStateChange={(s) => setBlocking(s.blocking)}
              onConfirmingChange={setConfirming}
            />
          </div>
        </>
      )}
    </div>
  );
};
