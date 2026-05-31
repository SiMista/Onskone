import type { Locale } from '@onskone/shared';
import { SUPPORTED_LOCALES } from '@onskone/shared';

/**
 * Métadonnées d'affichage pour chaque langue supportée. Le `Record<Locale, ...>`
 * garantit qu'ajouter une langue dans `shared/types/locale.ts` force à compléter
 * ce fichier (sinon erreur de typecheck) - une seule source de vérité.
 */
export const LOCALE_META: Record<Locale, { label: string; shortLabel: string; flag: string }> = {
  fr: { label: 'Français', shortLabel: 'FR', flag: '🇫🇷' },
  en: { label: 'English', shortLabel: 'EN', flag: '🇬🇧' },
};

export { SUPPORTED_LOCALES };
export type { Locale };
