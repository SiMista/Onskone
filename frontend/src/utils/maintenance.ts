import { useSyncExternalStore } from 'react';
import { MAINTENANCE_OFF, type MaintenanceState } from '@onskone/shared';
import socket from './socket';
import { SERVER_URL } from '../constants/game';

// Écran de maintenance côté client. Deux sources, un seul affichage :
//   - `maintenance` : mode posé depuis l'admin (backend vivant). Le serveur l'envoie à
//     chaque connexion et le rediffuse en direct : la levée libère donc les clients
//     sans rechargement.
//   - `serverDown` : filet pour un crash réel du backend, qui ne peut rien annoncer.
//     nginx sert le front en statique, donc la SPA se charge quand même : on déduit la
//     panne d'une socket injoignable durablement ET d'une sonde HTTP en échec.

export interface MaintenanceSnapshot {
  state: MaintenanceState;
  serverDown: boolean;
  /** L'accueil propose de revenir dans une partie en cours (cf. setResumeOffered). */
  resumeOffered: boolean;
}

// Socket muette cette durée avant de sonder (les coupures brèves de réseau mobile
// passent par la reconnexion normale, sans écran).
const SERVER_DOWN_AFTER_MS = 15_000;
const PROBE_TIMEOUT_MS = 5_000;

let snapshot: MaintenanceSnapshot = { state: MAINTENANCE_OFF, serverDown: false, resumeOffered: false };
const listeners = new Set<() => void>();
const update = (patch: Partial<MaintenanceSnapshot>) => {
  const next = { ...snapshot, ...patch };
  if (
    next.state === snapshot.state && next.serverDown === snapshot.serverDown
    && next.resumeOffered === snapshot.resumeOffered
  ) return;
  snapshot = next;
  listeners.forEach((l) => l());
};

// Le backend répond-il en HTTP ? Faux sur erreur réseau, timeout ou 5xx (502 nginx...).
const backendReachable = async (): Promise<boolean> => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(`${SERVER_URL}/api/maintenance`, { cache: 'no-store', signal: ctrl.signal });
    return res.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
};

let downTimer: ReturnType<typeof setTimeout> | null = null;

const checkServerDown = async () => {
  downTimer = null;
  if (socket.connected) return;
  // Appareil hors ligne : c'est lui qui est coupé, pas le serveur.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  if (!(await backendReachable()) && !socket.connected) update({ serverDown: true });
};

socket.on('maintenance', (state) => update({ state }));

socket.on('connect_error', (err: Error & { data?: { code?: string } }) => {
  // Une maj forcée n'est pas une panne (gérée par versionGate.ts).
  if (err?.data?.code === 'VERSION_TOO_OLD') return;
  if (downTimer === null) downTimer = setTimeout(() => { void checkServerDown(); }, SERVER_DOWN_AFTER_MS);
});

socket.on('connect', () => {
  if (downTimer !== null) { clearTimeout(downTimer); downTimer = null; }
  update({ serverDown: false });
});

// Popup de reprise ouverte sur l'accueil (app tuée, session perdue). En 'new_games'
// les parties en cours doivent pouvoir finir : l'écran s'efface le temps de l'offre,
// sinon il masquait la seule porte de retour en partie (cf. MaintenanceOverlay).
export const setResumeOffered = (resumeOffered: boolean) => update({ resumeOffered });

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};

export const useMaintenance = (): MaintenanceSnapshot =>
  useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
