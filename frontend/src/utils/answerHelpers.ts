/**
 * Utilitaires pour la gestion des réponses automatiques
 */

export const NO_RESPONSE_PREFIX = '__NO_RESPONSE__';

/**
 * Vérifie si une réponse est une "non-réponse" automatique
 * (générée quand le timer expire sans que le joueur ait répondu)
 */
export const isNoResponse = (text: string): boolean => {
  return text.startsWith(NO_RESPONSE_PREFIX);
};

/**
 * Retourne le texte à afficher (sans le préfixe de non-réponse)
 */
export const getDisplayText = (text: string): string => {
  if (isNoResponse(text)) {
    return text.substring(NO_RESPONSE_PREFIX.length);
  }
  return text;
};
