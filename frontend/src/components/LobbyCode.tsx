import { ReactNode, useEffect, useRef, useState } from 'react';

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
  // Case en cours d'édition. Cliquer sur une case la cible ; la frappe écrit ici
  // puis avance. Par défaut : le premier créneau vide (comportement OTP naturel).
  const [activeIndex, setActiveIndex] = useState(0);

  // Recale l'index actif sur le prochain vide quand la valeur change de l'extérieur
  // (reset à l'ouverture de la modale), sans écraser un clic manuel de l'utilisateur.
  useEffect(() => {
    if (value.length === 0) setActiveIndex(0);
  }, [value]);

  const chars = value.split('');

  // Écrit/efface un caractère à un index SANS créer de trou : la valeur reste une
  // string contiguë (le parent filtre les non-alphanum, donc pas d'espaces internes
  // possibles). index doit être <= value.length.
  const writeAt = (index: number, char: string) => {
    const arr = value.split('');
    if (char === '') {
      // Suppression : on retire le caractère à index (les suivants se décalent).
      arr.splice(index, 1);
    } else if (index < arr.length) {
      // Remplacement d'un caractère existant.
      arr[index] = char;
    } else {
      // Ajout en fin.
      arr.push(char);
    }
    onChange(arr.join('').slice(0, length));
  };

  // Cible une case au clic. On ne laisse pas viser au-delà du 1er créneau vide
  // (sinon on créerait un trou) : on recale sur la fin de la saisie.
  const focusSlot = (i: number) => {
    setActiveIndex(Math.min(i, value.length));
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (value.length === length) onComplete?.();
      return;
    }
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (activeIndex < value.length) {
        // Efface la case courante (remplie), les suivantes se décalent, on reste là.
        writeAt(activeIndex, '');
      } else if (activeIndex > 0) {
        // Curseur après la dernière lettre : efface la précédente et recule.
        writeAt(activeIndex - 1, '');
        setActiveIndex(activeIndex - 1);
      }
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setActiveIndex(Math.max(0, activeIndex - 1));
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setActiveIndex(Math.min(value.length, activeIndex + 1));
      return;
    }
    // Caractère alphanumérique : on l'écrit dans la case active et on avance.
    // Bloqué seulement si on tenterait d'AJOUTER une case au-delà de la longueur
    // (réécrire une case existante d'un code plein reste permis).
    if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
      const wouldAppend = activeIndex >= value.length;
      if (wouldAppend && value.length >= length) return;
      e.preventDefault();
      writeAt(activeIndex, e.key.toUpperCase());
      // On avance jusqu'à length inclus : après le 6e caractère saisi en séquence,
      // le curseur va "après la fin" (aucune case surlignée) -> la frappe suivante
      // est ignorée (code plein) au lieu d'écraser le dernier caractère.
      setActiveIndex(Math.min(length, activeIndex + 1));
    }
  };

  return (
    // Saisie type "OTP" : une case par caractère. Un <input> transparent capte la
    // frappe (clavier mobile + physique) mais toute la logique passe par
    // handleKeyDown -> on peut cliquer une case pour l'éditer directement.
    <div className="relative w-fit mx-auto">
      <input
        ref={inputRef}
        // value vide + onChange no-op : la saisie est pilotée par onKeyDown pour
        // gérer l'édition à une position arbitraire. On garde l'input pour le focus
        // clavier et l'ouverture du clavier natif sur mobile.
        value=""
        onChange={() => { /* saisie pilotée par onKeyDown (input contrôlé, value="") */ }}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        // autoFocus intentionnel (champ code lobby) — voir jsx-a11y/no-autofocus
        autoFocus={autoFocus}
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label={ariaLabel}
        className="absolute inset-0 w-full h-full opacity-0 -z-10 pointer-events-none"
      />
      <div className="flex items-center justify-center gap-1.5 md:gap-2">
        {Array.from({ length }).map((_, i) => {
          const char = chars[i]?.trim();
          const isActive = focused && i === activeIndex;
          return (
            <button
              key={i}
              type="button"
              onClick={() => focusSlot(i)}
              aria-label={`${ariaLabel ?? ''} ${i + 1}`}
              className={[
                'w-11 h-14 md:w-[3.25rem] md:h-16 flex items-center justify-center rounded-xl border-[2.5px] border-black stack-shadow-sm transition-all cursor-pointer',
                'font-display font-bold text-2xl md:text-3xl tabular-nums text-gray-900',
                char ? 'bg-white' : 'bg-cream-player',
                isActive ? 'ring-2 ring-brand-500 bg-white scale-105 animate-slot-pulse' : '',
              ].join(' ')}
            >
              {char || ''}
            </button>
          );
        })}
      </div>
    </div>
  );
};
