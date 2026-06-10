/**
 * Utilitaires d'affichage des réponses. Le préfixe de non-réponse et sa détection
 * vivent dans `@onskone/shared` (partagés front/back) ; on les consomme ici pour
 * `getDisplayText`.
 */
import { NO_RESPONSE_PREFIX, isNoResponse } from '@onskone/shared';

/**
 * Retourne le texte à afficher (sans le préfixe de non-réponse)
 */
export const getDisplayText = (text: string): string => {
  if (isNoResponse(text)) {
    return text.substring(NO_RESPONSE_PREFIX.length);
  }
  return text;
};

/**
 * Couleur de fond d'une carte de réponse selon son état révélation.
 * - non révélée : cream
 * - révélée correcte : vert
 * - révélée incorrecte : rouge
 */
export const ANSWER_CARD_COLORS = {
  correct: 'bg-success-500',
  incorrect: 'bg-danger-400',
  unrevealed: 'bg-cream-answer',
} as const;

export const answerCardBg = (revealed: boolean, correct: boolean): string =>
  !revealed
    ? ANSWER_CARD_COLORS.unrevealed
    : correct
      ? ANSWER_CARD_COLORS.correct
      : ANSWER_CARD_COLORS.incorrect;

