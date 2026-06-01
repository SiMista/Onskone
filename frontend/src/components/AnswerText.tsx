import { isNoResponse, getDisplayText } from '../utils/answerHelpers';

/**
 * Affiche un texte de réponse en gérant automatiquement le préfixe __NO_RESPONSE__
 * (strip + style italique grisé). Évite d'oublier `getDisplayText` à chaque usage.
 */
const AnswerText = ({
  text,
  className = '',
  normalClass = 'text-gray-900',
  noResponseClass = 'text-gray-400 italic',
  as = 'p',
}: {
  /** Texte brut (peut contenir le préfixe __NO_RESPONSE__) */
  text: string;
  /** Classes additionnelles (taille, m-0, etc.) */
  className?: string;
  /** Classe appliquée quand la réponse est une vraie réponse joueur */
  normalClass?: string;
  /** Classe appliquée pour une non-réponse (style désactivé) */
  noResponseClass?: string;
  /** Élément HTML (défaut: p) */
  as?: 'p' | 'span' | 'div';
}) => {
  const noResponse = isNoResponse(text);
  const Tag = as;
  return (
    <Tag className={`${className} ${noResponse ? noResponseClass : normalClass}`}>
      {getDisplayText(text)}
    </Tag>
  );
};

export default AnswerText;
