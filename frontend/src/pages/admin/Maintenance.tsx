import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';
import type { MaintenanceMode, MaintenanceState } from '@onskone/shared';
import { useToast } from '../../components/Toast';
import { DangerCard, DangerButton } from './DangerCard';
import { ConfirmDialog } from './ConfirmDialog';
import { fetchAdminLobbies, fetchMaintenance, setMaintenanceMode } from '../../utils/adminDataApi';
import { formatDate } from './shared';

const MODES: { id: MaintenanceMode; title: string; desc: string }[] = [
  {
    id: 'new_games',
    title: 'Nouvelles parties seulement',
    desc: 'Plus de création de salon ni de lancement de partie. Les parties en cours se terminent normalement.',
  },
  {
    id: 'all',
    title: 'Tout couper',
    desc: 'Écran de maintenance pour tout le monde, y compris en pleine partie. Les parties ne sont pas mises en pause : les manches continuent sans les joueurs (réponses vides, timers qui expirent) et peuvent se terminer avant la levée.',
  },
];

export const MaintenancePanel = ({ onStateChange }: { onStateChange?: (active: boolean) => void }) => {
  const showToast = useToast();
  const [state, setState] = useState<MaintenanceState | null>(null);
  const [playingLobbies, setPlayingLobbies] = useState<number | null>(null);
  const [mode, setMode] = useState<MaintenanceMode>('new_games');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, lobbies] = await Promise.all([
        fetchMaintenance(),
        fetchAdminLobbies().catch(() => null),
      ]);
      setState(s);
      if (s.active) setMode(s.mode);
      if (lobbies) setPlayingLobbies(lobbies.filter((l) => l.phase === 'playing').length);
      onStateChange?.(s.active);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur', 'error');
    }
  }, [showToast, onStateChange]);

  useEffect(() => { load(); }, [load]);

  const apply = useCallback(async (active: boolean) => {
    setBusy(true);
    try {
      const next = await setMaintenanceMode(active, active ? mode : undefined);
      setState(next);
      onStateChange?.(next.active);
      showToast(next.active ? 'Maintenance activée.' : 'Maintenance levée, le jeu est rouvert.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur', 'error');
    } finally {
      setBusy(false);
    }
  }, [mode, showToast, onStateChange]);

  const active = state?.active ?? false;
  const gamesLabel = playingLobbies === null ? null : `${playingLobbies} partie${playingLobbies > 1 ? 's' : ''} en cours`;
  const statusPill = active
    ? { tone: 'alert' as const, label: gamesLabel ? `Active · ${gamesLabel}` : 'Active' }
    : gamesLabel ? { tone: 'neutral' as const, label: gamesLabel, icon: 'mdi:gamepad-variant-outline' } : null;
  const modeLabel = MODES.find((m) => m.id === state?.mode)?.title;

  return (
    <div>
      <DangerCard
        tone="rose"
        icon="mdi:wrench-clock"
        title="Maintenance"
        summary="Affiche l'écran de maintenance aux joueurs, en direct. La levée aussi."
        status={state ? statusPill : null}
        loading={state === null}
        details={(
          <>
            <p>Appliqué en direct à tous les joueurs connectés, sans rechargement, et la levée aussi. Survit aux restarts du serveur.</p>
            <p>Si le serveur crashe pour de vrai, les joueurs voient tout seuls un écran « serveur indisponible » : ce bouton ne sert que quand le back est vivant.</p>
            <p>Les parties en cours restent en mémoire dans les deux modes : elles reprennent à la levée.</p>
          </>
        )}
      >
        {state && (
          <>
            {active ? (
              <div className="rounded-xl border border-rose-400/30 bg-rose-500/[0.08] p-3.5">
                <p className="text-[14px] font-semibold text-rose-100">{modeLabel}</p>
                {state.since && <p className="mt-0.5 text-[12px] text-white/50">depuis le {formatDate(state.since)}</p>}
              </div>
            ) : (
              <div role="radiogroup" aria-label="Mode de maintenance" className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {MODES.map((m) => {
                  const selected = mode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setMode(m.id)}
                      className={`cursor-pointer text-left flex items-start gap-3 p-3.5 min-h-[44px] rounded-xl border transition-colors ${selected
                        ? 'border-rose-400/60 bg-rose-500/10'
                        : 'border-white/10 bg-white/[0.03] hover:border-white/25'
                        }`}
                    >
                      <Icon icon={selected ? 'mdi:radiobox-marked' : 'mdi:radiobox-blank'} className={`w-5 h-5 mt-0.5 shrink-0 ${selected ? 'text-rose-300' : 'text-white/35'}`} />
                      <span>
                        <span className="block text-[14px] font-semibold text-white">{m.title}</span>
                        <span className="block mt-0.5 text-[12px] leading-snug text-white/55">{m.desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              {active ? (
                <DangerButton variant="safe" icon="mdi:lock-open-variant-outline" busy={busy} onClick={() => apply(false)}>
                  Lever la maintenance
                </DangerButton>
              ) : (
                <DangerButton variant="danger" icon="mdi:alert-octagon-outline" busy={busy} onClick={() => setConfirming(true)}>
                  Activer la maintenance
                </DangerButton>
              )}
            </div>
          </>
        )}
      </DangerCard>

      {confirming && createPortal(
        <ConfirmDialog
          title={mode === 'all' ? 'Tout couper ?' : 'Bloquer les nouvelles parties ?'}
          message={mode === 'all'
            ? `Tous les joueurs verront l'écran de maintenance tout de suite, y compris les ${playingLobbies ?? '?'} partie(s) en cours. Elles ne sont pas mises en pause : les manches continuent sans les joueurs et peuvent se terminer avant la levée.`
            : `Plus personne ne pourra créer de salon ni lancer de partie. Les ${playingLobbies ?? '?'} partie(s) en cours continuent.`}
          confirmLabel="Activer"
          requireText={mode === 'all' ? 'MAINTENANCE' : undefined}
          onConfirm={() => { setConfirming(false); apply(true); }}
          onCancel={() => setConfirming(false)}
        />,
        document.body,
      )}
    </div>
  );
};
