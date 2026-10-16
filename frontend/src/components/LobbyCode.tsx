import { ReactNode, useEffect, useRef, useState } from 'react';
import { LuCopy, LuCheck } from 'react-icons/lu';

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
 * Code du salon copiable au tap : l'icône copie se change en coche verte ~2s après
 * le clic, puis revient. Même bloc dans la feuille d'invitation et les Réglages en
 * partie. La copie elle-même reste au parent (`onCopy`, cf. useShareInvite).
 */
export const CopyableLobbyCode = ({
  value,
  onCopy,
  ariaLabel,
  className = '',
}: {
  value: string;
  onCopy: () => void;
  ariaLabel?: string;
  className?: string;
}) => {
  const [copied, setCopied] = useState(false);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
  }, []);

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
    copiedTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <LobbyCodeDisplay
      value={value}
      onClick={handleCopy}
      ariaLabel={ariaLabel}
      className={className}
      trailing={
        copied ? (
          <LuCheck size={18} strokeWidth={2.6} className="ml-1 text-success-500 animate-copied-pop" />
        ) : (
          <LuCopy size={18} strokeWidth={2.2} className="ml-1 text-gray-500" />
        )
      }
    />
  );
};

/**
 * Saisie d'un code de salon avec le même espacement que l'affichage. Un input
 * transparent posé sur les cases capte frappe, tap et collage (Ctrl/Cmd+V, bulle
 * "Coller" native, suggestion du clavier ; lien ou message d'invitation acceptés) ;
 * les cases reflètent la valeur. Le nettoyage (uppercase / alphanumérique) reste
 * au parent.
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

  // Cible la case sous le tap (l'input transparent couvre la rangée : cases de même
  // largeur, gaps réguliers, donc un découpage uniforme suffit). On ne laisse pas
  // viser au-delà du 1er créneau vide (sinon on créerait un trou) : on recale sur
  // la fin de la saisie.
  const handleTap = (e: React.MouseEvent<HTMLInputElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.floor(((e.clientX - rect.left) / rect.width) * length);
    setActiveIndex(Math.min(Math.max(0, Math.min(length - 1, i)), value.length));
  };

  // Écrit un caractère dans la case active et avance. false si refusé (pas
  // alphanumérique, ou ajout au-delà de la longueur ; réécrire une case existante
  // d'un code plein reste permis).
  const typeChar = (char: string): boolean => {
    if (!/^[a-zA-Z0-9]$/.test(char)) return false;
    const wouldAppend = activeIndex >= value.length;
    if (wouldAppend && value.length >= length) return false;
    writeAt(activeIndex, char.toUpperCase());
    // On avance jusqu'à length inclus : après le 6e caractère saisi en séquence,
    // le curseur va "après la fin" (aucune case surlignée) -> la frappe suivante
    // est ignorée (code plein) au lieu d'écraser le dernier caractère.
    setActiveIndex(Math.min(length, activeIndex + 1));
    return true;
  };

  // Collage : remplace toute la saisie. Accepte le code seul, ou le lien / message
  // d'invitation entier (code extrait de /join/<code> ou ?lobbyCode=).
  const applyPasted = (text: string) => {
    const fromLink = text.match(/\/join\/([a-z0-9]+)/i)?.[1] ?? text.match(/[?&]lobbyCode=([a-z0-9]+)/i)?.[1];
    const code = (fromLink ?? text).replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, length);
    if (!code) return;
    onChange(code);
    setActiveIndex(Math.min(length, code.length));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Raccourcis (Ctrl/Cmd+V...) : laissés au navigateur, sinon le "v" s'écrivait
    // dans une case et le collage n'arrivait jamais.
    if (e.ctrlKey || e.metaKey || e.altKey) return;
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
    if (e.key.length === 1 && typeChar(e.key)) e.preventDefault();
  };

  return (
    // Saisie type "OTP" : une case par caractère. Un <input> transparent posé PAR-
    // DESSUS les cases capte tout : frappe (clavier mobile + physique), tap (qui
    // cible la case touchée) et appui long / tap sur le champ actif, qui ouvre la
    // bulle "Coller" native d'iOS / Android. La saisie reste pilotée par
    // handleKeyDown pour gérer l'édition à une position arbitraire ; les cases ne
    // sont qu'un affichage.
    <div className="relative w-fit mx-auto">
      <div aria-hidden className="flex items-center justify-center gap-1.5 md:gap-2">
        {Array.from({ length }).map((_, i) => {
          const char = chars[i]?.trim();
          const isActive = focused && i === activeIndex;
          return (
            <span
              key={i}
              className={[
                'w-11 h-14 md:w-[3.25rem] md:h-16 flex items-center justify-center rounded-xl border-[2.5px] border-black stack-shadow-sm transition-all',
                'font-display font-bold text-2xl md:text-3xl tabular-nums text-gray-900',
                char ? 'bg-white' : 'bg-cream-player',
                isActive ? 'ring-2 ring-brand-500 bg-white scale-105 animate-slot-pulse' : '',
              ].join(' ')}
            >
              {char || ''}
            </span>
          );
        })}
      </div>
      <input
        ref={inputRef}
        // value vide : la saisie est pilotée par onKeyDown (édition à une position
        // arbitraire). onChange ne voit passer que le texte inséré sans keydown
        // exploitable : suggestion presse-papier / autofill du clavier mobile
        // (plusieurs caractères d'un coup) ou touche que le clavier ne décrit pas
        // (key "Unidentified", fréquent sur Android).
        value=""
        onChange={(e) => {
          const inserted = e.target.value;
          if (inserted.length > 1) applyPasted(inserted);
          else if (inserted.length === 1) typeChar(inserted);
        }}
        onPaste={(e) => {
          e.preventDefault();
          applyPasted(e.clipboardData.getData('text'));
        }}
        onKeyDown={handleKeyDown}
        onClick={handleTap}
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
        // Invisible mais touchable : PAS d'opacity-0 / pointer-events-none, sinon
        // l'OS ne propose plus "Coller". Texte et curseur transparents ; 16px pour
        // qu'iOS ne zoome pas au focus.
        className="absolute inset-0 z-10 w-full h-full m-0 p-0 border-0 bg-transparent text-transparent caret-transparent text-base outline-none cursor-pointer [-webkit-tap-highlight-color:transparent]"
      />
    </div>
  );
};
