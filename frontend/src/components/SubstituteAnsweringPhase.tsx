import { useEffect, useRef, useState } from 'react';
import HourglassTimer from './HourglassTimer';
import Avatar from './Avatar';
import QuestionCard from './QuestionCard';
import QuestionByline from './QuestionByline';
import PlayerBadge from './PlayerBadge';
import NotebookInput from './NotebookInput';
import { GAME_CONFIG, getPhaseDuration } from '../constants/game';
import { IPlayer, RoundPhase, GameCard, GameMode } from '@onskone/shared';
import { useStartTimerDelayed } from '../hooks';
import socket from '../utils/socket';
import { useLocale } from '../i18n';

const SubstituteAnsweringPhase = ({
  lobbyCode,
  question,
  card,
  currentPlayerId,
  players,
  leaderId,
  substitutePlayerId,
  gameMode,
  timeMultiplier,
}: {
  lobbyCode: string;
  question: string;
  card?: GameCard;
  currentPlayerId: string;
  players: IPlayer[];
  leaderId: string;
  substitutePlayerId: string | null | undefined;
  gameMode: GameMode;
  timeMultiplier: number;
}) => {
  const { t } = useLocale();
  const leader = players.find(p => p.id === leaderId);
  const substitute = players.find(p => p.id === substitutePlayerId);
  const isPilier = currentPlayerId === leaderId;
  const isSubstitute = !!substitutePlayerId && currentPlayerId === substitutePlayerId;

  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const expireTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const phaseDuration = getPhaseDuration(RoundPhase.SUBSTITUTE_ANSWERING, timeMultiplier);
  useStartTimerDelayed(isPilier, lobbyCode, phaseDuration);

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

  const maxLen = GAME_CONFIG.MAX_ANSWER_LENGTH;

  return (
    <div className={`flex flex-col h-full max-w-2xl mx-auto w-full px-3 md:px-4 py-3 md:py-4 gap-3 overflow-hidden ${isSubstitute && !submitted ? 'min-h-[70dvh]' : ''}`}>
      <HourglassTimer
        duration={phaseDuration}
        onExpire={handleTimerExpire}
        phase={RoundPhase.SUBSTITUTE_ANSWERING}
        lobbyCode={lobbyCode}
        hidden
      />

      <QuestionByline player={leader} />

      <QuestionCard question={question} card={card} variant="compact" />

      {isSubstitute ? (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-center flex-wrap gap-x-2 gap-y-3 mt-7 md:mt-9 mb-7 md:mb-9 text-sm md:text-base text-gray-800">
            <span>{t.phases.substituteAnswering.writePrefix}</span>
            <Avatar avatarId={leader?.avatarId ?? 0} name={leader?.name} size="sm" />
            <span className="font-semibold text-gray-900">{leader?.name ?? t.phases.substituteAnswering.leaderFallback}</span>
            <span>{t.phases.substituteAnswering.writeSuffix}</span>
          </div>

          {submitted ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-gray-700 italic">{t.phases.substituteAnswering.sentWaiting}</p>
            </div>
          ) : (
            <NotebookInput
              value={answer}
              onChange={setAnswer}
              onSubmit={handleSubmit}
              placeholder={t.phases.substituteAnswering.placeholder(leader?.name ?? t.phases.substituteAnswering.leaderFallback)}
              maxLength={maxLen}
              submitLabel={t.phases.substituteAnswering.send}
            />
          )}
        </div>
      ) : isPilier ? (
        <div className="flex-1 flex flex-col items-center px-3 pt-3 md:pt-16">
          <PlayerBadge player={substitute} fallbackName={t.phases.substituteAnswering.substituteFallback} />
          <p className="mt-1 md:mt-3 text-center text-base md:text-lg text-gray-800">
            {t.phases.substituteAnswering.pilierWaiting}
          </p>
          <p className="mt-6 md:mt-8 text-center text-xs md:text-sm text-gray-500 italic">
            {t.phases.substituteAnswering.thenGuess}
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 md:gap-8 px-3">
          <div className="flex items-center justify-center flex-wrap gap-x-3 gap-y-4 mt-6 md:mt-8">
            <PlayerBadge player={substitute} fallbackName={t.phases.substituteAnswering.substituteFallback} size="sm" />
            <span className="text-sm md:text-base text-gray-800 italic">{t.phases.substituteAnswering.writingAnswerOf}</span>
            <PlayerBadge player={leader} fallbackName={t.phases.substituteAnswering.leaderFallback} size="sm" />
          </div>
          <p className="text-center text-sm text-gray-600 italic">
            {gameMode === 'remote'
              ? t.phases.substituteAnswering.remoteHelp
              : t.phases.substituteAnswering.localHelp}
          </p>
        </div>
      )}
    </div>
  );
};

export default SubstituteAnsweringPhase;
