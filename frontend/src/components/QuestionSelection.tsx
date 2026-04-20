import { useEffect, useState, useRef } from 'react';
import { Icon } from '@iconify/react';
import socket from '../utils/socket';
import Timer from './Timer';
import { GameCard, RoundPhase } from '@onskone/shared';
import { GAME_CONFIG, getCategoryColor } from '../constants/game';
import { getRandomFunFact, getNextFunFact } from '../constants/funFacts';
import { playSound } from '../utils/sounds';

interface QuestionSelectionProps {
  lobbyCode: string;
  isLeader: boolean;
  leaderName: string;
}

const QuestionSelection: React.FC<QuestionSelectionProps> = ({ lobbyCode, isLeader, leaderName }) => {
  const [cards, setCards] = useState<GameCard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(isLeader);
  const [funFact, setFunFact] = useState<string>(getRandomFunFact());
  const [factFading, setFactFading] = useState(false);
  const factFadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref pour éviter de démarrer le timer plusieurs fois (React Strict Mode, re-renders)
  const timerStartedRef = useRef(false);

  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const hasInteractedRef = useRef(false);

  const currentCard = cards.length > 0 ? cards[currentCardIndex] : null;

  // Jouer le son au début de la phase
  useEffect(() => {
    playSound('questionSelection');
  }, []);

  // Effet pour changer les faits insolites toutes les 8 secondes (pour les non-leaders)
  useEffect(() => {
    if (isLeader) return;

    const factInterval = setInterval(() => {
      setFactFading(true);
      // Clear any existing fade timeout before setting a new one
      if (factFadeTimeoutRef.current) {
        clearTimeout(factFadeTimeoutRef.current);
      }
      factFadeTimeoutRef.current = setTimeout(() => {
        setFunFact(prev => getNextFunFact(prev));
        setFactFading(false);
      }, 300); // Durée du fade out avant de changer
    }, 12000);

    return () => {
      clearInterval(factInterval);
      if (factFadeTimeoutRef.current) {
        clearTimeout(factFadeTimeoutRef.current);
      }
    };
  }, [isLeader]);

  useEffect(() => {
    // Petit délai pour laisser le temps aux listeners socket de s'initialiser sur tous les clients
    const startTimerTimeout = setTimeout(() => {
      // Vérifier si on n'a pas déjà démarré le timer pour éviter les doublons
      if (isLeader && !timerStartedRef.current) {
        timerStartedRef.current = true;
        // Le pilier demande 3 cartes
        socket.emit('requestQuestions', { lobbyCode, count: 3 });
        socket.emit('startTimer', { lobbyCode, duration: GAME_CONFIG.TIMERS.QUESTION_SELECTION });
      }
    }, 500);

    socket.on('questionsReceived', (data: { questions: GameCard[] }) => {
      if (data.questions.length > 0) {
        setCards(data.questions);
        setCurrentCardIndex(0);
      }
      setLoading(false);
    });

    return () => {
      clearTimeout(startTimerTimeout);
      socket.off('questionsReceived');
    };
  }, [isLeader, lobbyCode]);

  const locked = selectedQuestion !== null;

  const handleSelectQuestion = (question: string) => {
    if (!isLeader || selectedQuestion !== null) return;

    setSelectedQuestion(question);
    socket.emit('selectQuestion', { lobbyCode, selectedQuestion: question });
  };

  const handleTimerExpire = () => {
    if (!isLeader) return;
    // Si pas de sélection, choisir une question au hasard dans la carte active
    // et l'émettre en premier, avant que le serveur ne pioche depuis une autre carte.
    if (selectedQuestion === null && currentCard && currentCard.questions.length > 0) {
      const q = currentCard.questions[Math.floor(Math.random() * currentCard.questions.length)];
      setSelectedQuestion(q);
      socket.emit('selectQuestion', { lobbyCode, selectedQuestion: q });
      return;
    }
    socket.emit('timerExpired', { lobbyCode });
  };

  const goToCard = (idx: number) => {
    if (locked) return;
    const total = cards.length;
    if (total === 0) return;
    const next = ((idx % total) + total) % total;
    setCurrentCardIndex(next);
  };

  const goPrev = () => goToCard(currentCardIndex - 1);
  const goNext = () => goToCard(currentCardIndex + 1);

  // Affiche un indice de swipe si le pilier ne swipe pas dans les 3 premières secondes (mobile)
  useEffect(() => {
    if (!isLeader || loading || locked || cards.length < 2) return;
    if (hasInteractedRef.current) return;
    const t = setTimeout(() => {
      if (!hasInteractedRef.current) setShowSwipeHint(true);
    }, 3000);
    return () => clearTimeout(t);
  }, [isLeader, loading, locked, cards.length]);

  const dismissSwipeHint = () => {
    hasInteractedRef.current = true;
    setShowSwipeHint(false);
  };

  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    dismissSwipeHint();
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartXRef.current;
    const dy = e.changedTouches[0].clientY - touchStartYRef.current;
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx > 0) goPrev(); else goNext();
  };

  const mouseStartXRef = useRef<number | null>(null);
  const mouseStartYRef = useRef<number | null>(null);
  const handleMouseDown = (e: React.MouseEvent) => {
    if (locked) return;
    dismissSwipeHint();
    mouseStartXRef.current = e.clientX;
    mouseStartYRef.current = e.clientY;
  };
  const handleMouseUp = (e: React.MouseEvent) => {
    if (mouseStartXRef.current === null || mouseStartYRef.current === null) return;
    const dx = e.clientX - mouseStartXRef.current;
    const dy = e.clientY - mouseStartYRef.current;
    mouseStartXRef.current = null;
    mouseStartYRef.current = null;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx > 0) goPrev(); else goNext();
  };
  const handleMouseLeave = () => {
    mouseStartXRef.current = null;
    mouseStartYRef.current = null;
  };

  if (!isLeader) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full gap-4 md:gap-6 px-2">
        <div className="text-center mb-2 md:mb-4 w-full max-w-2xl">
          <div className="bg-primary-light rounded-lg px-3 md:px-4 py-2 max-w-2xl">
            <p className="text-lg md:text-2xl ">Le pilier de cette manche est <strong>{leaderName}</strong></p>
            <p className="text-center mb-2 md:mb-4 text-sm md:text-base">En attente de sa sélection de question…</p>
            <Timer duration={GAME_CONFIG.TIMERS.QUESTION_SELECTION} onExpire={handleTimerExpire} phase={RoundPhase.QUESTION_SELECTION} lobbyCode={lobbyCode} hidden />
          </div>
        </div>

        {/* Fait insolite */}
        <div className="max-w-md text-center px-4">
          <p className="text-[10px] md:text-xs text-gray-500 uppercase font-semibold mb-1 md:mb-2">Le saviez-vous ?</p>
          <p
            className={`text-gray-700 text-sm md:text-base italic transition-opacity duration-300 ${factFading ? 'opacity-0' : 'opacity-100'}`}
          >
            {funFact}
          </p>
        </div>

        <Icon icon="fluent-emoji-flat:thinking-face" className="text-4xl md:text-5xl animate-bounce" width="1em" height="1em" aria-hidden />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Icon icon="fluent-emoji-flat:hourglass-not-done" className="text-4xl md:text-5xl mb-3 md:mb-4 animate-spin" width="1em" height="1em" aria-hidden />
          <p className="text-base md:text-lg text-gray-800">Chargement des questions...</p>
        </div>
      </div>
    );
  }

  const handleCardClick = (idx: number) => {
    if (locked) return;
    if (idx === currentCardIndex) return;
    setCurrentCardIndex(idx);
  };


  return (
    <div className="flex flex-col h-full p-2 md:p-4">
      {currentCard && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="bg-primary text-base md:text-xl px-3 md:px-6 py-2 md:py-3 rounded-2xl mb-3 md:mb-4 w-full text-center">
            <p className="font-display text-lg md:text-2xl m-0 mb-1.5 md:mb-2 tracking-tight">Vous êtes le pilier de cette manche !</p>
            <Timer duration={GAME_CONFIG.TIMERS.QUESTION_SELECTION} onExpire={handleTimerExpire} phase={RoundPhase.QUESTION_SELECTION} lobbyCode={lobbyCode} hidden />
          </div>

          <div className="flex flex-col items-center gap-2 w-full">
            <p className="font-display text-base md:text-lg text-center leading-tight tracking-tight">
              Choisis une question pour cette manche
              <span className="flex md:hidden items-center justify-center gap-1.5 mt-1 text-xs text-gray-500 italic font-sans font-normal">
                <Icon icon="ph:hand-swipe-left-duotone" className="text-base animate-wiggle" aria-hidden />
                swipe pour changer de carte
              </span>
            </p>

            {/* Main de cartes - hauteur stable, indépendante du contenu */}
            <div
              className="card-hand relative w-full max-w-xl mx-auto pt-6 md:pt-10 min-h-[420px] md:min-h-[480px] touch-pan-y select-none"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
            >
              {/* Indice de swipe (mobile uniquement) */}
              {showSwipeHint && !locked && (
                <div
                  className="md:hidden absolute inset-0 z-50 flex flex-col items-center justify-center rounded-2xl bg-black/50 backdrop-blur-sm animate-fade-in pointer-events-auto"
                  onClick={(e) => { e.stopPropagation(); dismissSwipeHint(); }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    touchStartXRef.current = e.touches[0].clientX;
                    touchStartYRef.current = e.touches[0].clientY;
                  }}
                  onTouchEnd={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (touchStartXRef.current !== null && touchStartYRef.current !== null) {
                      const dx = e.changedTouches[0].clientX - touchStartXRef.current;
                      const dy = e.changedTouches[0].clientY - touchStartYRef.current;
                      touchStartXRef.current = null;
                      touchStartYRef.current = null;
                      if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy)) {
                        if (dx > 0) goPrev(); else goNext();
                      }
                    }
                    dismissSwipeHint();
                  }}
                  aria-hidden
                >
                  <Icon
                    icon="ph:hand-swipe-left-duotone"
                    className="text-8xl text-white animate-swipe-hint drop-shadow-lg"
                    aria-hidden
                  />
                  <p className="mt-4 text-white text-xl font-display tracking-tight uppercase drop-shadow">
                    Swipe
                  </p>
                  <p className="mt-1 text-white/85 text-sm italic px-6 text-center">
                    pour changer de carte
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
                    className={`card-hand-item w-[78%] sm:w-[68%] md:w-[60%] absolute top-10 md:top-14 left-1/2 ${isActive ? 'is-active' : 'is-side'} ${isActive && locked ? 'animate-card-lift' : ''}`}
                    style={{
                      transform: transformStyle,
                      pointerEvents: locked ? 'none' : 'auto',
                      zIndex: isActive ? 30 : 20 - abs,
                    }}
                    onClick={() => !isActive && handleCardClick(idx)}
                    role={!isActive ? 'button' : undefined}
                    aria-label={!isActive ? `Voir la carte ${card.theme}` : undefined}
                  >
                    <div
                      className="bg-cream-question border-4 md:border-[6px] rounded-2xl md:rounded-3xl p-3 md:p-5 relative overflow-hidden min-h-[360px] md:min-h-[400px] flex flex-col transition-shadow duration-500"
                      style={{ borderColor: color, boxShadow: cardShadow }}
                    >
                      <div
                        className="font-display absolute top-2 left-2 md:top-3 md:left-3 text-[11px] md:text-sm font-bold uppercase tracking-[0.08em] px-2.5 py-0.5 rounded-full shadow-[0_2px_0_0_rgba(0,0,0,0.15)] text-white"
                        style={{ backgroundColor: color }}
                      >
                        {card.category}
                      </div>

                      <div className="pt-8 md:pt-10 flex-1 flex flex-col">
                        {/* Thème : titre héros de la carte */}
                        <p className="font-display text-xl md:text-2xl font-bold text-center !mt-0 !mb-1.5 md:!mb-2 leading-tight tracking-tight">{card.theme}</p>
                        {/* Séparateur */}
                        <div
                          className="mx-auto rounded-full !mb-1.5 md:!mb-2"
                          style={{ width: 36, height: 2, backgroundColor: color, opacity: 0.35 }}
                        />
                        {/* Sujet : eyebrow tracké, couleur catégorie */}
                        <p
                          className="text-center !mt-0 !mb-3 md:!mb-4 text-[10px] md:text-[11px] uppercase font-semibold tracking-[0.14em] leading-tight"
                          style={{ color }}
                        >
                          {card.subject}
                        </p>

                        <div className="flex flex-col gap-2 md:gap-3 justify-start pb-6 md:pb-8">
                          {card.questions.map((question, qi) => {
                            const isSelected = selectedQuestion === question;
                            const dimmed = locked && !isSelected;
                            return (
                              <div
                                key={qi}
                                onClick={(e) => {
                                  if (!isActive) return;
                                  e.stopPropagation();
                                  handleSelectQuestion(question);
                                }}
                                className={`
                                  relative bg-white rounded-lg px-3 md:px-4 py-2.5 md:py-3 border-2
                                  min-h-[58px] md:min-h-[68px] flex items-center
                                  transition-all duration-300 ease-in-out
                                  ${isActive && !locked ? 'cursor-pointer hover:-translate-y-0.5 hover:border-primary hover:shadow-lg' : ''}
                                  ${isSelected
                                    ? 'scale-[1.02] border-green-500 shadow-[0_0_0_3px_#30c94d]'
                                    : 'border-gray-300 shadow-md'}
                                  ${dimmed ? 'opacity-50' : 'opacity-100'}
                                `}
                              >
                                <p className="text-sm md:text-base font-medium text-gray-800 leading-snug w-full">
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

            {/* Navigation : flèches rondes + dots colorés */}
            {(() => {
              const activeColor = currentCard ? getCategoryColor(currentCard.category) : '#18bbed';
              const navDisabled = locked || cards.length < 2;
              return (
                <div className="flex items-center justify-center gap-4 md:gap-6 -mt-4 md:-mt-6 w-full px-2 max-w-xl mx-auto relative z-40">
                  <button
                    type="button"
                    onClick={goPrev}
                    disabled={navDisabled}
                    aria-label="Carte précédente"
                    className="group w-11 h-11 md:w-14 md:h-14 rounded-full bg-cream-question border-[3px] md:border-4 flex items-center justify-center shadow-[0_4px_0_0_rgba(0,0,0,0.18)] hover:-translate-y-0.5 hover:shadow-[0_6px_0_0_rgba(0,0,0,0.2)] active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.2)] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-[0_4px_0_0_rgba(0,0,0,0.18)]"
                    style={{ borderColor: activeColor }}
                  >
                    <Icon
                      icon="ph:arrow-left-bold"
                      className="text-xl md:text-2xl transition-transform duration-200 group-hover:-translate-x-0.5"
                      style={{ color: activeColor }}
                      aria-hidden
                    />
                  </button>

                  <div className="flex items-center gap-1.5 md:gap-2 py-2">
                    {cards.map((card, idx) => {
                      const active = idx === currentCardIndex;
                      const c = getCategoryColor(card.category);
                      return (
                        <button
                          key={`${card.theme}-dot-${idx}`}
                          type="button"
                          onClick={() => !locked && goToCard(idx)}
                          disabled={locked}
                          aria-label={`Aller à la carte ${idx + 1}`}
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
                    onClick={goNext}
                    disabled={navDisabled}
                    aria-label="Carte suivante"
                    className="group w-11 h-11 md:w-14 md:h-14 rounded-full bg-cream-question border-[3px] md:border-4 flex items-center justify-center shadow-[0_4px_0_0_rgba(0,0,0,0.18)] hover:-translate-y-0.5 hover:shadow-[0_6px_0_0_rgba(0,0,0,0.2)] active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.2)] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-[0_4px_0_0_rgba(0,0,0,0.18)]"
                    style={{ borderColor: activeColor }}
                  >
                    <Icon
                      icon="ph:arrow-right-bold"
                      className="text-xl md:text-2xl transition-transform duration-200 group-hover:translate-x-0.5"
                      style={{ color: activeColor }}
                      aria-hidden
                    />
                  </button>
                </div>
              );
            })()}
          </div>

          {/* Message de confirmation */}
          {locked && (
            <div className="text-center mt-3 md:mt-4">
              <p className="text-white text-base md:text-xl font-semibold drop-shadow">
                Question sélectionnée ! Passage à la phase suivante…
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default QuestionSelection;
