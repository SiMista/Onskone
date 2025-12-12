import React, { useEffect, useState } from 'react';
import socket from '../utils/socket';
import Timer from './Timer';
import Button from './Button';
import { GAME_CONFIG } from '../constants/game';
import { IPlayer } from '@onskone/shared';

interface AnswerPhaseProps {
  lobbyCode: string;
  question: string;
  isLeader: boolean;
  currentPlayerId: string;
  players: IPlayer[];
  leaderId: string;
}

const AnswerPhase: React.FC<AnswerPhaseProps> = ({
  lobbyCode,
  question,
  isLeader,
  currentPlayerId,
  players,
  leaderId
}) => {
  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [answeredPlayerIds, setAnsweredPlayerIds] = useState<Set<string>>(new Set());

  // Joueurs qui doivent répondre (tous sauf le chef)
  const respondingPlayers = players.filter(p => p.id !== leaderId);
  const expectedAnswers = respondingPlayers.length;
  const answersCount = answeredPlayerIds.size;

  useEffect(() => {
    // Seul le leader démarre le timer pour éviter les conflits
    // Petit délai pour éviter les conflits avec le timer précédent
    const startTimerTimeout = setTimeout(() => {
      if (isLeader) {
        socket.emit('startTimer', { lobbyCode, duration: GAME_CONFIG.TIMERS.ANSWERING });
      }
    }, 500); // Délai de 500ms

    socket.on('playerAnswered', (data: { playerId: string; totalAnswers: number; expectedAnswers: number }) => {
      setAnsweredPlayerIds(prev => new Set([...prev, data.playerId]));
    });

    return () => {
      clearTimeout(startTimerTimeout);
      socket.off('playerAnswered');
    };
  }, [lobbyCode, isLeader]);

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
    // Seul le leader doit appeler timerExpired pour éviter les appels multiples
    if (isLeader) {
      socket.emit('timerExpired', { lobbyCode });
    }
  };

  if (isLeader) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <div className="text-center mb-4">
          <div className="bg-primary-light rounded-lg px-4 py-2 max-w-2xl">
            <p className="text-gray-600 mb-4">Question posée aux autres joueurs:</p>
            <p className="text-xl font-semibold">{question}</p>
          </div>
        </div>

        <Timer duration={GAME_CONFIG.TIMERS.ANSWERING} onExpire={handleTimerExpire} />

        <div className="text-center">
          <p className="text-4xl font-bold text-gray-800 mb-2">
            {answersCount} / {expectedAnswers}
          </p>
          <p className="text-lg text-gray-600">Réponses reçues</p>
        </div>

        <div className="flex flex-wrap justify-center gap-3 max-w-2xl">
          {respondingPlayers.map((player) => {
            const hasAnswered = answeredPlayerIds.has(player.id);
            return (
              <div
                key={player.id}
                className={`
                  px-4 py-2 rounded-lg font-medium transition-all duration-300
                  ${hasAnswered
                    ? 'bg-green-500 text-white shadow-lg scale-105'
                    : 'bg-gray-200 text-gray-600'}
                `}
              >
                <span className="flex items-center gap-2">
                  {hasAnswered && <span>✓</span>}
                  {player.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4 max-w-4xl mx-auto">
      <div className="bg-primary-light rounded-lg px-4 pb-4 mb-4">
        <p className="text-xl font-semibold text-black text-center">{question}</p>
        <Timer duration={GAME_CONFIG.TIMERS.ANSWERING} onExpire={handleTimerExpire} />
      </div>

      {!submitted ? (
        <div className="flex-1 flex flex-col">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Écrivez votre réponse ici..."
            maxLength={50}
            className="flex-1 bg-gray-100 text-gray-800 text-lg p-6 rounded-lg
              border-2 border-gray-300 focus:border-primary outline-none resize-none
              placeholder-gray-400"
          />
          <div className="mt-4 text-center">
            <Button
              variant="success"
              size="lg"
              onClick={handleSubmit}
              disabled={!answer.trim()}
            >
              Valider ma réponse
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center space-b-6">
          <p className="text-gray-600 text-center">
            En attente des autres joueurs...
            <br />
            ({answersCount} / {expectedAnswers} réponses reçues)
          </p>
          <div className="bg-gray-100 rounded-lg p-6 max-w-md border-2 border-gray-300">
            <p className="text-gray-600 text-sm mb-2">Votre réponse :</p>
            <p className="text-gray-800 text-lg font-medium break-words whitespace-pre-wrap">{answer}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnswerPhase;
