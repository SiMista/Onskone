// Version web déployée = celle du build RÉELLEMENT servi (frontend/build/version.json,
// émis par Vite avec la même valeur que __APP_VERSION__, cf. frontend/vite.config.ts).
// Pas celle de git : si un déploiement plante entre le `reset --hard` et la fin du
// build, nginx sert encore l'ancien build -> c'est lui que donne un rechargement.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import logger from './logger.js';
import { FRONTEND_DIST } from './frontendDist.js';

// @ts-expect-error - .mjs sans déclarations de types (source unique de version)
import { getVersionName } from '../../../scripts/app-version.mjs';

const VERSION_FILE = join(FRONTEND_DIST, 'version.json');

const readServedVersion = (): string => {
  try {
    const { version } = JSON.parse(readFileSync(VERSION_FILE, 'utf8')) as { version?: unknown };
    return typeof version === 'string' ? version.trim() : '';
  } catch {
    return '';
  }
};

// Dev uniquement : sans build local, repli sur la version git (celle que Vite injecte
// au démarrage du serveur de dev). En prod, pas de repli : sans version.json on ne
// sait pas ce qui est servi.
const DEV_GIT_VERSION: string = process.env.NODE_ENV === 'production' ? '' : (() => {
  try {
    return String(getVersionName() || '').trim();
  } catch (err) {
    logger.warn(`Version git incalculable : ${err instanceof Error ? err.message : String(err)}`);
    return '';
  }
})();

// Relue à chaque appel (fichier minuscule) : suit un rebuild sans redémarrer le backend.
// '' = inconnue : l'admin affiche "?" et refuse "Forcer la maj" (409 unknown_version),
// et aucun client web n'est bloqué (rien ne prouve qu'un rechargement aiderait).
export const getDeployedVersion = (): string => readServedVersion() || DEV_GIT_VERSION;
