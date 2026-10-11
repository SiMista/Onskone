import { useSyncExternalStore } from 'react';
import { getSettings, subscribeSettings, type AppSettings } from '../utils/settings';

/** Réglages locaux du joueur (son, vibrations), réactifs aux changements. */
export const useSettings = (): AppSettings =>
  useSyncExternalStore(subscribeSettings, getSettings, getSettings);
