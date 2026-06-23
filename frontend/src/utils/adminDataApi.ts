import type { AdminLobbySummary, AdminDeckSummary } from '@onskone/shared';
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

// --- Maj forcée (version gate) ---
export interface VersionGateState {
  deployedVersion: string; // version actuellement déployée (web/back)
  minVersion: string;      // plancher effectif ; '' = aucun blocage
  blocking: boolean;       // raccourci : un plancher actif est posé
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
