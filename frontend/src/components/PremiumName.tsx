interface PremiumNameProps {
  name: string;
  premium?: boolean;
  className?: string;
}

/**
 * Affiche un pseudo. Si le joueur est premium, le nom prend le dégradé or
 * brillant animé (`.text-gold-shine`, cf. index.css) - "nom brillant" premium.
 * Sinon rendu texte normal (hérite la couleur/poids du parent via className).
 */
const PremiumName = ({ name, premium = false, className = '' }: PremiumNameProps) => {
  if (premium) {
    return <span className={`text-gold-shine ${className}`}>{name}</span>;
  }
  return <span className={className}>{name}</span>;
};

export default PremiumName;
