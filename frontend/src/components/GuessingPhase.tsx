import { useEffect, useState, useMemo, useRef } from 'react';
import { Icon } from '@iconify/react';
import HourglassTimer from './HourglassTimer';
import Button from './Button';
import QuestionCard from './QuestionCard';
import PlayerBadge from './PlayerBadge';
import RevealedAnswerCard from './RevealedAnswerCard';
import AnswerText from './AnswerText';
import Avatar from './Avatar';
import Dropdown from './Dropdown';
import { IPlayer, RoundPhase, GameCard, GameMode, RevealResult } from '@onskone/shared';
import { getPhaseDuration } from '../constants/game';
import { isNoResponse } from '../utils/answerHelpers';
import { useStartTimerDelayed, useSocketEvent } from '../hooks';
import socket from '../utils/socket';
import { useLocale } from '../i18n';
import { hapticLight, hapticAssigned } from '../utils/haptics';

interface Answer {
  id: string;
  text: string;
}

// Valeur sentinelle du dropdown pour retirer l'attribution (Dropdown ne renvoie qu'une string).
const CLEAR = '__CLEAR__';

const GuessingPhase = ({ lobbyCode, isLeader, leader, currentPlayerId, question, card, initialGuesses, playerCount, roundNumber, gameMode, timeMultiplier }: {
  lobbyCode: string;
  isLeader: boolean;
  leader: IPlayer;
  currentPlayerId: string;
  question: string;
  card?: GameCard;
  initialGuesses?: Record<string, string>;
  playerCount: number;
  roundNumber: number;
  gameMode: GameMode;
  timeMultiplier: number;
}) => {
  const { t } = useLocale();
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [players, setPlayers] = useState<IPlayer[]>([]);
  const [guesses, setGuesses] = useState<Record<string, string>>(initialGuesses || {});
  const [loading, setLoading] = useState(true);
  const [highlightedAnswerId, setHighlightedAnswerId] = useState<string | null>(null);
  // Cartes qui viennent d'être attribuées : déclenche snap-bounce
  const [justAssignedAnswerId, setJustAssignedAnswerId] = useState<string | null>(null);
  const justAssignedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Durée du timer GUESSING (120s à 3 joueurs, +20s/joueur), scalée par le
  // multiplicateur de temps du lobby. La formule de base vit dans getPhaseDuration.
  const timerDuration = useMemo(
    () => getPhaseDuration(RoundPhase.GUESSING, timeMultiplier, playerCount),
    [playerCount, timeMultiplier]
  );

  useStartTimerDelayed(isLeader, lobbyCode, timerDuration);

  // Resynchronise les attributions quand initialGuesses change (reconnexion en phase GUESSING)
  useEffect(() => {
    if (initialGuesses && Object.keys(initialGuesses).length > 0) {
      setGuesses(prev => {
        // Fusion : on repart de l'état serveur mais les attributions locales priment
        // (le joueur a pu en faire de nouvelles avant la resynchro)
        const merged = { ...initialGuesses };
        Object.keys(prev).forEach(key => {
          if (prev[key]) {
            merged[key] = prev[key];
          }
        });
        return merged;
      });
    }
  }, [initialGuesses]);

  const flashJustAssigned = (answerId: string) => {
    setJustAssignedAnswerId(answerId);
    if (justAssignedTimeoutRef.current) clearTimeout(justAssignedTimeoutRef.current);
    justAssignedTimeoutRef.current = setTimeout(() => setJustAssignedAnswerId(null), 500);
  };

  // Demander les réponses mélangées à l'entrée dans la phase, et nettoyer les
  // timeouts d'animation au démontage.
  useEffect(() => {
    socket.emit('requestShuffledAnswers', { lobbyCode });
    return () => {
      if (justAssignedTimeoutRef.current) clearTimeout(justAssignedTimeoutRef.current);
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    };
  }, [lobbyCode]);

  useSocketEvent('shuffledAnswersReceived', (data) => {
    // Ignorer les événements d'anciens rounds (race condition sur reconnexion)
    if (data.roundNumber !== roundNumber) {
      return;
    }

    setAnswers(data.answers);
    setPlayers(data.players);

    // Auto-assigner les réponses NO_RESPONSE aux joueurs correspondants
    const autoGuesses: Record<string, string> = {};
    data.answers.forEach(answer => {
      if (isNoResponse(answer.text)) {
        // answer.id est le playerId, on l'auto-assigne
        autoGuesses[answer.id] = answer.id;
      }
    });
    if (Object.keys(autoGuesses).length > 0) {
      setGuesses(prev => ({ ...prev, ...autoGuesses }));
    }

    setLoading(false);
  });

  useSocketEvent('guessUpdated', (data) => {
    setGuesses(prev => {
      const updated = { ...prev };
      if (data.playerId === null) {
        delete updated[data.answerId];
      } else {
        updated[data.answerId] = data.playerId;
      }
      return updated;
    });

    // Spectateurs (mode remote) : feedback visuel quand le pilier attribue
    if (data.playerId && !isLeader) {
      setHighlightedAnswerId(data.answerId);
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = setTimeout(() => setHighlightedAnswerId(null), 1500);
      flashJustAssigned(data.answerId);
    }
  });

  // Attribue (ou retire si playerId === null) une réponse à un joueur, puis sync serveur.
  const handleAssign = (answerId: string, playerId: string | null) => {
    if (!isLeader) return;

    setGuesses(prev => {
      const updated = { ...prev };
      if (playerId === null) {
        delete updated[answerId];
      } else {
        updated[answerId] = playerId;
      }
      return updated;
    });

    socket.emit('updateGuess', { lobbyCode, answerId, playerId });

    if (playerId) {
      flashJustAssigned(answerId);
      hapticAssigned();
    } else {
      hapticLight();
    }
  };

  const handleSubmit = () => {
    if (!isLeader) return;
    const allAssigned = answers.every(answer => guesses[answer.id]);
    if (!allAssigned) return;
    socket.emit('submitGuesses', { lobbyCode, guesses });
  };

  const handleTimerExpire = () => {
    if (isLeader) {
      socket.emit('timerExpired', { lobbyCode });
    }
  };

  // Trouver la réponse attribuée au joueur courant (pour la vue non-pilier)
  const myAssignedAnswer = useMemo(() => {
    if (isLeader) return null;
    const myAnswerId = Object.keys(guesses).find(answerId => guesses[answerId] === currentPlayerId);
    if (!myAnswerId) return null;
    return answers.find(a => a.id === myAnswerId) || null;
  }, [isLeader, guesses, currentPlayerId, answers]);

  // Vibration lorsque le joueur reçoit (ou change) une réponse attribuée
  const lastVibratedAnswerIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (isLeader) return;
    if (myAssignedAnswer && myAssignedAnswer.id !== lastVibratedAnswerIdRef.current) {
      lastVibratedAnswerIdRef.current = myAssignedAnswer.id;
      hapticAssigned();
    } else if (!myAssignedAnswer) {
      lastVibratedAnswerIdRef.current = null;
    }
  }, [isLeader, myAssignedAnswer]);

  // Joueurs déjà attribués à une réponse (pour les retirer des autres dropdowns)
  const assignedPlayerIds = useMemo(() => new Set(Object.values(guesses)), [guesses]);

  const unassignedAnswers = useMemo(() => {
    return answers.filter(answer => !guesses[answer.id]);
  }, [answers, guesses]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Icon icon="fluent-emoji-flat:hourglass-not-done" className="animate-spin text-4xl md:text-6xl mb-4" width="1em" height="1em" aria-hidden />
          <p className="text-base md:text-xl text-gray-800">{t.phases.guessing.loading}</p>
        </div>
      </div>
    );
  }

  // ============================================================
  // VUE JOUEUR (non-pilier, mode local)
  // ============================================================
  // On délègue toujours le rendu à RevealedAnswerCard avec revealed=false pour
  // garder une structure identique entre "en attente d'attribution", "attribué"
  // et la phase REVEAL qui suit. Le seul élément qui change c'est le texte de la
  // carte (message d'attente vs réponse réelle), évitant tout jump de layout.
  if (!isLeader && gameMode === 'local') {
    const result: RevealResult = {
      playerId: '',
      playerName: '',
      playerAvatarId: 0,
      answer: myAssignedAnswer?.text ?? '',
      guessedPlayerId: '',
      guessedPlayerName: '',
      guessedPlayerAvatarId: 0,
      correct: false,
    };
    return (
      <>
        <HourglassTimer
          duration={timerDuration}
          onExpire={handleTimerExpire}
          phase={RoundPhase.GUESSING}
          lobbyCode={lobbyCode}
          hidden
        />
        <RevealedAnswerCard
          key={myAssignedAnswer?.id ?? 'waiting'}
          result={result}
          revealed={false}
          correct={false}
          showBubble={false}
          cardClassName={myAssignedAnswer ? 'animate-card-receive' : ''}
          waitingFor={myAssignedAnswer ? undefined : { name: leader?.name ?? t.phases.guessing.leaderFallback, avatarId: leader?.avatarId ?? 0 }}
        />
      </>
    );
  }

  // ============================================================
  // VUE PILIER (et spectateur mode remote)
  // ============================================================
  return (
    <div className="flex flex-col h-full min-h-0 p-2 md:p-4 overflow-hidden max-w-xl mx-auto w-full">
      <div className="shrink-0 mb-2 md:mb-3">
        <QuestionCard question={question} card={card} variant="compact" />
        {isLeader ? (
          <h2 className="text-sm md:text-lg font-bold text-gray-800 mt-2 md:mt-3 mb-1 md:mb-2 text-center">
            {t.phases.guessing.instruction}
          </h2>
        ) : (
          <div className="flex flex-col items-center gap-1 mt-1.5">
            <PlayerBadge player={leader} size="sm" />
            <p className="text-xs text-center text-gray-500 italic">{t.phases.guessing.assignWaiting}</p>
          </div>
        )}
        <HourglassTimer
          duration={timerDuration}
          onExpire={handleTimerExpire}
          phase={RoundPhase.GUESSING}
          lobbyCode={lobbyCode}
          hidden
        />
      </div>

      {/* Liste verticale unique : une carte par réponse, chacune avec son dropdown joueurs. */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain no-scrollbar space-y-2 md:space-y-3 pr-1">
        {answers.map((answer) => {
          const noResponse = isNoResponse(answer.text);
          const currentId = guesses[answer.id] ?? '';
          const isHighlighted = highlightedAnswerId === answer.id;
          const isJustAssigned = justAssignedAnswerId === answer.id;

          // Options : joueurs restants + le joueur actuel de cette réponse, puis "Retirer".
          const options = players
            .filter(p => !assignedPlayerIds.has(p.id) || p.id === currentId)
            .map(p => ({
              value: p.id,
              label: p.name,
              prefix: <Avatar avatarId={p.avatarId} name={p.name} size="sm" />,
            }));
          if (currentId) {
            options.push({
              value: CLEAR,
              label: t.phases.guessing.removeOption,
              prefix: <Icon icon="lucide:x" width={20} height={20} className="text-danger-500" aria-hidden />,
            });
          }

          return (
            <div
              key={answer.id}
              className={`
                rounded-xl p-2.5 md:p-3 space-y-2 border border-black stack-shadow-sm texture-paper
                ${noResponse ? 'bg-gray-100 border-gray-300' : 'bg-cream-answer'}
                ${isHighlighted ? 'animate-halo-pulse' : ''}
                ${isJustAssigned ? 'animate-snap-bounce' : ''}
              `}
            >
              <AnswerText
                text={answer.text}
                className="text-sm md:text-base break-words whitespace-pre-wrap"
                normalClass="text-gray-900"
              />
              <Dropdown
                value={currentId}
                onChange={(v) => handleAssign(answer.id, v === CLEAR ? null : v)}
                options={options}
                placeholder={t.phases.guessing.choosePlayer}
                disabled={!isLeader || noResponse}
              />
            </div>
          );
        })}
      </div>

      {isLeader && (
        <div className="shrink-0 mt-2 md:mt-6 text-center">
          {unassignedAnswers.length > 0 && (
            <p className="mb-2 text-xs md:text-sm font-medium text-gray-500">
              {t.phases.guessing.remainingCount(unassignedAnswers.length)}
            </p>
          )}
          <Button
            variant="success"
            size="lg"
            onClick={handleSubmit}
            disabled={unassignedAnswers.length > 0}
          >
            {t.phases.guessing.validate}
          </Button>
        </div>
      )}
    </div>
  );
};

export default GuessingPhase;
