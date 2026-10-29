/**
 * Mode maintenance, piloté depuis l'admin (onglet Danger), partagé front/back.
 *
 *   - 'new_games' : plus de nouveau salon ni de lancement de partie ; les parties en
 *                   cours finissent tranquillement (le client en partie n'est pas coupé).
 *   - 'all'       : écran de maintenance pour tout le monde, parties en cours comprises.
 *                   Simple rideau : rien n'est mis en pause côté serveur, les manches
 *                   continuent sans les joueurs (timers, filet REVEAL) et peuvent finir.
 */
export type MaintenanceMode = 'new_games' | 'all';

export interface MaintenanceState {
  active: boolean;
  mode: MaintenanceMode;
  /** Timestamp d'activation (ms) ; null quand inactive. */
  since: number | null;
}

export const MAINTENANCE_OFF: MaintenanceState = { active: false, mode: 'new_games', since: null };

export const isMaintenanceMode = (v: unknown): v is MaintenanceMode => v === 'new_games' || v === 'all';
