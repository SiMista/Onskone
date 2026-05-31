/**
 * Langues supportées pour le contenu du jeu (questions, descriptions de thèmes,
 * textes du site). Ajouter une nouvelle langue se fait ici, puis en générant
 * le fichier `questions_<code>.json` côté backend et le dictionnaire côté
 * frontend - le type `Locale` se met à jour automatiquement.
 */
export const SUPPORTED_LOCALES = ['fr', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'fr';

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
