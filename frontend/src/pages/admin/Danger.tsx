import { MaintenancePanel } from './Maintenance';
import { VersionGatePanel } from './VersionGate';
import type { VersionGateState } from '../../utils/adminDataApi';

// Zone danger : tout ce qui coupe ou contraint les joueurs en prod. Une carte par action,
// même structure (état en en-tête, action en bas, détail replié), empilées pleine largeur
// sur téléphone et côte à côte sur grand écran.
export const DangerPanel = ({
  onMaintenanceChange, onGateChange,
}: {
  onMaintenanceChange: (active: boolean) => void;
  onGateChange: (s: VersionGateState) => void;
}) => (
  <div className="space-y-4 max-w-5xl">
    <div>
      <h1 className="text-[20px] font-semibold tracking-tight text-white">Zone danger</h1>
      <p className="mt-0.5 text-[13px] text-white/50">Actions qui touchent les joueurs en production. Chacune demande une confirmation.</p>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      <MaintenancePanel onStateChange={onMaintenanceChange} />
      <VersionGatePanel onStateChange={onGateChange} />
    </div>
  </div>
);
