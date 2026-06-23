// Version déployée du backend/web, calculée UNE fois au boot.
// Source unique : scripts/app-version.mjs (fichier VERSION + commits git).
// backend/src/utils -> ../../.. = racine du repo.

// @ts-expect-error - .mjs sans déclarations de types (source unique de version)
import { getVersionName } from '../../../scripts/app-version.mjs';

export const DEPLOYED_VERSION: string = (() => {
  try {
    return String(getVersionName() || '').trim();
  } catch {
    return '';
  }
})();
