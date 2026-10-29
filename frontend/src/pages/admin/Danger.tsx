import { Icon } from '@iconify/react';
import type { MaintenanceState } from '@onskone/shared';
import { MaintenancePanel } from './Maintenance';
import { VersionGatePanel } from './VersionGate';
import type { VersionGateState } from '../../utils/adminDataApi';
import { formatRelative } from './shared';
import { PANEL, badge } from './ui';

const sinceLabel = (ms: number): string => {
  const rel = formatRelative(ms);
  return rel === 'à l\'instant' ? 'à l\'instant' : `depuis ${rel}`;
};

// Restrictions temporaires en cours, en mots simples. Source unique du bandeau d'alerte,
// du résumé de la page et du titre de l'onglet du navigateur.
export const activeRestrictions = (
  maintenance: MaintenanceState | null,
  gate: VersionGateState | null,
): string[] => [
  maintenance?.active && (maintenance.mode === 'all'
    ? 'Maintenance : jeu coupé pour tout le monde'
    : 'Maintenance : nouvelles parties bloquées'),
  gate?.blocking && `Mise à jour obligatoire sous la ${gate.minVersion}`,
].filter((s): s is string => !!s);

// Bandeau clignotant sous le header, sur tous les onglets : ces restrictions sont temporaires,
// il ne faut pas oublier de les lever. Un clic mène à la page Accès joueurs.
export const RestrictionsBanner = ({
  maintenance, gate, onOpen,
}: {
  maintenance: MaintenanceState | null;
  gate: VersionGateState | null;
  onOpen: () => void;
}) => {
  const items = activeRestrictions(maintenance, gate);
  if (items.length === 0) return null;
  const since = maintenance?.active && maintenance.since ? ` (maintenance ${sinceLabel(maintenance.since)})` : '';
  return (
    <button
      type="button"
      onClick={onOpen}
      className="admin-alert-blink cursor-pointer block w-full border-t border-rose-400/40 text-rose-50 hover:brightness-125 transition-[filter]"
    >
      <span className="max-w-7xl mx-auto px-3 sm:px-6 py-2 flex items-center gap-3 text-left">
        <span className="relative flex h-3 w-3 shrink-0" aria-hidden>
          <span className="absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75 animate-ping" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
        </span>
        <span className="flex-1 min-w-0 text-[13px] leading-snug">
          <strong className="font-semibold">{items.join(' · ')}</strong>
          <span className="text-rose-100/80">{since}. Pense à lever quand c'est fini.</span>
        </span>
        <span className="hidden sm:inline-flex shrink-0 items-center gap-1 text-[13px] font-medium">
          Gérer
          <Icon icon="mdi:chevron-right" className="w-4 h-4" />
        </span>
      </span>
    </button>
  );
};

// Accès joueurs : tout ce qui coupe ou contraint les joueurs en prod. Un seul cadre, une ligne
// par interrupteur (état + explication à gauche, actions à droite), façon page de réglages.
export const DangerPanel = ({
  playingCount, onMaintenanceChange, onGateChange,
}: {
  playingCount: number | null;
  onMaintenanceChange: (s: MaintenanceState) => void;
  onGateChange: (s: VersionGateState) => void;
}) => (
  <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-white">Accès joueurs</h1>
        <p className="mt-1 text-[14px] text-white/60 max-w-2xl">
          Les interrupteurs qui ferment le jeu ou obligent à mettre à jour. Ils touchent les vrais joueurs, en
          direct, et restent actifs tant que tu ne les lèves pas.
        </p>
      </div>
      {playingCount !== null && (
        <p className={badge(playingCount > 0 ? 'amber' : 'neutral')}>
          <Icon icon="mdi:gamepad-variant-outline" className="w-3.5 h-3.5" aria-hidden />
          {playingCount > 0
            ? `${playingCount} partie${playingCount > 1 ? 's' : ''} en cours : mieux vaut attendre`
            : 'Personne ne joue : bon moment pour agir'}
        </p>
      )}
    </div>

    <div className={`${PANEL} divide-y divide-white/[0.06] overflow-hidden`}>
      <VersionGatePanel onStateChange={onGateChange} />
      <MaintenancePanel onStateChange={onMaintenanceChange} />
    </div>
  </div>
);
