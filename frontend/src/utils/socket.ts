import { io, Socket } from "socket.io-client";
import { SERVER_URL } from '../constants/game';
import { ServerToClientEvents, ClientToServerEvents, CLIENT_VERSION_POLICY } from '@onskone/shared';

// Version réelle du build (injectée par Vite, cf. vite.config.ts).
export const ACTUAL_APP_VERSION = __APP_VERSION__;

// Override de TEST de la version annoncée (outil admin/dev) : permet de simuler un
// client plus vieux pour voir l'écran "Mise à jour requise" sans rebuild. Stocké
// localStorage, ne concerne QUE ce navigateur. Vide = on annonce la vraie version.
const VERSION_OVERRIDE_KEY = 'onskone_test_app_version';

export const getTestVersionOverride = (): string | null => {
  try {
    const v = localStorage.getItem(VERSION_OVERRIDE_KEY);
    return v && v.trim() ? v.trim() : null;
  } catch { return null; }
};

export const setTestVersionOverride = (v: string | null): void => {
  try {
    if (v && v.trim()) localStorage.setItem(VERSION_OVERRIDE_KEY, v.trim());
    else localStorage.removeItem(VERSION_OVERRIDE_KEY);
  } catch { /* ignore */ }
};

// Version effectivement annoncée au handshake (override de test sinon build réel).
export const announcedVersion = (): string => getTestVersionOverride() || ACTUAL_APP_VERSION;

// Statut premium annoncé au handshake (gating "l'host débloque pour la table").
// Mis à jour par premium.ts quand le statut change ; réévalué à chaque (re)connexion.
// Défini ici (pas dans premium.ts) pour éviter un cycle d'import socket <-> premium.
let announcedPremium = false;
export const setAnnouncedPremium = (v: boolean): void => { announcedPremium = v; };

/**
 * Aperçu d'écrans du Studio (DEV uniquement, route /studio/screen) : les écrans y sont
 * rendus avec des données figées, SANS serveur. La socket ne se connecte jamais et
 * chaque envoi est relayé au Studio parent (journal + faux serveur de l'aperçu) au
 * lieu de partir sur le réseau. Toujours faux en prod (éliminé au build).
 */
export const IS_SCREEN_PREVIEW = import.meta.env.DEV
  && typeof window !== 'undefined'
  && window.location.pathname.startsWith('/studio/screen');

// Socket typé avec les événements serveur→client et client→serveur
const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(SERVER_URL, {
  autoConnect: !IS_SCREEN_PREVIEW,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: Infinity, // Ne jamais abandonner (important pour mobile)
  timeout: 20000,
  // Version du build annoncée au serveur : sert au gate de maj forcée. `versionPolicy`
  // indique que ce client applique la règle lui-même (cf. utils/versionGate.ts) : le
  // serveur ne le refuse plus au handshake, il lui envoie la politique.
  // Fonction => réévaluée à chaque (re)connexion (prend en compte l'override de test).
  auth: (cb) => cb({ appVersion: announcedVersion(), premium: announcedPremium, versionPolicy: CLIENT_VERSION_POLICY }),
});

if (IS_SCREEN_PREVIEW) {
  // Aucune (re)connexion possible depuis l'aperçu, même demandée (premium, retour au premier plan…).
  socket.connect = () => socket;
  socket.emit = ((event: string, ...args: unknown[]) => {
    window.parent?.postMessage({ type: 'studio:screenEmit', event, payload: args[0] }, '*');
    return socket;
  }) as unknown as typeof socket.emit;
}

/**
 * Aperçu d'écrans du Studio : simule un évènement diffusé par le serveur en appelant
 * directement les écouteurs abonnés (la socket de l'aperçu n'est jamais connectée).
 */
export const dispatchPreviewServerEvent = (event: string, data: unknown): void => {
  if (!IS_SCREEN_PREVIEW) return;
  (socket.listeners(event as never) as ((d: unknown) => void)[]).forEach((fn) => fn(data));
};

export default socket;
