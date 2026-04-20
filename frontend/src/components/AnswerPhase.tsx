import { useEffect, useState, useRef } from 'react';
import { LuCheck } from 'react-icons/lu';
import socket from '../utils/socket';
import Timer from './Timer';
import Button from './Button';
import Avatar from './Avatar';
import QuestionCard from './QuestionCard';
import { GAME_CONFIG, getCategoryColor } from '../constants/game';
import { IPlayer, RoundPhase, GameCard } from '@onskone/shared';
import { playSound } from '../utils/sounds';

interface AnswerPhaseProps {
  lobbyCode: string;
  question: string;
  card?: GameCard;
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
  card,
  isLeader,
  currentPlayerId,
  players,
  leaderId,
  initialAnsweredPlayerIds,
  initialMyAnswer
}) => {
  const leader = players.find(p => p.id === leaderId);
  const leaderName = leader?.name ?? '';
  const subtitle = isLeader
    ? 'Question posée aux autres joueurs'
    : leaderName
      ? `Question posée par ${leaderName}`
      : '';
  const cardColor = card ? getCategoryColor(card.category) : '#18bbed';
  // Initialiser avec les données de reconnexion si disponibles
  const [answer, setAnswer] = useState(initialMyAnswer || '');
  const [submitted, setSubmitted] = useState(!!initialMyAnswer);
  const [answeredPlayerIds, setAnsweredPlayerIds] = useState<Set<string>>(
    new Set(initialAnsweredPlayerIds || [])
  );
  // Ref pour éviter de démarrer le timer plusieurs fois (React Strict Mode, re-renders)
  const timerStartedRef = useRef(false);

  // Jouer le son au début de la phase
  useEffect(() => {
    playSound('answering');
  }, []);

  // Reset le state quand la question change (nouveau round)
  // Ne pas écraser answer si le joueur est en train de taper (reconnexion sans submit)
  useEffect(() => {
    if (initialMyAnswer) {
      setAnswer(initialMyAnswer);
      setSubmitted(true);
    }
    setAnsweredPlayerIds(new Set(initialAnsweredPlayerIds || []));
    timerStartedRef.current = false; // Reset le flag pour le nouveau round
  }, [question, initialMyAnswer, initialAnsweredPlayerIds]);

  // All players except the leader (show inactive players as disconnected)
  const respondingPlayers = players.filter(p => p.id !== leaderId);
  // Only count active players for expected answers
  const expectedAnswers = respondingPlayers.filter(p => p.isActive).length;
  const answersCount = answeredPlayerIds.size;

  useEffect(() => {
    const startTimerTimeout = setTimeout(() => {
      // Vérifier si on n'a pas déjà démarré le timer pour éviter les doublons
      if (isLeader && !timerStartedRef.current) {
        timerStartedRef.current = true;
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
    // Auto-soumettre la réponse si le joueur a écrit quelque chose mais n'a pas validé
    if (!isLeader && !submitted && answer.trim()) {
      socket.emit('submitAnswer', {
        lobbyCode,
        playerId: currentPlayerId,
        answer: answer.trim()
      });
      setSubmitted(true);
    }

    if (isLeader) {
      // Petit délai pour laisser le temps aux réponses auto-soumises d'arriver au serveur
      setTimeout(() => {
        socket.emit('timerExpired', { lobbyCode });
      }, 500);
    }
  };

  if (isLeader) {
    const ringProgress = expectedAnswers > 0 ? (answersCount / expectedAnswers) * 100 : 0;
    const ringCircumference = 2 * Math.PI * 42;
    const ringOffset = ringCircumference * (1 - ringProgress / 100);

    return (
      <div className="flex flex-col items-center justify-center h-full p-3 md:p-6 space-y-4">
        <QuestionCard question={question} card={card} subtitle={subtitle} variant="compact" />

        <Timer duration={GAME_CONFIG.TIMERS.ANSWERING} onExpire={handleTimerExpire} phase={RoundPhase.ANSWERING} lobbyCode={lobbyCode} hidden />

        <div className="flex flex-col items-center">
          <div className="relative w-24 h-24 md:w-28 md:h-28">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50" cy="50" r="42"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="8"
              />
              <circle
                cx="50" cy="50" r="42"
                fill="none"
                stroke={cardColor}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringOffset}
                className="transition-[stroke-dashoffset] duration-500 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="font-display text-2xl md:text-3xl font-bold text-gray-800 leading-none">
                {answersCount}<span className="text-gray-400">/{expectedAnswers}</span>
              </p>
            </div>
          </div>
          <p className="text-xs md:text-sm text-gray-600 mt-2 uppercase tracking-wide font-semibold">Réponses reçues</p>
        </div>

        <div className="flex flex-wrap justify-center gap-2 md:gap-3 max-w-2xl px-2">
          {respondingPlayers.map((player) => {
            const hasAnswered = answeredPlayerIds.has(player.id);
            const isDisconnected = !player.isActive;
            return (
              <div
                key={player.id}
                className={`
                  px-2 md:px-4 py-1.5 md:py-2 rounded-lg font-medium transition-all duration-300 text-sm md:text-base
                  ${isDisconnected
                    ? 'bg-gray-300 text-gray-500 opacity-60'
                    : hasAnswered
                      ? 'bg-green-500 text-white shadow-lg scale-105'
                      : 'bg-gray-200 text-gray-600'}
                `}
              >
                <span className="flex items-center gap-1.5 md:gap-2">
                  <Avatar avatarId={player.avatarId} name={player.name} size="sm" />
                  {!isDisconnected && hasAnswered && <LuCheck className="inline" aria-hidden />}
                  <span className="max-w-[80px] md:max-w-none truncate">{player.name}{isDisconnected && ' (déconnecté)'}</span>
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
      <QuestionCard question={question} card={card} subtitle={subtitle} variant="compact" />

      <Timer duration={GAME_CONFIG.TIMERS.ANSWERING} onExpire={handleTimerExpire} phase={RoundPhase.ANSWERING} lobbyCode={lobbyCode} hidden />

      {!submitted ? (
        <div className="flex-1 flex flex-col">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Écrivez votre réponse ici..."
            maxLength={GAME_CONFIG.MAX_ANSWER_LENGTH}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (answer.trim()) {
                  handleSubmit();
                }
              }
            }}
            enterKeyHint="send"
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
          <div className="bg-gray-100 rounded-lg p-4 md:p-6 max-w-md w-full border-2 border-gray-300">
            <p className="text-gray-600 text-xs md:text-sm mb-2">Votre réponse :</p>
            <p className="text-gray-800 text-base md:text-lg font-medium break-words whitespace-pre-wrap">{answer}</p>
          </div>
          <p className="text-gray-600 text-center text-sm md:text-base italic">
            En attente des autres joueurs…
          </p>
          <div className="flex flex-wrap justify-center gap-2 md:gap-3 max-w-2xl px-2">
            {respondingPlayers.map((player) => {
              const hasAnswered = answeredPlayerIds.has(player.id);
              const isDisconnected = !player.isActive;
              return (
                <div
                  key={player.id}
                  className={`
                    px-2 md:px-4 py-1.5 md:py-2 rounded-lg font-medium transition-all duration-300 text-sm md:text-base
                    ${isDisconnected
                      ? 'bg-gray-300 text-gray-500 opacity-60'
                      : hasAnswered
                        ? 'bg-green-500 text-white shadow-lg scale-105'
                        : 'bg-gray-200 text-gray-600'}
                  `}
                >
                  <span className="flex items-center gap-1.5 md:gap-2">
                    <Avatar avatarId={player.avatarId} name={player.name} size="sm" />
                    {!isDisconnected && hasAnswered && <LuCheck className="inline" aria-hidden />}
                    <span className="max-w-[80px] md:max-w-none truncate">{player.name}{isDisconnected && ' (déconnecté)'}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnswerPhase;
