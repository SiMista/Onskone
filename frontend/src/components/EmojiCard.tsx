import { Icon } from '@iconify/react';
import { STICKER_FILTER, STICKER_FILTER_STRONG } from '../constants/icons';

interface EmojiCardProps {
  /** Nom d'icône Iconify (emoji Fluent Flat). */
  icon: string;
  /**
   * Fond du bloc : soit une classe utilitaire Tailwind (ex: gradient
   * `bg-gradient-to-br from-...`), soit une valeur CSS `background-image`
   * (dégradé calculé, ThemePicker). Fournir l'un OU l'autre.
   */
  bgClassName?: string;
  bgImage?: string;
  /** Classe de motif de fond superposé (ex: 'bg-pattern-dots'). Opacité 30%. */
  pattern?: string;
  /** Intensité du contour sticker de l'emoji. 'normal' (GameMode) ou 'strong' (ThemePicker). */
  filterStrength?: 'normal' | 'strong';
  /** Taille du rendu de l'icône en px. Défaut 44 (aligné sur les deux usages). */
  iconSize?: number;
  /** Classes additionnelles sur le conteneur (largeur, etc.). */
  className?: string;
}

/**
 * Bloc illustration-emoji des cartes (mode de jeu / carte-thème) : carré coloré
 * texture papier avec bordure droite noire, motif optionnel et emoji "sticker"
 * qui s'incline au survol du groupe parent.
 *
 * Le parent doit porter la classe `group` pour activer l'effet de survol de
 * l'emoji (`group-hover:rotate-[-6deg] group-hover:scale-110`).
 */
const EmojiCard = ({
  icon,
  bgClassName,
  bgImage,
  pattern,
  filterStrength = 'normal',
  iconSize = 44,
  className = 'w-20 md:w-24',
}: EmojiCardProps) => (
  <div
    className={`relative flex items-center justify-center shrink-0 texture-paper border-r-[2.5px] border-black ${bgClassName ?? ''} ${className}`}
    style={bgImage ? { backgroundImage: bgImage } : undefined}
  >
    {pattern && <span aria-hidden className={`absolute inset-0 ${pattern} opacity-30`} />}
    <Icon
      icon={icon}
      width={iconSize}
      height={iconSize}
      aria-hidden
      className="relative transition-transform duration-300 ease-out group-hover:rotate-[-6deg] group-hover:scale-110"
      style={{ filter: filterStrength === 'strong' ? STICKER_FILTER_STRONG : STICKER_FILTER }}
    />
  </div>
);

export default EmojiCard;
