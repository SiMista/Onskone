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
