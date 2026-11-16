import type { ReactNode } from 'react';
import { Icon } from './Icon';
import ScreenLogo from './ScreenLogo';
import { TOP_CONTROLS_CLASS } from '../utils/appBanner';

/** Zone de la phase dans la carte de jeu (scroll interne si la phase dépasse). */
export const PHASE_AREA_CLASS = 'flex-1 min-h-0 flex flex-col overflow-y-auto overscroll-contain no-scrollbar';

/**
 * Cadre de l'écran de jeu : logo, réglages flottants en haut à droite, carte blanche
 * avec l'en-tête « Round x/y • pilier » + sablier, puis la phase (children).
 * Partagé par la page de jeu et l'aperçu d'écrans du Studio : l'aperçu ne peut pas
 * dériver du vrai écran.
 */
const GameFrame = ({
  overlays,
  settings,
  roundNumber,
  totalRounds,
  leaderName,
  timer,
  children,
}: {
  /** Overlays plein écran (intros de phase, sondes du Studio), posés sous le logo. */
  overlays?: ReactNode;
  /** Bouton de réglages (flotte en haut à droite, hors de la carte). */
  settings: ReactNode;
  roundNumber: number;
  totalRounds: number;
  leaderName: string;
  /** Sablier de la phase ; rien = phase sans timer (REVEAL). */
  timer?: ReactNode;
  children: ReactNode;
}) => (
  <div className="h-full flex flex-col items-center justify-center overflow-hidden px-2 tablet:px-0 safe-pt relative">
    <ScreenLogo />
    {overlays}
    {/* Réglages flottants en haut à droite (hors de la carte), comme sur l'accueil. */}
    <div className={`absolute ${TOP_CONTROLS_CLASS} right-3 z-30 safe-pt transition-[top,translate] duration-200 short-landscape:top-1.5 short-landscape:[&_button]:!text-gray-600 short-landscape:[&_button]:hover:!bg-black/5`}>
      {settings}
    </div>
    {/* Main game area - sized to content, centré dans la fenêtre. La carte
        interne a son propre cap dvh pour scroller si la phase dépasse.
        Erreurs et notifs sont remontées via le Toast global (haut centré). */}
    <div
      className={`w-full max-w-4xl max-h-full min-h-0 mx-auto px-2 pt-14 tablet:pt-4 short-landscape:pt-1 flex flex-col safe-pb`}
    >
      <div className="min-h-0 max-h-[80dvh] phone-landscape:max-h-none phone-landscape:h-[90dvh] short-landscape:h-[calc(100dvh-0.5rem)] bg-white rounded-xl px-2 py-5 tablet:px-4 tablet:py-7 phone-landscape:!p-2 phone-landscape:tablet:!p-4 short-landscape:!p-1.5 flex flex-col overflow-hidden card-paper stack-shadow">
        {/* Game info header : round + host à gauche, sablier à droite */}
        <div className="shrink-0 flex items-center justify-between gap-3 mb-2 tablet:mb-4 pb-2 tablet:pb-3 short-landscape:mb-1 short-landscape:pb-1 short-landscape:pr-10 border-b-[2.5px] border-dashed border-black/30">
          <div className="flex items-center gap-1.5 flex-wrap text-gray-800 text-left">
            <span className="text-xs tablet:text-sm font-display font-bold tracking-wide">
              Round {roundNumber}<span className="text-gray-500">/{totalRounds}</span>
            </span>
            <span className="text-gray-400">•</span>
            <Icon icon="fluent-emoji-flat:crown" width="1.1em" height="1.1em" aria-hidden />
            <span className="text-xs tablet:text-sm font-display font-semibold tracking-wide truncate max-w-[140px] tablet:max-w-[220px]">
              {leaderName}
            </span>
          </div>
          {/* Sans timer, placeholder de la largeur réelle du sablier (size="sm") : sinon
              grand vide à droite du header en phase REVEAL (en paysage phone la zone
              faisait 56px alors que le sablier ne fait que 24px → décalage entre phases). */}
          {timer ?? <div className="w-[24px] tablet:w-14" aria-hidden />}
        </div>

        {children}
      </div>
    </div>
  </div>
);

export default GameFrame;
