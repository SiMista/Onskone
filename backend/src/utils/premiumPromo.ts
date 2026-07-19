import { getConfig, setConfig } from '../db/appConfig.js';

// Promo premium : quand elle est active, le premium est offert à tous (tous les
// thèmes premium sont débloqués, indépendamment du statut d'achat de l'host).
// Piloté en 1 clic depuis l'admin, stocké dans app_config (SQLite), survit aux
// redéploiements. Même mécanique que le version-gate (cf. versionGate.ts).
//
// Valeur stockée : '1' (actif) / '0' (inactif). Défaut = inactif.

const CONFIG_KEY = 'premium_promo_active';

export const isPremiumPromoActive = (): boolean => getConfig(CONFIG_KEY) === '1';

export const setPremiumPromoActive = (on: boolean): void => {
  setConfig(CONFIG_KEY, on ? '1' : '0');
};
