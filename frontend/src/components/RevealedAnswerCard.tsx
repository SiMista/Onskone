import { ReactNode } from 'react';
import PlayerAnswerCard from './PlayerAnswerCard';
import RevealAvatar from './RevealAvatar';
import stickmanShowPhone from '../assets/images/game/stickman-show-phone-cropped.png';
import { RevealResult, isNoResponse } from '@onskone/shared';
import { getDisplayText, answerCardBg } from '../utils/answerHelpers';
import { useLocale } from '../i18n';

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
  /** Afficher la bulle "Écrit par" à gauche de la carte (défaut: true).
   *  À mettre à false pour la vue REVEAL "pas de réponse attribuée". */
  showBubble?: boolean;
  /** Si défini, la carte affiche un état d'attente "En attente que {name} t'attribue…"
   *  avec avatar inline (au lieu du texte auto-fit). */
  waitingFor?: { name: string; avatarId: number };
}

/**
 * Bloc "réponse révélée" partagé entre la vue joueur (sa propre attribution)
 * et la vue pilier "deviné par lui-même" en mode "Devine ma réponse".
 *
 * Layout : header -> row (bulle avatar "Écrit par" + carte avec stickman) -> footer.
 */
const RevealedAnswerCard = ({
  result,
  revealed,
  correct,
  cardClassName = '',
  swapAnimation = false,
  rowKey,
  header,
  footer,
  showStickman = true,
  showBubble = true,
  waitingFor,
}: RevealedAnswerCardProps) => {
  const { t } = useLocale();
  const resolvedHeader =
    header === undefined ? (
      <p className="text-gray-900 text-sm tablet:text-xl font-semibold text-center phone-landscape:text-xl shrink-0 -translate-x-4 tablet:-translate-x-8 phone-landscape:-translate-x-1">
        {t.phases.reveal.showYourScreen}
      </p>
    ) : (
      header
    );
  return (
    <div className="flex flex-col h-full p-2 tablet:p-4 max-w-3xl mx-auto landscape:max-w-5xl w-full">
      {/* En paysage phone, on prend la pleine hauteur (flex-1 min-h-0) pour que
          la carte remplisse la frame. En portrait/desktop, layout content-sized
          comme avant - le wrapper sort en hauteur naturelle. */}
      <div className="phone-landscape:flex-1 phone-landscape:min-h-0 flex flex-col items-center gap-3 tablet:gap-4 pt-6 tablet:pt-12 pb-3 px-2 phone-landscape:gap-2 phone-landscape:pt-2 phone-landscape:pb-2">
        <div className="shrink-0 w-full flex justify-center">
          {resolvedHeader}
        </div>

        <div
          key={rowKey}
          className={`w-full flex flex-row items-center justify-center gap-5 tablet:gap-7 phone-landscape:gap-6 phone-landscape:flex-1 phone-landscape:min-h-0 phone-landscape:items-stretch ${swapAnimation ? 'animate-reveal-card-swap' : ''}`}
        >
          {/* Bulle "Écrit par" : largeur prise dans le flux, hauteur 0 pour ne pas décaler verticalement */}
          {showBubble && (
            <div className="shrink-0 self-center w-16 tablet:w-24 phone-landscape:w-14 h-0 relative z-20">
              <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 tablet:gap-1.5 phone-landscape:gap-0.5">
                <p className="text-gray-700 text-[10px] tablet:text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
                  {t.phases.reveal.writtenBy}
                </p>
                <RevealAvatar
                  avatarId={result.playerAvatarId ?? 0}
                  name={result.playerName}
                  revealed={revealed}
                />
                <span
                  className={`text-xs tablet:text-sm font-semibold text-black transition-opacity duration-500 phone-landscape:text-[11px] truncate max-w-[6rem] tablet:max-w-[7rem] ${revealed ? 'opacity-100' : 'opacity-0'}`}
                >
                  {result.playerName}
                </span>
              </div>
            </div>
          )}

          {/* Carte (avec stickman optionnel derrière). h-full uniquement en
              paysage phone pour que la carte remplisse la hauteur du row flex-1. */}
          <div className="relative flex-1 min-w-0 max-w-lg phone-landscape:max-w-3xl tablet:landscape:max-w-4xl phone-landscape:h-full">
            {showStickman && (
              <img
                src={stickmanShowPhone}
                alt=""
                aria-hidden
                draggable={false}
                className="absolute left-[78%] -translate-x-1/2 -top-16 tablet:-top-20 phone-landscape:-top-16 h-32 tablet:h-40 phone-landscape:h-32 w-auto select-none pointer-events-none animate-float z-0"
              />
            )}
            <div className="relative z-10 phone-landscape:h-full">
              <PlayerAnswerCard
                answer={getDisplayText(result.answer)}
                isNoResponse={isNoResponse(result.answer)}
                bgClass={answerCardBg(revealed, correct)}
                className={`transition-colors duration-500 ${cardClassName}`}
                waitingFor={waitingFor}
              />
            </div>
          </div>
        </div>

        {/* Container footer toujours rendu (même vide) avec un min-h en paysage
            phone pour réserver l'espace de l'éventuel message "En attente…" qui
            arrive en phase REVEAL. Évite que la carte du dessus ne se rétrécisse
            à la transition GUESSING → REVEAL. */}
        <div className="shrink-0 w-full flex flex-col items-center phone-landscape:min-h-[1rem]">{footer}</div>
      </div>
    </div>
  );
};

export default RevealedAnswerCard;
