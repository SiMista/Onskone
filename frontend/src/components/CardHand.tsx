import { Icon } from '@iconify/react';
import { GameCard } from '@onskone/shared';
import { getCategoryColor } from '../constants/game';
import { useLocale } from '../i18n';
import { useSwipe } from '../hooks/useSwipe';

/** Handlers (touch + souris) renvoyés par `useSwipe`. */
type SwipeHandlers = ReturnType<typeof useSwipe>;

interface CardHandProps {
  /** Les cartes proposées au pilier (généralement 3). */
  cards: GameCard[];
  /** Index de la carte actuellement au premier plan. */
  currentCardIndex: number;
  /** Une question a été choisie : la main se verrouille (plus de nav ni sélection). */
  locked: boolean;
  /** Question sélectionnée (mise en avant + dimming des autres). */
  selectedQuestion: string | null;
  /** Indices des cartes déjà retournées (stagger reveal au démarrage). */
  revealedIdx: Set<number>;
  /** Affiche l'overlay d'indice de swipe (mobile, pilier inactif). */
  showSwipeHint: boolean;
  /** Handlers de swipe (touch + souris) issus de `useSwipe` côté parent. */
  swipeHandlers: SwipeHandlers;
  /** Masque l'overlay de hint (au tap / fin de swipe sur l'overlay). */
  onDismissSwipeHint: () => void;
  /** Sélection d'une question dans la carte active. */
  onSelectQuestion: (question: string) => void;
  /** Mise au premier plan d'une carte latérale (clic sur le bord). */
  onCardClick: (idx: number) => void;
  /** Navigation carte précédente. */
  onPrev: () => void;
  /** Navigation carte suivante. */
  onNext: () => void;
  /** Navigation directe vers une carte (dots). */
  onGoToCard: (idx: number) => void;
}

/**
 * Main de cartes du pilier en phase de sélection de question : éventail empilé,
 * overlay d'indice de swipe (mobile), flèches et dots de navigation.
 *
 * Purement présentationnel — l'orchestration (socket, timer, fun facts, état
 * de swipe-hint) reste dans QuestionSelection. Les seuils de swipe vivent dans
 * `useSwipe` côté parent.
 */
