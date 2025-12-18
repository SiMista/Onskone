import { useEffect, useState } from 'react';
import socket from '../utils/socket';
import Timer from './Timer';
import Button from './Button';
import Avatar from './Avatar';
import { GAME_CONFIG } from '../constants/game';
import { IPlayer, RoundPhase } from '@onskone/shared';

interface AnswerPhaseProps {
  lobbyCode: string;
  question: string;
  isLeader: boolean;
  currentPlayerId: string;
  players: IPlayer[];
  leaderId: string;
  initialAnsweredPlayerIds?: string[];
  initialMyAnswer?: string;
}

const AnswerPhase: React.FC<AnswerPhaseProps> = ({
  lobbyCode,
  question,
  isLeader,
  currentPlayerId,
  players,
  leaderId,
  initialAnsweredPlayerIds,
  initialMyAnswer
}) => {
  // Initialiser avec les données de reconnexion si disponibles
  const [answer, setAnswer] = useState(initialMyAnswer || '');
  const [submitted, setSubmitted] = useState(!!initialMyAnswer);
  const [answeredPlayerIds, setAnsweredPlayerIds] = useState<Set<string>>(
    new Set(initialAnsweredPlayerIds || [])
  );

  const respondingPlayers = players.filter(p => p.id !== leaderId);
  const expectedAnswers = respondingPlayers.length;
  const answersCount = answeredPlayerIds.size;

  useEffect(() => {
    const startTimerTimeout = setTimeout(() => {
      if (isLeader) {
        socket.emit('startTimer', { lobbyCode, duration: GAME_CONFIG.TIMERS.ANSWERING });
      }
    }, 500);

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
    if (isLeader) {
      socket.emit('timerExpired', { lobbyCode });
    }
  };

  if (isLeader) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-3 md:p-6 space-y-4">
        <div className="text-center mb-2 md:mb-4 w-full ">
          <div className="bg-primary-light rounded-lg px-3 md:px-4 py-2 max-w-2xl mx-auto ">
            <p className="text-gray-600 mb-2 md:mb-4 text-sm md:text-base">Question posée aux autres joueurs:</p>
            <p className="text-lg md:text-2xl font-semibold">{question}</p>
          </div>
        </div>

        <div className="w-full max-w-md">
          <Timer duration={GAME_CONFIG.TIMERS.ANSWERING} onExpire={handleTimerExpire} phase={RoundPhase.ANSWERING} lobbyCode={lobbyCode} />
        </div>

        <div className="text-center">
          <p className="text-3xl md:text-4xl font-bold text-gray-800 mb-1 md:mb-2">
            {answersCount} / {expectedAnswers}
          </p>
          <p className="text-base md:text-lg text-gray-600">Réponses reçues</p>
        </div>

        <div className="flex flex-wrap justify-center gap-2 md:gap-3 max-w-2xl px-2">
          {respondingPlayers.map((player) => {
            const hasAnswered = answeredPlayerIds.has(player.id);
            return (
              <div
                key={player.id}
                className={`
                  px-2 md:px-4 py-1.5 md:py-2 rounded-lg font-medium transition-all duration-300 text-sm md:text-base
                  ${hasAnswered
                    ? 'bg-green-500 text-white shadow-lg scale-105'
                    : 'bg-gray-200 text-gray-600'}
                `}
              >
                <span className="flex items-center gap-1.5 md:gap-2">
                  <Avatar avatarId={player.avatarId} name={player.name} size="sm" />
                  {hasAnswered && <span>✓</span>}
                  <span className="max-w-[80px] md:max-w-none truncate">{player.name}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-3 md:p-4 max-w-4xl mx-auto">
      <div className="bg-primary-light rounded-lg px-3 md:px-4 pb-3 md:pb-4 mb-3 md:mb-4">
        <p className="text-lg md:text-2xl font-semibold text-black text-center">{question}</p>
        <Timer duration={GAME_CONFIG.TIMERS.ANSWERING} onExpire={handleTimerExpire} phase={RoundPhase.ANSWERING} lobbyCode={lobbyCode} />
      </div>

      {!submitted ? (
        <div className="flex-1 flex flex-col">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Écrivez votre réponse ici..."
            maxLength={GAME_CONFIG.MAX_ANSWER_LENGTH}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
              }
            }}
            className="flex-1 min-h-[120px] md:min-h-[150px] bg-gray-100 text-gray-800 text-base md:text-lg p-4 md:p-6 rounded-lg
              border-2 border-gray-300 focus:border-primary outline-none resize-none
              placeholder-gray-400"
          />
          <div className="mt-3 md:mt-4 text-center">
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
        <div className="flex-1 flex flex-col items-center justify-center space-y-4 md:space-y-6">
          <p className="text-gray-600 text-center text-sm md:text-base">
            En attente des autres joueurs...
            <br />
            <div className="flex flex-wrap justify-center gap-2 md:gap-3 max-w-2xl px-2">
              {respondingPlayers.map((player) => {
                const hasAnswered = answeredPlayerIds.has(player.id);
                return (
                  <div
                    key={player.id}
                    className={`
                  px-2 md:px-4 py-1.5 md:py-2 rounded-lg font-medium transition-all duration-300 text-sm md:text-base
                  ${hasAnswered
                        ? 'bg-green-500 text-white shadow-lg scale-105'
                        : 'bg-gray-200 text-gray-600'}
                `}
                  >
                    <span className="flex items-center gap-1.5 md:gap-2">
                      <Avatar avatarId={player.avatarId} name={player.name} size="sm" />
                      {hasAnswered && <span>✓</span>}
                      <span className="max-w-[80px] md:max-w-none truncate">{player.name}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </p>
          <div className="bg-gray-100 rounded-lg p-4 md:p-6 max-w-md w-full border-2 border-gray-300">
            <p className="text-gray-600 text-xs md:text-sm mb-2">Votre réponse :</p>
            <p className="text-gray-800 text-base md:text-lg font-medium break-words whitespace-pre-wrap">{answer}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnswerPhase;
