import socket from './socket';

/**
 * Connexion « pourrie » vue du client : un toast prévient le joueur que le jeu risque de
 * ramer (cf. components/ConnectionWarning). Tout se mesure côté client, rien au serveur :
 *  - en partie, la latence du syncCheck (vrai aller-retour serveur, toutes les 5 s) ;
 *  - un syncCheck resté sans réponse (la reconnexion forcée suit) ;
 *  - des coupures de socket à répétition (réseau qui lâche) ;
 *  - le serveur sans aucune réponse HTTP alors qu'on est censé être en ligne (maintenance.ts).
 * Rien n'est compté app en arrière-plan ni juste après son retour au premier plan : là,
 * c'est l'OS qui gèle / coupe le socket, pas le réseau.
 */

export const SLOW_RTT_MS = 1500;
const RTT_WINDOW = 3; // dernières mesures gardées…
const SLOW_RTT_COUNT = 2; // …dont autant de lentes pour alerter
export const DROP_WINDOW_MS = 60_000;
const DROP_COUNT = 2;
const WARN_COOLDOWN_MS = 3 * 60_000; // un toast toutes les 3 min au plus
const RESUME_GRACE_MS = 5_000;

/** Latences récentes trop lentes ? (pur, testé) */
export const tooSlow = (rtts: number[]): boolean =>
  rtts.filter(ms => ms >= SLOW_RTT_MS).length >= SLOW_RTT_COUNT;

/** Trop de coupures dans la fenêtre glissante ? (pur, testé) */
export const tooManyDrops = (dropTimes: number[], now: number): boolean =>
  dropTimes.filter(at => now - at <= DROP_WINDOW_MS).length >= DROP_COUNT;

let rtts: number[] = [];
let drops: number[] = [];
let lastWarnAt = -Infinity;
let visibleSince = Date.now();
const listeners = new Set<() => void>();

// Premier plan depuis assez longtemps pour que la mesure parle du réseau.
const settled = (): boolean =>
  document.visibilityState === 'visible' && Date.now() - visibleSince >= RESUME_GRACE_MS;

const warn = (): void => {
  const now = Date.now();
  if (now - lastWarnAt < WARN_COOLDOWN_MS) return;
  lastWarnAt = now;
  rtts = [];
  drops = [];
  listeners.forEach(l => l());
};

/** Aller-retour d'un syncCheck (en partie). */
export const recordSyncRtt = (ms: number): void => {
  if (!settled()) return;
  rtts = [...rtts, ms].slice(-RTT_WINDOW);
  if (tooSlow(rtts)) warn();
};

/** Signal fort à lui seul : syncCheck sans réponse, serveur injoignable en HTTP. */
export const reportConnectionTrouble = (): void => {
  if (settled()) warn();
};

export const onPoorConnection = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') visibleSince = Date.now();
  });
}

// Coupures SUBIES seulement : pas la reconnexion qu'on force nous-mêmes
// ('io client disconnect') ni une éviction par le serveur ('io server disconnect').
socket.on('disconnect', (reason) => {
  if (reason === 'io client disconnect' || reason === 'io server disconnect') return;
  if (!settled()) return;
  const now = Date.now();
  drops = [...drops.filter(at => now - at <= DROP_WINDOW_MS), now];
  if (tooManyDrops(drops, now)) warn();
});
