import { useEffect, useState, useRef } from 'react';
import socket from '../utils/socket';
import Timer from './Timer';
import Button from './Button';
import { GameCard, RoundPhase } from '@onskone/shared';
import { GAME_CONFIG } from '../constants/game';
import { getRandomFunFact, getNextFunFact } from '../constants/funFacts';
import { playSound } from '../utils/sounds';

interface QuestionSelectionProps {
  lobbyCode: string;
  isLeader: boolean;
  leaderName: string;
  initialRelancesUsed?: number;
}

const QuestionSelection: React.FC<QuestionSelectionProps> = ({ lobbyCode, isLeader, leaderName, initialRelancesUsed }) => {
  const [currentCard, setCurrentCard] = useState<GameCard | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(isLeader);
  const [relancesLeft, setRelancesLeft] = useState(3 - (initialRelancesUsed || 0));
  const [funFact, setFunFact] = useState<string>(getRandomFunFact());
  const [factFading, setFactFading] = useState(false);
  const factFadeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Ref pour éviter de démarrer le timer plusieurs fois (React Strict Mode, re-renders)
  const timerStartedRef = useRef(false);

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
        // Le pilier demande une carte (1 seule)
        socket.emit('requestQuestions', { lobbyCode, count: 1 });
        socket.emit('startTimer', { lobbyCode, duration: GAME_CONFIG.TIMERS.QUESTION_SELECTION });
      }
    }, 500);

    socket.on('questionsReceived', (data: { questions: GameCard[] }) => {
      if (data.questions.length > 0) {
        setCurrentCard(data.questions[0]); // Prendre la première carte
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

  const handleRequestNewCard = () => {
    if (!isLeader || selectedQuestion !== null || relancesLeft <= 0) return;

    setRelancesLeft(prev => prev - 1);
    socket.emit('requestQuestions', { lobbyCode, count: 1, isRelance: true });
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

        <div className="text-4xl md:text-5xl animate-bounce">🤔</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-4xl md:text-5xl mb-3 md:mb-4 animate-spin">⏳</div>
          <p className="text-base md:text-lg text-gray-800">Chargement des questions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-2 md:p-4">
      {currentCard && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="bg-primary text-base md:text-xl font-semibold px-3 md:px-6 rounded-full mb-3 md:mb-4 w-full text-center">
            Vous êtes le pilier de cette manche !
            <Timer duration={GAME_CONFIG.TIMERS.QUESTION_SELECTION} onExpire={handleTimerExpire} phase={RoundPhase.QUESTION_SELECTION} lobbyCode={lobbyCode} />
          </div>

          <div className="flex flex-col items-center gap-2 w-full">
            <p className="text-sm md:text-lg font-medium mb-2 md:mb-4">Choisissez une question pour cette manche :</p>
            {/* Bouton pour demander une nouvelle carte (en haut de la carte) */}
            {selectedQuestion === null && (
              <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4 mb-3 md:mb-4">
                <Button
                  variant="warning"
                  size="md"
                  onClick={handleRequestNewCard}
                  disabled={relancesLeft <= 0}
                  isLoading={loading}
                >
                  Choisir une autre carte
                </Button>
                <span className={`text-xs md:text-sm font-medium ${relancesLeft === 0 ? 'text-red-500' : 'text-gray-600'}`}>
                  Relances possibles : {relancesLeft}
                </span>
              </div>
            )}
            {/* Carte avec thème et questions */}
            <div className="w-full max-w-3xl bg-[#f9f4ee] backdrop-blur-sm border-4 md:border-8 border-primary/30 border-red-400 rounded-xl md:rounded-2xl p-3 md:p-6 shadow-lg">

              <p className="text-lg md:text-2xl font-semibold mb-2 md:mb-4 text-center pb-2 md:pb-4">Thème : {currentCard.category}</p>
              <div className="flex flex-col gap-2 md:gap-3">
                {currentCard.questions.map((question, questionIndex) => (
                  <div
                    key={questionIndex}
                    onClick={() => handleSelectQuestion(question)}
                    className={`
                    relative bg-white rounded-lg px-3 md:px-4 py-2 md:py-3 cursor-pointer border-2
                    transition-all duration-300 ease-in-out
                    ${selectedQuestion === question
                        ? 'scale-[1.02] md:scale-105 border-green-500 shadow-[0_0_0_3px_#30c94d] md:shadow-[0_0_0_4px_#30c94d]'
                        : 'border-gray-300 shadow-md hover:border-primary hover:shadow-lg'}
                    ${selectedQuestion !== null && selectedQuestion !== question ? 'opacity-50' : 'opacity-100'}
                  `}
                  >
                    <p className="text-sm md:text-base font-medium text-gray-800 pr-6 md:pr-8">
                      {question}
                    </p>
                    {selectedQuestion === question && (
                      <div className="absolute top-2 right-2 md:top-3 md:right-3 text-[18px] md:text-[24px]"></div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Message de confirmation */}
          {selectedQuestion !== null && (
            <div className="text-center mt-3 md:mt-4">
              <p className="text-green-500 text-base md:text-xl font-semibold">
                Question sélectionnée! Passage à la phase suivante...
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default QuestionSelection;
