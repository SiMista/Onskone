import { LuLock } from 'react-icons/lu';

/**
 * Rappel "seul l'hôte peut modifier" des réglages en lecture seule (thèmes,
 * options de jeu) : cadenas + texte. Secoué à chaque incrément de `shakeKey`
 * (un non-hôte vient de toucher un contrôle verrouillé) : le `key` remonte le
 * nœud pour rejouer l'animation à chaque tentative. 0 = pas de secousse.
 * La couleur du texte vient de `className` (fond sombre ou clair selon l'écran).
 */
const HostOnlyHint = ({ text, shakeKey, className = '' }: {
  text: string;
  shakeKey: number;
  className?: string;
}) => (
  <p
    key={shakeKey}
    className={`!my-0 inline-flex items-center gap-1.5 text-xs font-sans italic leading-tight origin-left ${shakeKey ? 'animate-paper-shake-slow' : ''} ${className}`}
  >
    <LuLock size={12} strokeWidth={2.5} aria-hidden className="shrink-0" />
    <span>{text}</span>
  </p>
);

export default HostOnlyHint;
