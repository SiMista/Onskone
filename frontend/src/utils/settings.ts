import { studioStorage } from './studioStorage';

/**
 * Réglages locaux du joueur (modale Réglages de l'accueil). Propres à l'appareil,
 * jamais envoyés au serveur. Lus au moment de jouer un son / une vibration
 * (cf. sounds.ts, haptics.ts), donc un changement s'applique immédiatement.
 */
export interface AppSettings {
  sound: boolean;
  vibration: boolean;
}

const STORAGE_KEY = 'onskone:settings';
const DEFAULTS: AppSettings = { sound: true, vibration: true };

// Via studioStorage (namespacé par slot) : chaque iframe du Studio garde ses réglages.
const readSettings = (): AppSettings => {
  try {
    const raw = studioStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<AppSettings> | null;
    return {
      sound: typeof parsed?.sound === 'boolean' ? parsed.sound : DEFAULTS.sound,
      vibration: typeof parsed?.vibration === 'boolean' ? parsed.vibration : DEFAULTS.vibration,
    };
  } catch {
    return DEFAULTS;
  }
};

let settings = readSettings();
const listeners = new Set<() => void>();

export const getSettings = (): AppSettings => settings;

export const updateSettings = (patch: Partial<AppSettings>): void => {
  settings = { ...settings, ...patch };
  try {
    studioStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* silent */
  }
  listeners.forEach((l) => l());
};

export const subscribeSettings = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};
