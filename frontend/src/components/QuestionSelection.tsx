import React, { useEffect, useState } from 'react';
import socket from '../utils/socket';
import Timer from './Timer';
import { GameCard } from '@onskone/shared';

interface QuestionSelectionProps {
  lobbyCode: string;
  isLeader: boolean;
  leaderName: string;
}

const QuestionSelection: React.FC<QuestionSelectionProps> = ({ lobbyCode, isLeader, leaderName }) => {
  const [questions, setQuestions] = useState<GameCard[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(isLeader);

  useEffect(() => {
    if (isLeader) {
      // Le chef demande les questions
      socket.emit('requestQuestions', { lobbyCode });
      socket.emit('startTimer', { lobbyCode, duration: 30 }); // 30 secondes pour choisir
    }

    socket.on('questionsReceived', (data: { questions: GameCard[] }) => {
      setQuestions(data.questions);
      setLoading(false);
    });

    return () => {
      socket.off('questionsReceived');
    };
  }, [isLeader, lobbyCode]);

  const handleSelectQuestion = (index: number) => {
    if (!isLeader || selectedIndex !== null) return;

    const selectedCard = questions[index];
    // Sélectionner la première question de la carte (ou permettre de choisir parmi les 3)
    const selectedQuestion = selectedCard.questions[0];

    setSelectedIndex(index);
    socket.emit('selectQuestion', { lobbyCode, selectedQuestion });
  };

  const handleTimerExpire = () => {
    socket.emit('timerExpired', { lobbyCode });
  };

  if (!isLeader) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-8">
        <div className="text-center">
          <h2 className="text-[32px] font-bold text-white mb-4">Sélection de la question</h2>
          <p className="text-xl text-white/80">
            {leaderName} choisit une question...
          </p>
        </div>
        <div className="text-6xl">🤔</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-6xl mb-4">⏳</div>
          <p className="text-xl text-white">Chargement des questions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-6">
      <div className="mb-6">
        <h2 className="text-[32px] font-bold text-white mb-4 text-center">
          Choisissez une question
        </h2>
        <Timer duration={30} onExpire={handleTimerExpire} />
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-6 flex-1">
        {questions.map((card, index) => (
          <div
            key={index}
            onClick={() => handleSelectQuestion(index)}
            className={`
              relative bg-white rounded-lg p-6 cursor-pointer
              transition-all duration-300 ease-in-out
              ${selectedIndex === index ? 'scale-105 shadow-[0_0_0_4px_#30c94d]' : 'scale-100 shadow-[0_2px_10px_rgba(0,0,0,0.4)]'}
              ${selectedIndex !== null && selectedIndex !== index ? 'opacity-50' : 'opacity-100'}
            `}
            onMouseOver={(e) => {
              if (selectedIndex === null) {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.5)';
              }
            }}
            onMouseOut={(e) => {
              if (selectedIndex !== index) {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.4)';
              }
            }}
          >
            <div className="flex flex-col h-full">
              <div className="bg-[#1f5d90] text-white text-sm font-semibold py-1.5 px-3 rounded-[20px] mb-4 self-start">
                {card.category}
              </div>
              <div className="flex-1 flex items-center justify-center">
                <p className="text-lg font-medium text-center text-[#333]">
                  {card.questions[0]}
                </p>
              </div>
              {selectedIndex === index && (
                <div className="absolute top-4 right-4 text-[40px]">✅</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {selectedIndex !== null && (
        <div className="mt-6 text-center">
          <p className="text-[#30c94d] text-xl font-semibold">
            Question sélectionnée! Passage à la phase suivante...
          </p>
        </div>
      )}
    </div>
  );
};

export default QuestionSelection;
