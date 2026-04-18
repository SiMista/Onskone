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
  initialRelancesUsed?: number;
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

  const handleSelectQuestion = (question: string) => {
    if (!isLeader || selectedQuestion !== null) return;

    setSelectedQuestion(question);
    socket.emit('selectQuestion', { lobbyCode, selectedQuestion: question });
  };

  const handleTimerExpire = () => {
    // Seul le leader doit appeler timerExpired pour éviter les appels multiples
    if (isLeader) {
      socket.emit('timerExpired', { lobbyCode });
    }
  };

  if (!isLeader) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full gap-4 md:gap-6 px-2">
        <div className="text-center mb-2 md:mb-4 w-full max-w-2xl">
          <div className="bg-primary-light rounded-lg px-3 md:px-4 py-2 max-w-2xl">
            <p className="text-lg md:text-2xl ">Le pilier de cette manche est <strong>{leaderName}</strong></p>
            <p className="text-center mb-2 md:mb-4 text-sm md:text-base">En attente de sa sélection de question…</p>
            <Timer duration={GAME_CONFIG.TIMERS.QUESTION_SELECTION} onExpire={handleTimerExpire} phase={RoundPhase.QUESTION_SELECTION} lobbyCode={lobbyCode} />
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

  const locked = selectedQuestion !== null;

  const handleCardClick = (idx: number) => {
    if (locked) return;
    if (idx === currentCardIndex) return;
    setCurrentCardIndex(idx);
  };

  return (
    <div className="flex flex-col h-full p-2 md:p-4">
      {currentCard && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="bg-primary text-base md:text-xl font-semibold px-3 md:px-6 py-2 md:py-3 rounded-2xl mb-3 md:mb-4 w-full text-center">
            <p className="m-0 mb-1.5 md:mb-2">Vous êtes le pilier de cette manche !</p>
            <Timer duration={GAME_CONFIG.TIMERS.QUESTION_SELECTION} onExpire={handleTimerExpire} phase={RoundPhase.QUESTION_SELECTION} lobbyCode={lobbyCode} />
          </div>

          <div className="flex flex-col items-center gap-2 w-full">
            <p className="text-sm md:text-base font-medium text-center leading-tight">
              Choisis une question pour cette manche
              <span className="block text-xs md:text-sm text-gray-500 italic font-normal">
                (clique sur une carte à l’arrière pour la faire passer devant)
              </span>
            </p>

            {/* Main de cartes - hauteur stable, indépendante du contenu */}
            <div className="card-hand relative w-full max-w-xl mx-auto pt-6 md:pt-10 min-h-[420px] md:min-h-[480px]">
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

                return (
                  <div
                    key={`${card.theme}-${idx}`}
                    className={`card-hand-item w-[78%] sm:w-[68%] md:w-[60%] absolute top-10 md:top-14 left-1/2 ${isActive ? 'is-active' : 'is-side'} ${isActive && locked ? 'animate-card-pick' : ''}`}
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
                      className="bg-[#f9f4ee] border-4 md:border-[6px] rounded-2xl md:rounded-3xl p-3 md:p-5 shadow-[0_10px_30px_rgba(0,0,0,0.25)] relative overflow-hidden min-h-[360px] md:min-h-[400px] flex flex-col"
                      style={{ borderColor: color }}
                    >
                      <div
                        className="absolute top-2 left-2 md:top-3 md:left-3 text-[10px] md:text-xs font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full text-black"
                        style={{ backgroundColor: color }}
                      >
                        {card.category}
                      </div>

                      <div className="pt-5 md:pt-6 flex-1 flex flex-col">
                        <p className="text-lg md:text-2xl font-bold text-center !mt-0 !mb-2 md:!mb-3 leading-tight">{card.theme}</p>
                        <p className="text-sm md:text-base text-gray-600 text-center italic !mt-0 !mb-1.5 md:!mb-2 leading-tight">
                          <span className="font-semibold not-italic text-gray-700">Sujet :</span> {card.subject}
                        </p>

                        <div className="flex-1 flex flex-col gap-2 md:gap-3 justify-center">
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

            {/* Indicateur de carte sous le carousel */}
            <div className="flex justify-center gap-2 mt-3">
              {cards.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => handleCardClick(idx)}
                  disabled={locked}
                  aria-label={`Aller à la carte ${idx + 1}`}
                  className={`h-2 rounded-full transition-all ${
                    idx === currentCardIndex ? 'bg-white w-6' : 'bg-white/50 w-2 hover:bg-white/80'
                  } ${locked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                />
              ))}
            </div>
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
