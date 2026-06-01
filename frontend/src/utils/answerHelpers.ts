/**
 * Utilitaires pour la gestion des réponses automatiques (timeout, déconnexion).
 * Le préfixe et la détection vivent désormais dans `@onskone/shared` pour rester
 * en phase entre front et back. On les re-exporte ici pour minimiser les changements
 * d'imports dans les composants existants.
 */
import { NO_RESPONSE_PREFIX, isNoResponse } from '@onskone/shared';

export { NO_RESPONSE_PREFIX, isNoResponse };

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

