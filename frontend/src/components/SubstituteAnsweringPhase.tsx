import { useEffect, useRef, useState } from 'react';
import socket from '../utils/socket';
import HourglassTimer from './HourglassTimer';
import Avatar from './Avatar';
import Button from './Button';
import QuestionCard from './QuestionCard';
import { GAME_CONFIG } from '../constants/game';
import { IPlayer, RoundPhase, GameCard, GameMode } from '@onskone/shared';

interface SubstituteAnsweringPhaseProps {
  lobbyCode: string;
  question: string;
  card?: GameCard;
  currentPlayerId: string;
  players: IPlayer[];
  leaderId: string;
  substitutePlayerId: string | null | undefined;
  gameMode: GameMode;
}

const SubstituteAnsweringPhase: React.FC<SubstituteAnsweringPhaseProps> = ({
  lobbyCode,
  question,
  card,
  currentPlayerId,
  players,
  leaderId,
  substitutePlayerId,
  gameMode,
}) => {
  const leader = players.find(p => p.id === leaderId);
  const substitute = players.find(p => p.id === substitutePlayerId);
  const isPilier = currentPlayerId === leaderId;
  const isSubstitute = !!substitutePlayerId && currentPlayerId === substitutePlayerId;

  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const timerStartedRef = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => {
      if (isPilier && !timerStartedRef.current) {
        timerStartedRef.current = true;
        socket.emit('startTimer', { lobbyCode, duration: GAME_CONFIG.TIMERS.SUBSTITUTE_ANSWERING });
      }
    }, 500);
    return () => clearTimeout(t);
  }, [isPilier, lobbyCode]);

  const handleSubmit = () => {
    if (!isSubstitute || !answer.trim() || submitted) return;
    setSubmitted(true);
    socket.emit('submitSubstituteAnswer', { lobbyCode, answer: answer.trim() });
  };

  const handleTimerExpire = () => {
    if (isSubstitute && !submitted && answer.trim()) {
      setSubmitted(true);
      socket.emit('submitSubstituteAnswer', { lobbyCode, answer: answer.trim() });
    }
    if (isPilier) {
      setTimeout(() => socket.emit('timerExpired', { lobbyCode }), 500);
    }
  };

  const subtitle = leader ? `Question posée à ${leader.name}` : '';
  const maxLen = GAME_CONFIG.MAX_ANSWER_LENGTH;

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto w-full px-3 md:px-4 py-3 md:py-4 gap-3">
      <HourglassTimer
        duration={GAME_CONFIG.TIMERS.SUBSTITUTE_ANSWERING}
        onExpire={handleTimerExpire}
        phase={RoundPhase.SUBSTITUTE_ANSWERING}
        lobbyCode={lobbyCode}
        hidden
      />

      <QuestionCard question={question} card={card} subtitle={subtitle} variant="compact" />

      {isSubstitute ? (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-center gap-2 mb-2">
            {leader && <Avatar avatarId={leader.avatarId} name={leader.name} size="sm" />}
            <p className="text-sm md:text-base text-gray-800 italic m-0">
              Écris la réponse que <span className="font-bold">{leader?.name}</span> aurait donnée
            </p>
          </div>

          {submitted ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-gray-700 italic">Réponse envoyée, en attente...</p>
            </div>
          ) : (
            <>
              <div className="relative flex-1 flex flex-col min-h-0 rounded-2xl border-[2.5px] border-black stack-shadow bg-cream-player texture-paper overflow-hidden">
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder={`Écris ce que ${leader?.name ?? 'le pilier'} aurait répondu…`}
                  maxLength={maxLen}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (answer.trim()) handleSubmit();
                    }
                  }}
                  enterKeyHint="send"
                  className="flex-1 w-full bg-transparent resize-none outline-none text-gray-900 text-base md:text-lg leading-relaxed px-4 md:px-5 py-3 md:py-4 pb-10 placeholder:text-gray-400"
                />
              </div>
              <div className="mt-3 md:mt-4 flex items-center justify-center">
                <Button
                  variant="success"
                  size="lg"
                  onClick={handleSubmit}
                  disabled={!answer.trim()}
                >
                  Envoyer
                </Button>
              </div>
            </>
          )}
        </div>
      ) : isPilier ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-3">
          {substitute && <Avatar avatarId={substitute.avatarId} name={substitute.name} size="lg" />}
          <p className="text-center text-base md:text-lg text-gray-800 italic">
            <span className="font-bold">{substitute?.name ?? 'Le substitut'}</span> écrit la réponse que tu aurais donnée...
          </p>
          <p className="text-center text-xs md:text-sm text-gray-500">
            Tu devras ensuite deviner ce qu'il a écrit pour toi.
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-3">
          <p className="text-center text-base md:text-lg text-gray-800 italic">
            <span className="font-bold">{substitute?.name ?? 'Le substitut'}</span> doit écrire la réponse qu'aurait donnée <span className="font-bold">{leader?.name ?? 'le pilier'}</span>.
          </p>
          <p className="text-center text-sm text-gray-600">
            {gameMode === 'remote'
              ? 'Envoie lui des messages pour l\'aider à répondre'
              : 'Chuchote-lui dans l\'oreille et aide-le à répondre'}
          </p>
        </div>
      )}
    </div>
  );
};

export default SubstituteAnsweringPhase;
