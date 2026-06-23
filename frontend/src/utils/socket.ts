import { io, Socket } from "socket.io-client";
import { SERVER_URL } from '../constants/game';
import { ServerToClientEvents, ClientToServerEvents } from '@onskone/shared';

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
const announcedVersion = (): string => getTestVersionOverride() || ACTUAL_APP_VERSION;

// Socket typé avec les événements serveur→client et client→serveur
const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(SERVER_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: Infinity, // Ne jamais abandonner (important pour mobile)
  timeout: 20000,
  // Version du build annoncée au serveur : sert au gate de maj forcée
  // (backend/src/utils/versionGate.ts refuse les clients trop vieux).
  // Fonction => réévaluée à chaque (re)connexion (prend en compte l'override de test).
  auth: (cb) => cb({ appVersion: announcedVersion() }),
});

export default socket;
