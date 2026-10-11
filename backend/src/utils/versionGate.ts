import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { Server, Socket, ExtendedError } from 'socket.io';
import {
  isActiveVersion,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type VersionPolicy,
} from '@onskone/shared';
import logger from './logger.js';
import { getConfig, setConfig } from '../db/appConfig.js';
import { getDeployedVersion } from './appVersion.js';
import { isNativeAppOrigin } from './origins.js';
import { announcesClientPolicy, shouldBlockLegacyClient } from './versionRule.js';

// Maj forcée : plancher = version minimale DEMANDÉE. Règle (cf. shared/src/version.ts) :
// un client n'est bloqué que s'il est sous le plancher ET qu'une version plus récente
// lui est réellement obtenable. Personne n'est bloqué sans pouvoir se mettre à jour.
//
//   - Client récent (annonce CLIENT_VERSION_POLICY) : jamais bloqué au handshake. Il
//     reçoit la politique (`versionPolicy`) et tranche lui-même en interrogeant SON
//     store (Play Core / App Store) ou, sur le web, le /version.json réellement servi.
//   - Ancien client : le serveur tranche avec ce qu'il peut prouver (shouldBlockLegacyClient).
//
// Plancher, du plus prioritaire au moins prioritaire :
//   1. app_config (SQLite, clé `min_supported_version`) : posé en 1 clic depuis
//      l'admin. Prioritaire dès qu'une valeur existe. Survit aux redéploiements.
//   2. SEED par défaut : env MIN_SUPPORTED_VERSION, sinon fichier MIN_SUPPORTED_VERSION
//      à la racine du repo. Sert tant que l'admin n'a jamais rien posé.
// "0.0.0" (ou vide) => gate désactivé, tout le monde passe.

type IoServer = Server<ClientToServerEvents, ServerToClientEvents>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const CONFIG_KEY = 'min_supported_version';

// Fichier source du seuil par défaut, à la racine du repo. backend/src/utils -> ../../..
const MIN_VERSION_FILE = join(dirname(fileURLToPath(import.meta.url)), '../../..', 'MIN_SUPPORTED_VERSION');

// Lit la 1re valeur non vide du fichier (lignes # ignorées). '' si absent/illisible.
const readMinVersionFile = (): string => {
  try {
    return readFileSync(MIN_VERSION_FILE, 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.length > 0 && !l.startsWith('#')) || '';
  } catch {
    return '';
  }
};

// Valeur de départ (défaut) : env prioritaire sur le fichier.
const SEED_MIN = (process.env.MIN_SUPPORTED_VERSION || readMinVersionFile()).trim();

// Plancher effectif, lu en LIVE (DB prioritaire, sinon seed). '' = désactivé.
export const getMinSupportedVersion = (): string => {
  const stored = getConfig(CONFIG_KEY);
  const raw = (stored ?? SEED_MIN).trim();
  return isActiveVersion(raw) ? raw : '';
};

// Pose le plancher depuis l'admin. Une valeur inactive est stockée en "0.0.0"
// (désactivation EXPLICITE), pour ne pas retomber silencieusement sur le seed.
export const setMinSupportedVersion = (v: string): void => {
  const raw = (v || '').trim();
  setConfig(CONFIG_KEY, isActiveVersion(raw) ? raw : '0.0.0');
};

const getVersionPolicy = (trigger: VersionPolicy['trigger']): VersionPolicy => ({
  minVersion: getMinSupportedVersion(),
  trigger,
});

// Middleware Socket.IO : ne refuse que les ANCIENS clients que le serveur peut
// prouver capables de se mettre à jour (web sous la version réellement servie).
// Le client annonce sa version dans handshake.auth.appVersion (cf. front socket.ts).
export const versionGate = (socket: AppSocket, next: (err?: ExtendedError) => void): void => {
  const floor = getMinSupportedVersion();
  if (!floor || announcesClientPolicy(socket.handshake.auth)) {
    next();
    return;
  }
  // Pas de version annoncée = client antérieur à ce système : traité comme "0.0.0".
  const appVersion = String(socket.handshake.auth?.appVersion || '');
  const isNativeApp = isNativeAppOrigin(socket.handshake.headers.origin);
  if (shouldBlockLegacyClient({ appVersion, minVersion: floor, deployedVersion: getDeployedVersion(), isNativeApp })) {
    const err = new Error('VERSION_TOO_OLD') as ExtendedError;
    err.data = { code: 'VERSION_TOO_OLD', minVersion: floor };
    logger.info(`Connexion refusée: version "${appVersion || '?'}" < ${floor}`);
    next(err);
    return;
  }
  next();
};

let ioRef: IoServer | null = null;

// Branche le gate : middleware de handshake + envoi de la politique à chaque connexion.
export const attachVersionGate = (io: IoServer): void => {
  ioRef = io;
  io.use(versionGate);
  io.on('connection', (socket) => {
    socket.emit('versionPolicy', getVersionPolicy('connect'));
  });
};

// Après un changement de plancher en admin : rediffuse à tous les connectés. Côté
// client, un 'update' ne peut que LEVER un blocage (jamais en poser un en pleine partie).
export const broadcastVersionPolicy = (): void => {
  ioRef?.emit('versionPolicy', getVersionPolicy('update'));
};
