import type { Server } from 'socket.io';
import {
  MAINTENANCE_OFF,
  isMaintenanceMode,
  type ClientToServerEvents,
  type MaintenanceMode,
  type MaintenanceState,
  type ServerToClientEvents,
} from '@onskone/shared';
import { getConfig, setConfig } from '../db/appConfig.js';

// Mode maintenance : état persisté en SQLite (app_config) pour survivre à un
// redémarrage (un pm2 restart pendant un incident ne doit pas rouvrir le jeu).
// Pas de seed env : c'est un interrupteur d'urgence posé uniquement depuis l'admin.

type IoServer = Server<ClientToServerEvents, ServerToClientEvents>;

const CONFIG_KEY = 'maintenance';

let ioRef: IoServer | null = null;

// Lu en LIVE (DB), JSON invalide ou clé absente = maintenance désactivée.
export const getMaintenance = (): MaintenanceState => {
  const raw = getConfig(CONFIG_KEY);
  if (!raw) return MAINTENANCE_OFF;
  try {
    const parsed = JSON.parse(raw) as Partial<MaintenanceState>;
    if (parsed.active !== true || !isMaintenanceMode(parsed.mode)) return MAINTENANCE_OFF;
    return { active: true, mode: parsed.mode, since: typeof parsed.since === 'number' ? parsed.since : null };
  } catch {
    return MAINTENANCE_OFF;
  }
};

// Pose l'état depuis l'admin et le rediffuse à tous les connectés.
export const setMaintenance = (active: boolean, mode?: MaintenanceMode): MaintenanceState => {
  const next: MaintenanceState = active && mode
    ? { active: true, mode, since: Date.now() }
    : MAINTENANCE_OFF;
  setConfig(CONFIG_KEY, JSON.stringify(next));
  ioRef?.emit('maintenance', next);
  return next;
};

// Création de salon et lancement de partie : refusés dans les DEUX modes.
export const isNewGameBlocked = (): boolean => getMaintenance().active;

// Envoie l'état à chaque connexion (comme `versionPolicy`).
export const attachMaintenance = (io: IoServer): void => {
  ioRef = io;
  io.on('connection', (socket) => {
    socket.emit('maintenance', getMaintenance());
  });
};
