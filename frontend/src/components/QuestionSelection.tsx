import React, { useEffect, useState } from 'react';
import socket from '../utils/socket';
import Timer from './Timer';
import Button from './Button';
import { GameCard } from '@onskone/shared';
import { GAME_CONFIG } from '../constants/game';

interface QuestionSelectionProps {
  lobbyCode: string;
  isLeader: boolean;
  leaderName: string;
}

const QuestionSelection: React.FC<QuestionSelectionProps> = ({ lobbyCode, isLeader, leaderName }) => {
  const [currentCard, setCurrentCard] = useState<GameCard | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(isLeader);
  const [relancesLeft, setRelancesLeft] = useState(3);

  useEffect(() => {
    if (isLeader) {
      // Le chef demande une carte (1 seule)
      socket.emit('requestQuestions', { lobbyCode, count: 1 });
      socket.emit('startTimer', { lobbyCode, duration: GAME_CONFIG.TIMERS.QUESTION_SELECTION });
    }

    socket.on('questionsReceived', (data: { questions: GameCard[] }) => {
      if (data.questions.length > 0) {
        setCurrentCard(data.questions[0]); // Prendre la première carte
      }
      setLoading(false);
    });

    return () => {
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
    setLoading(true);
    socket.emit('requestQuestions', { lobbyCode, count: 1 });
  };

  const handleTimerExpire = () => {
    // Seul le leader doit appeler timerExpired pour éviter les appels multiples
    if (isLeader) {
      socket.emit('timerExpired', { lobbyCode });
    }
  };

  if (!isLeader) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full gap-6">
        <div className="text-center mb-4 w-full max-w-2xl">
          <div className="bg-primary-light rounded-lg px-4 py-2 max-w-2xl">
            <p className="text-center mb-4">Le leader de cette manche est <strong>{leaderName}</strong></p>
            <p className="text-2xl font-semibold ">En attente de sa sélection de question…</p>
            <Timer duration={GAME_CONFIG.TIMERS.QUESTION_SELECTION} onExpire={handleTimerExpire} />
          </div>
        </div>
        <div className="text-5xl">🤔</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-5xl mb-4">⏳</div>
          <p className="text-lg text-gray-800">Chargement des questions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4">
      {currentCard && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="bg-primary text-xl font-semibold px-6 rounded-full mb-4 w-full text-center">
            Vous êtes le leader de cette manche !
            <Timer duration={GAME_CONFIG.TIMERS.QUESTION_SELECTION} onExpire={handleTimerExpire} />
          </div>
          <div className="flex flex-col items-center gap-2 w-full">
            <p className="text-lg font-medium mb-4">Choisissez une question pour cette manche :</p>

            {/* Carte avec thème et questions */}
            <div className="w-full max-w-3xl bg-white/10 backdrop-blur-sm border-8 border-primary/30 border-red-400 rounded-2xl p-6 shadow-lg">
              <p className="text-2xl font-semibold mb-4 text-center pb-4">Thème : {currentCard.category}</p>
              <div className="flex flex-col gap-3">
                {currentCard.questions.map((question, questionIndex) => (
                  <div
                    key={questionIndex}
                    onClick={() => handleSelectQuestion(question)}
                    className={`
                    relative bg-white rounded-lg px-4 py-3 cursor-pointer border-2
                    transition-all duration-300 ease-in-out
                    ${selectedQuestion === question
                        ? 'scale-105 border-green-500 shadow-[0_0_0_4px_#30c94d]'
                        : 'border-gray-300 shadow-md hover:border-primary hover:shadow-lg'}
                    ${selectedQuestion !== null && selectedQuestion !== question ? 'opacity-50' : 'opacity-100'}
                  `}
                  >
                    <p className="text-base font-medium text-gray-800">
                      {question}
                    </p>
                    {selectedQuestion === question && (
                      <div className="absolute top-3 right-3 text-[24px]">✅</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bouton pour demander une nouvelle carte */}
          {selectedQuestion === null && (
            <div className="flex items-center gap-4 pt-6">
              <Button
                variant="warning"
                size="md"
                onClick={handleRequestNewCard}
                disabled={relancesLeft <= 0}
                isLoading={loading}
              >
                Choisir une autre carte
              </Button>
              <span className={`text-sm font-medium ${relancesLeft === 0 ? 'text-red-500' : 'text-gray-600'}`}>
                Relances possibles : {relancesLeft}
              </span>
            </div>
          )}

          {/* Message de confirmation */}
          {selectedQuestion !== null && (
            <div className="text-center">
              <p className="text-green-500 text-xl font-semibold">
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
