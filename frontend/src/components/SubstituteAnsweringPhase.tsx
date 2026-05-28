import { useEffect, useRef, useState } from 'react';
import socket from '../utils/socket';
import HourglassTimer from './HourglassTimer';
import Avatar from './Avatar';
import Button from './Button';
import QuestionCard from './QuestionCard';
import QuestionByline from './QuestionByline';
import PlayerBadge from './PlayerBadge';
import { GAME_CONFIG } from '../constants/game';
import { IPlayer, RoundPhase, GameCard, GameMode } from '@onskone/shared';
import { useStartTimerDelayed } from '../hooks';

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
  const expireTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useStartTimerDelayed(isPilier, lobbyCode, GAME_CONFIG.TIMERS.SUBSTITUTE_ANSWERING);

  useEffect(() => {
    return () => {
      if (expireTimeoutRef.current) clearTimeout(expireTimeoutRef.current);
    };
  }, []);

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
      if (expireTimeoutRef.current) clearTimeout(expireTimeoutRef.current);
      expireTimeoutRef.current = setTimeout(() => socket.emit('timerExpired', { lobbyCode }), 500);
    }
  };

  const subtitle = '';
  const subtitleBadge = undefined;
  const maxLen = GAME_CONFIG.MAX_ANSWER_LENGTH;

  return (
    <div className={`flex flex-col h-full max-w-2xl mx-auto w-full px-3 md:px-4 py-3 md:py-4 gap-3 overflow-hidden ${isSubstitute && !submitted ? 'min-h-[70dvh]' : ''}`}>
      <HourglassTimer
        duration={GAME_CONFIG.TIMERS.SUBSTITUTE_ANSWERING}
        onExpire={handleTimerExpire}
        phase={RoundPhase.SUBSTITUTE_ANSWERING}
        lobbyCode={lobbyCode}
        hidden
      />

      <QuestionByline player={leader} />

      <QuestionCard question={question} card={card} subtitle={subtitle} subtitleBadge={subtitleBadge} variant="compact" />

      {isSubstitute ? (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-center flex-wrap gap-x-2 gap-y-3 mt-7 md:mt-9 mb-7 md:mb-9 text-sm md:text-base text-gray-800">
            <span>Écris la réponse que</span>
            <Avatar avatarId={leader?.avatarId ?? 0} name={leader?.name} size="sm" />
            <span className="font-semibold text-gray-900">{leader?.name ?? 'le pilier'}</span>
            <span>aurait donnée</span>
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
        <div className="flex-1 flex flex-col items-center px-3 pt-3 md:pt-16">
          <PlayerBadge player={substitute} fallbackName="Le substitut" />
          <p className="mt-1 md:mt-3 text-center text-base md:text-lg text-gray-800">
            écrit la réponse que tu aurais donnée...
          </p>
          <p className="mt-6 md:mt-8 text-center text-xs md:text-sm text-gray-500 italic">
            Tu devras ensuite deviner ce qu'il a écrit pour toi.
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 md:gap-8 px-3">
          <div className="flex items-center justify-center flex-wrap gap-x-3 gap-y-4 mt-6 md:mt-8">
            <PlayerBadge player={substitute} fallbackName="Le substitut" size="sm" />
            <span className="text-sm md:text-base text-gray-800 italic">écrit la réponse de</span>
            <PlayerBadge player={leader} fallbackName="le pilier" size="sm" />
          </div>
          <p className="text-center text-sm text-gray-600 italic">
            {gameMode === 'remote'
              ? 'Envoie lui des messages privés pour l\'aider à répondre'
              : 'Chuchote-lui dans l\'oreille et aide-le à répondre'}
          </p>
        </div>
      )}
    </div>
  );
};

export default SubstituteAnsweringPhase;
