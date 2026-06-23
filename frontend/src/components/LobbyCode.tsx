import { ReactNode, useRef, useState } from 'react';

const LOBBY_CODE_LENGTH = 6;

// Boîte cartonnée + caractères espacés : look partagé entre l'affichage du code
// (sheet de partage) et la saisie du code (rejoindre une partie).
const BOX_CLASS =
  'flex items-center justify-center gap-2 bg-cream-player border-[2.5px] border-black rounded-xl px-4 py-3 stack-shadow-sm';
// Chaque caractère occupe un créneau de largeur fixe et centré : ainsi le point
// '·' des emplacements vides est espacé exactement comme une lettre.
const CHAR_CLASS = 'w-5 text-center font-display font-bold text-2xl tabular-nums text-gray-900';

/**
 * Affichage d'un code de salon (caractères espacés). Si `onClick` est fourni, le
 * bloc entier devient cliquable (copie) et affiche `trailing` (ex : icône copie).
 */
export const LobbyCodeDisplay = ({
  value,
  className = '',
  onClick,
  trailing,
  ariaLabel,
}: {
  value: string;
  className?: string;
  onClick?: () => void;
  trailing?: ReactNode;
  ariaLabel?: string;
}) => {
  const chars = value.split('').map((char, i) => (
    <span key={i} className={CHAR_CLASS}>
      {char}
    </span>
  ));

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className={`${BOX_CLASS} ${className} cursor-pointer hover:bg-white active:scale-[0.98] transition-all`}
      >
        {chars}
        {trailing}
      </button>
    );
  }

  return <div className={`${BOX_CLASS} ${className}`}>{chars}</div>;
};

/**
 * Saisie d'un code de salon avec le même espacement que l'affichage. Un input
 * transparent capte la frappe ; les caractères dessous reflètent la valeur, les
 * emplacements vides montrent un point grisé. Le nettoyage (uppercase /
 * alphanumérique) reste au parent.
 */
export const LobbyCodeInput = ({
  value,
  onChange,
  onComplete,
  length = LOBBY_CODE_LENGTH,
  autoFocus,
  ariaLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  onComplete?: () => void;
  length?: number;
  autoFocus?: boolean;
  ariaLabel?: string;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  return (
    <div className="relative" onClick={() => inputRef.current?.focus()}>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && value.length === length) onComplete?.();
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={autoFocus}
        maxLength={length}
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label={ariaLabel}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      <div className={`${BOX_CLASS} ${focused ? 'ring-2 ring-brand-500' : ''}`}>
        {Array.from({ length }).map((_, i) => {
          const char = value[i];
          return (
            <span key={i} className={`${CHAR_CLASS} ${char ? '' : 'text-gray-300'}`}>
              {char || '·'}
            </span>
          );
        })}
      </div>
    </div>
  );
};
