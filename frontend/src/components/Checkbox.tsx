import type { ReactNode } from 'react';
import { LuCheck } from 'react-icons/lu';

interface CheckboxProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  /** Côté de la case. `right` : ligne de réglage groupée, alignée sur les chevrons des lignes voisines. */
  boxSide?: 'left' | 'right';
  /** Contrôle (ex. HelpBubble) posé juste après le titre, hors du bouton (un bouton dans un bouton est invalide). */
  trailing?: ReactNode;
  /** Largeur au contenu : la case reste collée au texte (sinon la ligne prend toute la largeur). */
  fit?: boolean;
  /** Fond de la case cochée (`background-image`, ex. dégradé de catégorie) à la place du jaune. */
  checkedBackground?: string;
}

const Checkbox = ({ checked, onChange, label, description, disabled = false, boxSide = 'left', trailing, fit = false, checkedBackground }: CheckboxProps) => {
  // `block` : avec `trailing`, la case est seule dans un <button> (pas flex) ; en inline,
  // w/h étaient ignorés et la case s'écrasait en un trait (seule la coche absolue dedans).
  const box = (
    <span
      aria-hidden
      className={`relative block shrink-0 ${boxSide === 'right' ? '' : 'mt-0.5'} w-7 h-7 md:w-8 md:h-8 rounded-md card-paper stack-shadow-sm transition-colors duration-200 ${
        checked ? (checkedBackground ? '' : 'bg-warning-500') : 'bg-cream-checkbox'
      }`}
      style={checked && checkedBackground ? { backgroundImage: checkedBackground } : undefined}
    >
      <LuCheck
        size={20}
        strokeWidth={3.5}
        className={`absolute inset-0 m-auto text-black transition-all duration-200 ${
          checked ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
        }`}
      />
    </span>
  );
  const rowClass = `group flex ${boxSide === 'right' ? 'flex-row-reverse items-center' : 'items-start'} gap-3 ${fit ? 'w-auto' : 'w-full'} text-left transition-transform duration-150 active:scale-[0.98] ${
    disabled ? 'opacity-65 pointer-events-none' : 'cursor-pointer'
  }`;
  const titleClass = 'font-display text-sm md:text-base font-bold uppercase tracking-tight text-black leading-none';
  const descriptionEl = description && (
    <div className="font-sans text-xs text-gray-600 leading-snug mt-1">{description}</div>
  );

  if (!trailing) {
    return (
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={rowClass}
      >
        {box}
        <div className="flex-1 min-w-0">
          <div className={titleClass}>{label}</div>
          {descriptionEl}
        </div>
      </button>
    );
  }

  // Avec une bulle d'aide à côté du titre : la case est le bouton (role checkbox) et le
  // texte est cliquable en div, pour ne pas imbriquer un bouton dans un bouton. Désactivé :
  // la case et le texte se figent, la bulle reste utilisable.
  const frozen = disabled ? 'opacity-65 pointer-events-none' : 'cursor-pointer';
  return (
    <div className={`flex ${boxSide === 'right' ? 'flex-row-reverse items-center' : 'items-start'} gap-3 ${fit ? 'w-auto' : 'w-full'} text-left`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`shrink-0 transition-transform duration-150 active:scale-[0.94] ${frozen}`}
      >
        {box}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`${titleClass} ${frozen}`} onClick={() => { if (!disabled) onChange(!checked); }}>{label}</span>
          {trailing}
        </div>
        <div className={frozen} onClick={() => { if (!disabled) onChange(!checked); }}>{descriptionEl}</div>
      </div>
    </div>
  );
};

export default Checkbox;
