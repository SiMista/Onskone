import React, { useEffect, useState } from 'react';
import socket from '../utils/socket';
import Timer from './Timer';

interface AnswerPhaseProps {
  lobbyCode: string;
  question: string;
  isLeader: boolean;
  currentPlayerId: string;
  totalPlayers: number;
}

const AnswerPhase: React.FC<AnswerPhaseProps> = ({
  lobbyCode,
  question,
  isLeader,
  currentPlayerId,
  totalPlayers
}) => {
  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [answersCount, setAnswersCount] = useState(0);

  useEffect(() => {
    // Démarrer le timer quand on entre dans la phase
    socket.emit('startTimer', { lobbyCode, duration: 60 }); // 60 secondes pour répondre

    socket.on('playerAnswered', (data: { playerId: string; totalAnswers: number; expectedAnswers: number }) => {
      setAnswersCount(data.totalAnswers);
    });

    return () => {
      socket.off('playerAnswered');
    };
  }, [lobbyCode]);

  const handleSubmit = () => {
    if (!answer.trim() || submitted || isLeader) return;

    socket.emit('submitAnswer', {
      lobbyCode,
      playerId: currentPlayerId,
      answer: answer.trim()
    });

    setSubmitted(true);
  };

  const handleTimerExpire = () => {
    socket.emit('timerExpired', { lobbyCode });
  };

  const expectedAnswers = totalPlayers - 1; // Tous sauf le chef

  if (isLeader) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-6">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-white mb-4">En attente des réponses...</h2>
          <p className="text-xl text-white/80 mb-6">Question posée :</p>
          <div className="bg-white/20 backdrop-blur-md rounded-lg p-6 max-w-2xl">
            <p className="text-2xl font-semibold text-white">{question}</p>
          </div>
        </div>

        <Timer duration={60} onExpire={handleTimerExpire} />

        <div className="text-center">
          <p className="text-4xl font-bold text-white mb-2">
            {answersCount} / {expectedAnswers}
          </p>
          <p className="text-lg text-white/70">Réponses reçues</p>
        </div>

        <div className="grid grid-cols-5 gap-2 max-w-md">
          {Array.from({ length: expectedAnswers }).map((_, index) => (
            <div
              key={index}
              className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold
                ${index < answersCount ? 'bg-green-500 text-white' : 'bg-white/20 text-white/50'}
              `}
            >
              {index < answersCount ? '✓' : '•'}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-white mb-4 text-center">Répondez à la question</h2>
        <Timer duration={60} onExpire={handleTimerExpire} />
      </div>

      <div className="bg-white/20 backdrop-blur-md rounded-lg p-8 mb-6">
        <p className="text-2xl font-semibold text-white text-center">{question}</p>
      </div>

      {!submitted ? (
        <div className="flex-1 flex flex-col">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Écrivez votre réponse ici..."
            maxLength={200}
            className="flex-1 bg-white/10 backdrop-blur-md text-white text-lg p-6 rounded-lg
              border-2 border-white/20 focus:border-white/50 outline-none resize-none
              placeholder-white/50"
          />
          <div className="flex justify-between items-center mt-4">
            <span className="text-white/70 text-sm">{answer.length} / 200 caractères</span>
            <button
              onClick={handleSubmit}
              disabled={!answer.trim()}
              className={`px-8 py-3 rounded-lg font-bold text-lg transition-all transform
                ${answer.trim()
                  ? 'bg-green-500 hover:bg-green-600 hover:scale-105 text-white cursor-pointer'
                  : 'bg-gray-500 text-gray-300 cursor-not-allowed'
                }
              `}
            >
              Valider ma réponse
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center space-y-6">
          <div className="text-6xl animate-bounce">✓</div>
          <h3 className="text-2xl font-bold text-green-400">Réponse envoyée!</h3>
          <p className="text-white/70 text-center">
            En attente des autres joueurs...
            <br />
            ({answersCount} / {expectedAnswers} réponses reçues)
          </p>
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 max-w-md">
            <p className="text-white/70 text-sm mb-2">Votre réponse :</p>
            <p className="text-white text-lg font-medium">{answer}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnswerPhase;
