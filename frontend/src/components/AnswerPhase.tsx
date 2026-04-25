import { useEffect, useState, useRef } from 'react';
import { LuCheck } from 'react-icons/lu';
import socket from '../utils/socket';
import HourglassTimer from './HourglassTimer';
import Avatar from './Avatar';
import QuestionCard from './QuestionCard';
import Button from './Button';
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

type SubmitStage = 'idle' | 'shaking' | 'done';

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
  const [answer, setAnswer] = useState(initialMyAnswer || '');
  const [submitted, setSubmitted] = useState(!!initialMyAnswer);
  const [stage, setStage] = useState<SubmitStage>(initialMyAnswer ? 'done' : 'idle');
  const [answeredPlayerIds, setAnsweredPlayerIds] = useState<Set<string>>(
    new Set(initialAnsweredPlayerIds || [])
  );
  const timerStartedRef = useRef(false);
  const stageTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    playSound('answering');
  }, []);

  useEffect(() => {
    stageTimeoutsRef.current.forEach(clearTimeout);
    stageTimeoutsRef.current = [];
    if (initialMyAnswer) {
      setAnswer(initialMyAnswer);
      setSubmitted(true);
      setStage('done');
    } else {
      setAnswer('');
      setSubmitted(false);
      setStage('idle');
    }
    setAnsweredPlayerIds(new Set(initialAnsweredPlayerIds || []));
    timerStartedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question]);

  useEffect(() => {
    const timeouts = stageTimeoutsRef.current;
    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, []);

  const respondingPlayers = players.filter(p => p.id !== leaderId);
  const expectedAnswers = respondingPlayers.filter(p => p.isActive).length;
  const answersCount = answeredPlayerIds.size;

  useEffect(() => {
    const startTimerTimeout = setTimeout(() => {
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
    if (!answer.trim() || submitted || isLeader || stage !== 'idle') return;

    // Déclenche la séquence d'animation
    setStage('shaking');
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([20, 40, 80]);
    }

    const t = setTimeout(() => {
      socket.emit('submitAnswer', {
        lobbyCode,
        playerId: currentPlayerId,
        answer: answer.trim()
      });
      setSubmitted(true);
      setStage('done');
    }, 400);
    stageTimeoutsRef.current.push(t);
  };

  const handleTimerExpire = () => {
    if (!isLeader && !submitted && answer.trim()) {
      socket.emit('submitAnswer', {
        lobbyCode,
        playerId: currentPlayerId,
        answer: answer.trim()
      });
      setSubmitted(true);
      setStage('done');
    }

    if (isLeader) {
      setTimeout(() => {
        socket.emit('timerExpired', { lobbyCode });
      }, 500);
    }
  };

  // =====================================================================
  // VUE LEADER
  // =====================================================================
  if (isLeader) {
    const ringProgress = expectedAnswers > 0 ? (answersCount / expectedAnswers) * 100 : 0;
    const ringCircumference = 2 * Math.PI * 42;
    const ringOffset = ringCircumference * (1 - ringProgress / 100);

    return (
      <div className="flex flex-col items-center justify-start h-full p-3 md:p-6 gap-4">
        <QuestionCard question={question} card={card} subtitle={subtitle} variant="compact" />

        <HourglassTimer
          duration={GAME_CONFIG.TIMERS.ANSWERING}
          onExpire={handleTimerExpire}
          phase={RoundPhase.ANSWERING}
          lobbyCode={lobbyCode}
          hidden
        />

        <div className="flex flex-col items-center">
          <div className="relative w-24 h-24 md:w-28 md:h-28">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#e5e7eb" strokeWidth="8" />
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
          <p className="text-xs md:text-sm text-gray-600 mt-2 uppercase tracking-wide font-semibold">
            Réponses reçues
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2 md:gap-3 max-w-2xl px-2">
          {respondingPlayers.map((player) => {
            const hasAnswered = answeredPlayerIds.has(player.id);
            const isDisconnected = !player.isActive;
            return (
              <div
                key={player.id}
                className={`
                  px-2 md:px-4 py-1.5 md:py-2 rounded-lg font-medium transition-all duration-300 text-sm md:text-base border-2
                  ${isDisconnected
                    ? 'bg-gray-300 text-gray-500 opacity-60 border-gray-400'
                    : hasAnswered
                      ? 'bg-green-500 text-white border-black scale-105 stack-shadow-sm'
                      : 'bg-white text-gray-700 border-gray-300'}
                `}
              >
                <span className="flex items-center gap-1.5 md:gap-2">
                  <Avatar avatarId={player.avatarId} name={player.name} size="sm" />
                  {!isDisconnected && hasAnswered && <LuCheck className="inline" aria-hidden />}
                  <span className="max-w-[80px] md:max-w-none truncate">
                    {player.name}{isDisconnected && ' (déconnecté)'}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // =====================================================================
  // VUE JOUEUR : carnet immersif + submit satisfaisant
  // =====================================================================
  const maxLen = GAME_CONFIG.MAX_ANSWER_LENGTH;
  const showNotebook = stage !== 'done';

  return (
    <div
      className="flex flex-col h-full max-w-2xl mx-auto w-full px-3 md:px-4 py-3 md:py-4 gap-3"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
    >
      {/* Timer en logique seulement (affichage géré par le header du Game) */}
      <HourglassTimer
        duration={GAME_CONFIG.TIMERS.ANSWERING}
        onExpire={handleTimerExpire}
        phase={RoundPhase.ANSWERING}
        lobbyCode={lobbyCode}
        hidden
      />

      <QuestionCard question={question} card={card} subtitle={subtitle} variant="compact" />

      {showNotebook ? (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Zone saisie : carte crème bordée façon lobby */}
          <div
            className={`
              relative flex-1 flex flex-col min-h-0 rounded-2xl border-[2.5px] border-black stack-shadow
              bg-cream-player texture-paper overflow-hidden
              ${stage === 'shaking' ? 'animate-paper-shake animate-flash-warm' : ''}
            `}
            style={{ transformOrigin: 'center bottom' }}
          >
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Écris ta réponse…"
              maxLength={maxLen}
              disabled={stage !== 'idle'}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (answer.trim()) handleSubmit();
                }
              }}
              enterKeyHint="send"
              className="
                flex-1 w-full bg-transparent resize-none outline-none
                text-gray-900 text-base md:text-lg leading-relaxed
                px-4 md:px-5 py-3 md:py-4 pb-10
                placeholder:text-gray-400
              "
            />

          </div>

          {/* Bouton envoi */}
          <div className="mt-3 md:mt-4 flex items-center justify-center">
            <Button
              variant="success"
              size="lg"
              onClick={handleSubmit}
              disabled={!answer.trim() || stage !== 'idle'}
            >
              Envoyer
            </Button>
          </div>
        </div>
      ) : (
        /* État « envoyé » — récap grisé + attente */
        <div className="flex-1 flex flex-col items-center justify-center gap-3 md:gap-4 animate-phase-enter">
          <div
            className="relative max-w-md w-full rounded-2xl border-[2.5px] border-black/40 stack-shadow texture-paper bg-gray-200/70 p-5 md:p-6 opacity-75"
            style={{ transform: 'rotate(-0.8deg)' }}
          >
            <p className="text-gray-500 text-xs uppercase tracking-[0.15em] font-bold m-0 mb-2">Ta réponse</p>
            <p className="text-base md:text-lg text-gray-600 leading-relaxed break-words whitespace-pre-wrap m-0">
              {answer}
            </p>
          </div>
          <p className="text-gray-700 text-center text-sm md:text-base italic">
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
                    px-2 md:px-3 py-1 md:py-1.5 rounded-lg font-medium text-xs md:text-sm border-2 transition-all duration-300
                    ${isDisconnected
                      ? 'bg-gray-300 text-gray-500 opacity-60 border-gray-400'
                      : hasAnswered
                        ? 'bg-green-500 text-white border-black scale-105 stack-shadow-sm'
                        : 'bg-white/90 text-gray-700 border-gray-300'}
                  `}
                >
                  <span className="flex items-center gap-1.5">
                    <Avatar avatarId={player.avatarId} name={player.name} size="sm" />
                    {!isDisconnected && hasAnswered && <LuCheck className="inline" aria-hidden />}
                    <span className="max-w-[80px] md:max-w-none truncate">{player.name}</span>
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