const CardHand = ({
  cards,
  currentCardIndex,
  locked,
  selectedQuestion,
  revealedIdx,
  showSwipeHint,
  swipeHandlers,
  onDismissSwipeHint,
  onSelectQuestion,
  onCardClick,
  onPrev,
  onNext,
  onGoToCard,
}: CardHandProps) => {
  const { t } = useLocale();
  const navDisabled = locked || cards.length < 2;

  // Swipe dédié à l'overlay de hint : mêmes seuils, MAIS sans onInteract — le
  // hint ne doit se fermer qu'à la FIN du geste (touchend) ou au tap, jamais au
  // touchstart, sinon l'overlay se démonte et le touchend ne déclenche plus la
  // navigation.
  const overlaySwipe = useSwipe({ onPrev, onNext });

  return (
    <div className="flex flex-col items-center gap-0 w-full">
      <span className="flex md:hidden items-center justify-center gap-1 text-[10px] text-gray-500 italic font-sans mt-0.5 mb-2">
        <Icon icon="ph:hand-swipe-left-duotone" className="text-sm animate-wiggle" aria-hidden />
        {t.phases.questionSelection.swipeHintMobile}
      </span>

      {/* Main de cartes - hauteur stable, indépendante du contenu */}
      <div
        className="card-hand relative w-full max-w-xl mx-auto pt-3 tablet:pt-10 min-h-[min(340px,60dvh)] tablet:min-h-[min(480px,70dvh)] touch-pan-y select-none"
        {...swipeHandlers.touchHandlers}
        {...swipeHandlers.mouseHandlers}
      >
        {/* Indice de swipe (mobile uniquement) */}
        {showSwipeHint && !locked && (
          <div
            className="md:hidden absolute inset-0 z-50 flex flex-col items-center justify-center rounded-2xl bg-black/50 backdrop-blur-sm animate-fade-in pointer-events-auto"
            onClick={(e) => { e.stopPropagation(); onDismissSwipeHint(); }}
            onTouchStart={(e) => {
              e.stopPropagation();
              overlaySwipe.touchHandlers.onTouchStart(e);
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              e.preventDefault();
              overlaySwipe.touchHandlers.onTouchEnd(e);
              onDismissSwipeHint();
            }}
            aria-hidden
          >
            <Icon
              icon="ph:hand-swipe-left-duotone"
              className="text-8xl text-white animate-swipe-hint drop-shadow-lg"
              aria-hidden
            />
            <p className="mt-4 text-white text-xl font-display tracking-tight uppercase drop-shadow">
              {t.phases.questionSelection.swipeOverlayTitle}
            </p>
            <p className="mt-1 text-white/85 text-sm italic px-6 text-center">
              {t.phases.questionSelection.swipeOverlaySub}
            </p>
          </div>
        )}

        {cards.map((card, idx) => {
          const total = cards.length;
          let offset = idx - currentCardIndex;
          if (offset > total / 2) offset -= total;
          if (offset < -total / 2) offset += total;

          const isActive = offset === 0;
          const abs = Math.abs(offset);

          // Empilement vertical avec éventail plus marqué sur les cartes arrière
          const sign = offset === 0 ? 0 : offset > 0 ? 1 : -1;
          const scatterX = sign * (10 + (abs - 1) * 6); // %
          const scatterY = -(28 + (abs - 1) * 18); // px
          const tilt = sign * (7 + (abs - 1) * 2); // deg
          const backScale = 0.9 - (abs - 1) * 0.05;

          const color = getCategoryColor(card.category);

          const transformStyle = isActive
            ? 'translate(-50%, 0) rotate(0deg) scale(1)'
            : `translate(calc(-50% + ${scatterX}%), ${scatterY}px) rotate(${tilt}deg) scale(${backScale})`;

          const cardShadow = isActive
            ? '0 14px 36px rgba(0,0,0,0.28)'
            : `0 10px 22px rgba(0,0,0,0.22), 0 0 22px ${color}55`;

          return (
            <div
              key={`${card.theme}-${idx}`}
              className={`card-hand-item w-[78%] sm:w-[68%] tablet:w-[60%] absolute top-6 tablet:top-14 left-1/2 ${isActive ? 'is-active' : 'is-side'} ${isActive && locked ? 'animate-card-lift' : ''}`}
              style={{
                transform: transformStyle,
                pointerEvents: locked ? 'none' : 'auto',
                zIndex: isActive ? 30 : 20 - abs,
              }}
              onClick={() => !isActive && onCardClick(idx)}
              role={!isActive ? 'button' : undefined}
              aria-label={!isActive ? t.phases.questionSelection.goToCard(card.theme) : undefined}
            >
              <div
                className={`bg-cream-question border-4 tablet:border-[6px] rounded-2xl tablet:rounded-3xl p-2.5 tablet:p-5 relative overflow-hidden min-h-[min(290px,52dvh)] tablet:min-h-[min(400px,60dvh)] flex flex-col transition-shadow duration-500 ${revealedIdx.has(idx) ? 'animate-card-deal-in' : 'opacity-0'}`}
                style={{ borderColor: color, boxShadow: cardShadow }}
              >
                <div
                  className="font-display absolute top-2 left-2 md:top-3 md:left-3 text-[11px] md:text-sm font-bold uppercase tracking-[0.08em] px-2.5 py-0.5 rounded-full shadow-[0_2px_0_0_rgba(0,0,0,0.15)] text-white"
                  style={{ backgroundColor: color }}
                >
                  {card.category}
                </div>

                <div className="pt-6 tablet:pt-10 flex-1 flex flex-col">
                  {/* Thème : titre héros de la carte */}
                  <p className="font-display text-lg tablet:text-2xl font-bold text-center !mt-0 !mb-1 tablet:!mb-2 leading-tight tracking-tight">{card.theme}</p>
                  {/* Séparateur */}
                  <div
                    className="mx-auto rounded-full !mb-1 tablet:!mb-2"
                    style={{ width: 36, height: 2, backgroundColor: color, opacity: 0.35 }}
                  />
                  {/* Sujet : eyebrow tracké, couleur catégorie */}
                  <p
                    className="text-center !mt-0 !mb-2 tablet:!mb-4 text-[10px] tablet:text-[11px] uppercase font-semibold tracking-[0.14em] leading-tight"
                    style={{ color }}
                  >
                    {card.subject}
                  </p>

                  <div className="flex flex-col gap-1.5 tablet:gap-3 justify-start pb-3 tablet:pb-8">
                    {card.questions.map((question, qi) => {
                      const isSelected = selectedQuestion === question;
                      const dimmed = locked && !isSelected;
                      const len = question.length;
                      const questionTextClass =
                        len > 140 ? 'text-[11px] tablet:text-xs'
                        : len > 110 ? 'text-xs tablet:text-sm'
                        : len > 80 ? 'text-[13px] tablet:text-[15px]'
                        : 'text-sm tablet:text-base';
                      return (
                        <div
                          key={qi}
                          onClick={(e) => {
                            if (!isActive) return;
                            e.stopPropagation();
                            onSelectQuestion(question);
                          }}
                          className={`
                            relative bg-white rounded-lg px-3 tablet:px-4 py-2 tablet:py-3 border-2
                            min-h-[48px] tablet:min-h-[68px] flex items-center
                            transition-all duration-300 ease-in-out
                            ${isActive && !locked ? 'cursor-pointer hover:-translate-y-0.5 hover:border-primary hover:shadow-lg' : ''}
                            ${isSelected
                              ? 'scale-[1.02] border-green-500 shadow-[0_0_0_3px_var(--color-success-500)]'
                              : 'border-gray-300 shadow-md'}
                            ${dimmed ? 'opacity-50' : 'opacity-100'}
                          `}
                        >
                          <p className={`${questionTextClass} font-medium text-gray-800 leading-snug w-full`}>
                            {question}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {!isActive && (
                  <div className="absolute inset-0 bg-black/20 pointer-events-none rounded-2xl md:rounded-3xl" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation : flèches noires sobres + dots colorés */}
      <div className="flex items-center justify-center gap-4 md:gap-6 -mt-4 md:-mt-6 w-full px-2 max-w-xl mx-auto relative z-40">
        <button
          type="button"
          onClick={onPrev}
          disabled={navDisabled}
          aria-label={t.phases.questionSelection.prevCard}
          className="hidden md:flex group items-center justify-center text-black hover:-translate-x-0.5 active:translate-x-0 transition-transform duration-200 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:translate-x-0"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-10 h-10 md:w-12 md:h-12"
            aria-hidden
          >
            {/* Contour gris (tracé en premier, plus épais) */}
            <path d="M19 12H5" stroke="#9ca3af" strokeWidth="6" />
            <path d="M11 19l-7-7 7-7" stroke="#9ca3af" strokeWidth="6" />
            {/* Flèche blanche par-dessus */}
            <path d="M19 12H5" stroke="white" strokeWidth="3" />
            <path d="M11 19l-7-7 7-7" stroke="white" strokeWidth="3" />
          </svg>
        </button>

        <div className="flex items-center gap-1.5 md:gap-2 py-2">
          {cards.map((card, idx) => {
            const active = idx === currentCardIndex;
            const c = getCategoryColor(card.category);
            return (
              <button
                key={`${card.theme}-dot-${idx}`}
                type="button"
                onClick={() => !locked && onGoToCard(idx)}
                disabled={locked}
                aria-label={t.phases.questionSelection.goToCardIdx(idx + 1)}
                className={`rounded-full transition-all duration-300 ease-out ${active ? 'w-7 h-2.5 md:w-9 md:h-3' : 'w-2.5 h-2.5 md:w-3 md:h-3 hover:scale-125'}`}
                style={{
                  backgroundColor: active ? c : 'rgba(255,255,255,0.55)',
                  boxShadow: active ? '0 2px 0 0 rgba(0,0,0,0.18)' : 'inset 0 0 0 1.5px rgba(0,0,0,0.15)',
                }}
              />
            );
          })}
        </div>

        <button
          type="button"
          onClick={onNext}
          disabled={navDisabled}
          aria-label={t.phases.questionSelection.nextCard}
          className="hidden md:flex group items-center justify-center text-black hover:translate-x-0.5 active:translate-x-0 transition-transform duration-200 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:translate-x-0"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-10 h-10 md:w-12 md:h-12"
            aria-hidden
          >
            {/* Contour gris (tracé en premier, plus épais) */}
            <path d="M5 12h14" stroke="#9ca3af" strokeWidth="6" />
            <path d="M13 5l7 7-7 7" stroke="#9ca3af" strokeWidth="6" />
            {/* Flèche blanche par-dessus */}
            <path d="M5 12h14" stroke="white" strokeWidth="3" />
            <path d="M13 5l7 7-7 7" stroke="white" strokeWidth="3" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default CardHand;
