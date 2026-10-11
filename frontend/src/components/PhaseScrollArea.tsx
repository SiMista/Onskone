import { ReactNode, useRef } from 'react';
import ScrollFade from './ScrollFade';

interface PhaseScrollAreaProps {
  children: ReactNode;
  /** Classes de la colonne de contenu (padding, gap, largeur max...). */
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Zone scrollable d'une phase de jeu. La carte de Game.tsx est `overflow-hidden`
 * (cap 80dvh) : une phase plus haute que la carte (petit écran, clavier ouvert,
 * longue liste de joueurs) était coupée net, sans scroll possible. Ici le contenu
 * défile, avec le fade blanc en bas tant qu'il reste quelque chose à voir.
 * La colonne fait au moins la hauteur de la zone, donc un enfant `flex-1` remplit
 * toujours l'espace libre quand le contenu est court.
 */
const PhaseScrollArea = ({ children, className = '', style }: PhaseScrollAreaProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  return (
    <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain no-scrollbar">
        <div className={`min-h-full flex flex-col ${className}`} style={style}>
          {children}
        </div>
      </div>
      <ScrollFade scrollRef={scrollRef} />
    </div>
  );
};

export default PhaseScrollArea;
