import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { Socket, ExtendedError } from 'socket.io';
import logger from './logger.js';
import { getConfig, setConfig } from '../db/appConfig.js';

// Plancher de maj forcée : version minimale autorisée à se connecter. En dessous,
// le client est refusé au handshake socket et voit l'écran "Mise à jour requise".
//
// Deux niveaux, du plus prioritaire au moins prioritaire :
//   1. app_config (SQLite, clé `min_supported_version`) : posé en 1 clic depuis
//      l'admin. Prioritaire dès qu'une valeur existe. Survit aux redéploiements.
//   2. SEED par défaut : env MIN_SUPPORTED_VERSION, sinon fichier MIN_SUPPORTED_VERSION
//      à la racine du repo. Sert tant que l'admin n'a jamais rien posé.
// "0.0.0" (ou vide) => gate désactivé, tout le monde passe.

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

type Parts = [number, number, number];

// "v1.3.7" -> [1, 3, 7]. Segments manquants ou non numériques => 0.
const parse = (v: string): Parts => {
  const seg = v.replace(/^v/, '').split('.');
  const n = (i: number) => {
    const x = parseInt(seg[i] ?? '', 10);
    return Number.isFinite(x) ? x : 0;
  };
  return [n(0), n(1), n(2)];
};

// true si la version `a` est strictement antérieure à `b`.
export const isOlder = (a: string, b: string): boolean => {
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i] < pb[i]) return true;
    if (pa[i] > pb[i]) return false;
  }
  return false;
};

// "0.0.0" / vide = gate inactif (aucune version ne lui est strictement inférieure).
const isActive = (v: string): boolean => {
  const [a, b, c] = parse(v);
  return !!(a || b || c);
};

// Plancher effectif, lu en LIVE (DB prioritaire, sinon seed). '' = désactivé.
export const getMinSupportedVersion = (): string => {
  const stored = getConfig(CONFIG_KEY);
  const raw = (stored ?? SEED_MIN).trim();
  return isActive(raw) ? raw : '';
};

// Pose le plancher depuis l'admin. Une valeur inactive est stockée en "0.0.0"
// (désactivation EXPLICITE), pour ne pas retomber silencieusement sur le seed.
export const setMinSupportedVersion = (v: string): void => {
  const raw = (v || '').trim();
  setConfig(CONFIG_KEY, isActive(raw) ? raw : '0.0.0');
};

// Middleware Socket.IO : refuse les clients sous le plancher effectif.
// Le client annonce sa version dans handshake.auth.appVersion (cf. front socket.ts).
export const versionGate = (socket: Socket, next: (err?: ExtendedError) => void): void => {
  const floor = getMinSupportedVersion();
  if (!floor) {
    next();
    return;
  }
  const appVersion = String(socket.handshake.auth?.appVersion || '');
  // Pas de version annoncée = client antérieur à ce système => bloqué aussi
  // (sinon le gate serait contournable en n'envoyant rien).
  if (!appVersion || isOlder(appVersion, floor)) {
    const err = new Error('VERSION_TOO_OLD') as ExtendedError;
    err.data = { code: 'VERSION_TOO_OLD', minVersion: floor };
    logger.info(`Connexion refusée: version "${appVersion || '?'}" < ${floor}`);
    next(err);
    return;
  }
  next();
};
