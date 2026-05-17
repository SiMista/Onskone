import { ReactNode } from 'react';
import PlayerAnswerCard from './PlayerAnswerCard';
import RevealAvatar from './RevealAvatar';
import stickmanShowPhone from '../assets/images/game/stickman-show-phone-cropped.png';
import { RevealResult } from '@onskone/shared';
import { isNoResponse, getDisplayText, answerCardBg } from '../utils/answerHelpers';

interface RevealedAnswerCardProps {
  /** Résultat à afficher (l'auteur réel est dévoilé via `revealed`). */
  result: RevealResult;
  /** Si la réponse est en état "révélée" (avatar + couleur correct/incorrect visibles). */
  revealed: boolean;
  /** La réponse était-elle correctement attribuée par le pilier ? */
  correct: boolean;
  /** Classes supplémentaires appliquées à la PlayerAnswerCard (animations). */
  cardClassName?: string;
  /** Si vrai, applique `animate-reveal-card-swap` au row (utilisé sur les transitions pilier). */
  swapAnimation?: boolean;
  /** Re-key sur le row pour relancer l'animation (ex: `pilier-big-${cursor}`). */
  rowKey?: string;
  /** Header personnalisé. Défaut : "Montre ton écran !". `null` pour rien. */
  header?: ReactNode;
  /** Bloc footer (waiting, compteur, boutons action). */
  footer?: ReactNode;
  /** Afficher le stickman derrière la carte (défaut: true). */
  showStickman?: boolean;
}

const defaultHeader = (
  <p className="text-gray-900 text-sm md:text-xl font-semibold text-center max-md:landscape:text-xs shrink-0 -translate-x-4 md:-translate-x-8 max-md:landscape:-translate-x-2">
    Montre ton écran !
  </p>
);

/**
 * Bloc "réponse révélée" partagé entre la vue joueur (sa propre attribution)
 * et la vue pilier "deviné par lui-même" en mode "Devine ma réponse".
 *
 * Layout : header → row (bulle avatar "Écrit par" + carte avec stickman) → footer.
 *
 * Évite ~120 lignes de duplication JSX dans RevealPhase.tsx.
 */
const RevealedAnswerCard: React.FC<RevealedAnswerCardProps> = ({
  result,
  revealed,
  correct,
  cardClassName = '',
  swapAnimation = false,
  rowKey,
  header = defaultHeader,
  footer,
  showStickman = true,
}) => {
  return (
    <div className="flex flex-col h-full p-2 md:p-4 max-w-3xl mx-auto landscape:max-w-5xl">
      <div className="flex flex-col items-center gap-3 md:gap-4 pt-6 md:pt-12 pb-3 px-2 max-md:landscape:gap-2 max-md:landscape:pt-2">
        {header}

        <div
          key={rowKey}
          className={`w-full flex flex-row items-center justify-center gap-3 md:gap-5 max-md:landscape:gap-2 ${swapAnimation ? 'animate-reveal-card-swap' : ''}`}
        >
          {/* Bulle "Écrit par" : largeur prise dans le flux, hauteur 0 pour ne pas décaler verticalement */}
          <div className="shrink-0 self-center w-16 md:w-24 max-md:landscape:w-14 h-0 relative z-20">
            <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 md:gap-1.5 max-md:landscape:gap-0.5">
              <p className="text-gray-700 text-[10px] md:text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
                Écrit par
              </p>
              <RevealAvatar
                avatarId={result.playerAvatarId ?? 0}
                name={result.playerName}
                revealed={revealed}
              />
              <span
                className={`text-xs md:text-sm font-semibold text-black transition-opacity duration-500 max-md:landscape:text-[11px] truncate max-w-[6rem] md:max-w-[7rem] ${revealed ? 'opacity-100' : 'opacity-0'}`}
              >
                {result.playerName}
              </span>
            </div>
          </div>

          {/* Carte (avec stickman optionnel derrière) */}
          <div className="relative flex-1 min-w-0 max-w-lg landscape:max-w-3xl">
            {showStickman && (
              <img
                src={stickmanShowPhone}
                alt=""
                aria-hidden
                draggable={false}
                className="absolute left-[78%] -translate-x-1/2 -top-16 md:-top-20 max-md:landscape:-top-10 h-32 md:h-40 max-md:landscape:h-20 w-auto select-none pointer-events-none animate-float z-0"
              />
            )}
            <div className="relative z-10">
              <PlayerAnswerCard
                answer={getDisplayText(result.answer)}
                isNoResponse={isNoResponse(result.answer)}
                bgClass={answerCardBg(revealed, correct)}
                className={`transition-colors duration-500 ${cardClassName}`}
                heading={null}
              />
            </div>
          </div>
        </div>

        {footer}
      </div>
    </div>
  );
};

export default RevealedAnswerCard;
