import path from 'path';
import { fileURLToPath } from 'url';

// Dossier du frontend buildé : FRONTEND_DIST si présent, sinon frontend/build à la
// racine du repo (backend/src/utils -> ../../..). C'est aussi la racine nginx en prod :
// ce qui s'y trouve est EXACTEMENT ce qu'un navigateur reçoit en rechargeant.
export const FRONTEND_DIST = process.env.FRONTEND_DIST
  ? path.resolve(process.env.FRONTEND_DIST)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../frontend/build');
