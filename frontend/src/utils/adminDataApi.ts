import type { AdminLobbySummary, AdminDeckSummary, AdminDeckStats } from '@onskone/shared';
import { adminFetch } from './ticketsApi';

export async function fetchAdminLobbies(): Promise<AdminLobbySummary[]> {
  const res = await adminFetch('/admin/lobbies');
  if (!res.ok) throw new Error('Erreur de chargement des lobbies.');
  const data = await res.json();
  return data.lobbies as AdminLobbySummary[];
}

export async function fetchAdminDecks(): Promise<AdminDeckSummary[]> {
  const res = await adminFetch('/admin/decks');
  if (!res.ok) throw new Error('Erreur de chargement des decks.');
  const data = await res.json();
  return data.decks as AdminDeckSummary[];
}

export async function fetchAdminDeckStats(): Promise<AdminDeckStats> {
  const res = await adminFetch('/admin/deck-stats');
  if (!res.ok) throw new Error('Erreur de chargement des stats.');
  const data = await res.json();
  return data.stats as AdminDeckStats;
}

// --- Maj forcée (version gate) ---
/** Version en ligne sur l'App Store (API publique Apple, côté serveur). Info seulement. */
export interface AppStoreVersion {
  version: string;
  releasedAt: string;       // ISO 8601
  minimumOsVersion: string;
}

export interface VersionGateState {
  deployedVersion: string; // version actuellement déployée (web/back)
  minVersion: string;      // plancher effectif ; '' = aucun blocage
  blocking: boolean;       // raccourci : un plancher actif est posé
  appStore: AppStoreVersion | null; // null = inconnue (Apple injoignable...)
}

export async function fetchVersionGate(): Promise<VersionGateState> {
  const res = await adminFetch('/admin/version-gate');
  if (!res.ok) throw new Error('Erreur de chargement de la maj forcée.');
  return (await res.json()) as VersionGateState;
}

// 1-clic : le serveur calcule le plancher (= version déployée) pour 'force_latest'.
export async function setVersionGate(action: 'force_latest' | 'disable'): Promise<VersionGateState> {
  const res = await adminFetch('/admin/version-gate', {
    method: 'POST',
    body: JSON.stringify({ action }),
  });
  if (!res.ok) throw new Error('Erreur de mise à jour de la maj forcée.');
  return (await res.json()) as VersionGateState;
}

/** Log d'erreur remonté par l'app (table `client_logs`, cf backend/src/routes/clientLogs.ts). */
export interface ClientLog {
  id: number;
  level: 'error' | 'warn' | 'info';
  source: string;
  message: string;
  /** JSON sérialisé (détail de l'erreur, étape, empreinte de clé…), ou null. */
  context: string | null;
  platform: string | null;
  app_version: string | null;
  user_agent: string | null;
  ip_hash: string | null;
  created_at: number;
}

export async function fetchClientLogs(): Promise<ClientLog[]> {
  const res = await adminFetch('/admin/client-logs');
  if (!res.ok) throw new Error('Erreur de chargement des logs.');
  const data = await res.json();
  return data.logs as ClientLog[];
}

export async function clearClientLogs(): Promise<number> {
  const res = await adminFetch('/admin/client-logs', { method: 'DELETE' });
  if (!res.ok) throw new Error('Erreur de suppression des logs.');
  const data = await res.json();
  return Number(data.deleted) || 0;
}
