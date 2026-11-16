import { createPortal } from 'react-dom';
import { isNoResponse } from '@onskone/shared';
import PlayerAnswerCard from '../PlayerAnswerCard';
import { getDisplayText } from '../../utils/answerHelpers';

/**
 * Projecteur plein écran (REVEAL, mode local, téléphone d'un joueur) : l'écran
 * s'assombrit et la réponse posée devant lui clignote en jaune, en grand, pour que
 * la table sache quel téléphone regarder : la carte qui va être révélée, ou celle
 * que le pilier compare pendant une similarité.
 *
 * Portail sur `document.body` (comme RevealAuthorOverlay : un ancêtre transformé ou
 * clippé de la frame de jeu réduirait le `fixed` à la carte). z-40 : au-dessus du jeu
 * (réglages z-30), SOUS les modales (z-50 : Réglages, Quitter s'ouvrent par-dessus)
 * et l'overlay « qui a écrit ? » (z-100). Ne capte aucun toucher.
 * Seule animation infinie de l'écran : la carte en dessous ne clignote plus.
 */
const RevealSpotlight = ({ answer, label }: { answer: string; label: string }) =>
  createPortal(
    <div
      role="status"
      className="animate-fade-in fixed inset-0 z-40 pointer-events-none bg-black/80 flex flex-col items-center justify-center gap-4 px-4 landscape:gap-3"
    >
      <p className="text-display-md text-white text-center text-pretty">{label}</p>
      <div className="w-full max-w-lg h-[min(40vh,18rem)] landscape:max-w-2xl landscape:h-[min(60vh,16rem)]">
        <PlayerAnswerCard
          answer={getDisplayText(answer)}
          isNoResponse={isNoResponse(answer)}
          className="!h-full animate-card-soft-pulse"
        />
      </div>
    </div>,
    document.body,
  );

export default RevealSpotlight;
