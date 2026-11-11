import { useSyncExternalStore } from 'react';
import { MAINTENANCE_OFF, type MaintenanceState } from '@onskone/shared';
import socket from './socket';
import { SERVER_URL } from '../constants/game';
import { reportConnectionTrouble } from './connectionQuality';

// Écran de maintenance côté client. Deux sources, un seul affichage :
//   - `maintenance` : mode posé depuis l'admin (backend vivant). Le serveur l'envoie à
//     chaque connexion et le rediffuse en direct : la levée libère donc les clients
//     sans rechargement.
//   - `serverDown` : filet pour un crash réel du backend, qui ne peut rien annoncer.
//     nginx sert le front en statique, donc la SPA se charge quand même : on déduit la
//     panne d'une socket injoignable durablement ET d'une sonde HTTP qui répond 5xx
//     (le proxy répond, le backend non : ce n'est donc PAS le réseau du joueur).
//   - `unreachable` : la sonde n'obtient AUCUNE réponse (timeout, erreur réseau). Le plus
//     souvent c'est la connexion du joueur : toast « connexion instable » d'abord, puis
//     écran « vérifie ta connexion » si ça dure (jamais « ce n'est pas ta connexion »).

export interface MaintenanceSnapshot {
  state: MaintenanceState;
  serverDown: boolean;
  /** Serveur sans aucune réponse depuis un moment : plutôt le réseau du joueur. */
  unreachable: boolean;
  /** L'accueil propose de revenir dans une partie en cours (cf. setResumeOffered). */
  resumeOffered: boolean;
}

// Socket muette cette durée avant de sonder (les coupures brèves de réseau mobile
// passent par la reconnexion normale, sans écran).
const SERVER_DOWN_AFTER_MS = 15_000;
const PROBE_TIMEOUT_MS = 5_000;
// Injoignable : délai entre le toast et l'écran « vérifie ta connexion » (réseau qui revient).
const UNREACHABLE_SCREEN_AFTER_MS = 30_000;

let snapshot: MaintenanceSnapshot = { state: MAINTENANCE_OFF, serverDown: false, unreachable: false, resumeOffered: false };
const listeners = new Set<() => void>();
const update = (patch: Partial<MaintenanceSnapshot>) => {
  const next = { ...snapshot, ...patch };
  if (
    next.state === snapshot.state && next.serverDown === snapshot.serverDown
    && next.unreachable === snapshot.unreachable && next.resumeOffered === snapshot.resumeOffered
  ) return;
  snapshot = next;
  listeners.forEach((l) => l());
};

export type ProbeResult = 'up' | 'down' | 'unreachable';

/**
 * Lecture d'une sonde HTTP (pur, testé) : `null` = aucune réponse (timeout, erreur réseau).
 * 5xx = le proxy répond mais pas le backend (502 nginx) : vraie panne serveur.
 */
export const classifyProbe = (status: number | null): ProbeResult =>
  status === null ? 'unreachable' : status >= 500 ? 'down' : 'up';

const probeBackend = async (): Promise<ProbeResult> => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(`${SERVER_URL}/api/maintenance`, { cache: 'no-store', signal: ctrl.signal });
    return classifyProbe(res.status);
  } catch {
    return classifyProbe(null);
  } finally {
    clearTimeout(timer);
  }
};

let downTimer: ReturnType<typeof setTimeout> | null = null;
// Début de l'injoignabilité constatée (remis à zéro à la reconnexion).
let unreachableSince: number | null = null;

const checkServerDown = async () => {
  downTimer = null;
  if (socket.connected) return;
  // Appareil hors ligne : inutile de sonder, c'est sa connexion.
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  const probe = offline ? 'unreachable' : await probeBackend();
  if (socket.connected) return;
  if (probe === 'down') {
    update({ serverDown: true });
    return;
  }
  // HTTP répond mais la socket non : on laisse la reconnexion normale faire.
  if (probe === 'up') return;
  // Aucune réponse : d'abord le toast, puis l'écran si ça dure ; on resonde entre-temps.
  reportConnectionTrouble();
  const now = Date.now();
  if (unreachableSince === null) unreachableSince = now;
  if (now - unreachableSince >= UNREACHABLE_SCREEN_AFTER_MS) update({ unreachable: true });
  else downTimer = setTimeout(() => { void checkServerDown(); }, UNREACHABLE_SCREEN_AFTER_MS);
};

socket.on('maintenance', (state) => update({ state }));

socket.on('connect_error', (err: Error & { data?: { code?: string } }) => {
  // Une maj forcée n'est pas une panne (gérée par versionGate.ts).
  if (err?.data?.code === 'VERSION_TOO_OLD') return;
  if (downTimer === null) downTimer = setTimeout(() => { void checkServerDown(); }, SERVER_DOWN_AFTER_MS);
});

socket.on('connect', () => {
  if (downTimer !== null) { clearTimeout(downTimer); downTimer = null; }
  unreachableSince = null;
  update({ serverDown: false, unreachable: false });
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
