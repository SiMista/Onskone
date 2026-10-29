import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';
import type { MaintenanceMode, MaintenanceState } from '@onskone/shared';
import { useToast } from '../../components/Toast';
import { DangerCard, DangerButton } from './DangerCard';
import { ConfirmDialog } from './ConfirmDialog';
import { fetchAdminLobbies, fetchMaintenance, setMaintenanceMode } from '../../utils/adminDataApi';
import { formatDate } from './shared';

const MODES: { id: MaintenanceMode; title: string; desc: string; activeLabel: string }[] = [
  {
    id: 'new_games',
    title: 'Nouvelles parties seulement',
    desc: 'Les parties déjà commencées se terminent normalement.',
    activeLabel: 'Nouvelles parties bloquées',
  },
  {
    id: 'all',
    title: 'Tout couper',
    desc: 'Même en pleine partie : les manches continuent sans les joueurs.',
    activeLabel: 'Jeu coupé pour tous',
  },
];

export const MaintenancePanel = ({ onStateChange }: { onStateChange?: (s: MaintenanceState) => void }) => {
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
      onStateChange?.(s);
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
      onStateChange?.(next);
      showToast(next.active ? 'Maintenance activée.' : 'Maintenance levée, le jeu est rouvert.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur', 'error');
    } finally {
      setBusy(false);
    }
  }, [mode, showToast, onStateChange]);

  const active = state?.active ?? false;
  const gamesLabel = playingLobbies === null ? null : `${playingLobbies} partie${playingLobbies > 1 ? 's' : ''} en cours`;
  const modeLabel = MODES.find((m) => m.id === state?.mode)?.activeLabel;
  const statusPill = active
    ? { tone: 'alert' as const, label: `Active : ${modeLabel}` }
    : { tone: 'ok' as const, label: 'Désactivée' };

  return (
    <div>
      <DangerCard
        tone="rose"
        icon="mdi:wrench-clock"
        title="Maintenance"
        summary="Ferme le jeu le temps d'une intervention : les joueurs voient un écran « maintenance », en direct."
        status={state ? statusPill : null}
        meta={active && state?.since ? <p>Active depuis le {formatDate(state.since)}.</p> : null}
        loading={state === null}
        details={(
          <ul className="list-disc pl-4 space-y-1">
            <li>Effet immédiat, sans recharger, pour l'activation comme pour la levée. Survit aux redémarrages du serveur.</li>
            <li>Inutile si le serveur plante : les joueurs voient déjà un écran « serveur indisponible ».</li>
            <li>« Tout couper » ne met pas les parties en pause : elles continuent sans les joueurs.</li>
          </ul>
        )}
      >
        {state && (active ? (
          <DangerButton variant="safe" icon="mdi:lock-open-variant-outline" busy={busy} onClick={() => apply(false)}>
            Lever la maintenance
          </DangerButton>
        ) : (
          <>
            <div role="radiogroup" aria-label="Que bloquer ?" className="rounded-lg border border-white/10 bg-black/25 divide-y divide-white/[0.06] overflow-hidden">
              {MODES.map((m) => {
                const selected = mode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setMode(m.id)}
                    className={`cursor-pointer w-full text-left flex items-start gap-3 px-3 py-2.5 min-h-[44px] transition-colors ${selected ? 'bg-rose-500/10' : 'hover:bg-white/[0.04]'}`}
                  >
                    <Icon icon={selected ? 'mdi:radiobox-marked' : 'mdi:radiobox-blank'} className={`w-5 h-5 mt-0.5 shrink-0 ${selected ? 'text-rose-300' : 'text-white/50'}`} />
                    <span>
                      <span className="block text-[14px] font-semibold text-white">{m.title}</span>
                      <span className="block mt-0.5 text-[12px] leading-snug text-white/60">{m.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <DangerButton variant="danger" icon="mdi:alert-octagon-outline" busy={busy} onClick={() => setConfirming(true)}>
              Activer la maintenance
            </DangerButton>
          </>
        ))}
      </DangerCard>

      {confirming && createPortal(
        <ConfirmDialog
          title={mode === 'all' ? 'Couper le jeu pour tout le monde ?' : 'Bloquer les nouvelles parties ?'}
          message={mode === 'all'
            ? `Tous les joueurs verront l'écran de maintenance tout de suite, même en pleine partie${gamesLabel ? ` (${gamesLabel})` : ''}. Les parties ne sont pas mises en pause : les manches continuent sans les joueurs et peuvent se finir avant que tu lèves la maintenance.`
            : `Plus personne ne pourra créer de salon ni lancer de partie. Les parties déjà commencées${gamesLabel ? ` (${gamesLabel})` : ''} finissent normalement.`}
          confirmLabel="Activer la maintenance"
          requireText={mode === 'all' ? 'MAINTENANCE' : undefined}
          onConfirm={() => { setConfirming(false); apply(true); }}
          onCancel={() => setConfirming(false)}
        />,
        document.body,
      )}
    </div>
  );
};
