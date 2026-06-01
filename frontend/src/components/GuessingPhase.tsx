import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Icon } from '@iconify/react';
import socket from '../utils/socket';
import HourglassTimer from './HourglassTimer';
import Button from './Button';
import QuestionCard from './QuestionCard';
import PlayerBadge from './PlayerBadge';
import RevealedAnswerCard from './RevealedAnswerCard';
import AnswerText from './AnswerText';
import { IPlayer, RoundPhase, GameCard, GameMode, RevealResult } from '@onskone/shared';
import { getPhaseDuration } from '../constants/game';
import { isNoResponse } from '../utils/answerHelpers';
import { useStartTimerDelayed } from '../hooks';
import ScrollFade from './ScrollFade';
import { useLocale } from '../i18n';

interface Answer {
  id: string;
  text: string;
}

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
  const [draggedAnswerId, setDraggedAnswerId] = useState<string | null>(null);
  const [selectedAnswerId, setSelectedAnswerId] = useState<string | null>(null); // Pour mobile
  const [loading, setLoading] = useState(true);
  const [highlightedAnswerId, setHighlightedAnswerId] = useState<string | null>(null);
  // Cartes qui viennent d'être attribuées (leader view) : déclenche snap-bounce
  const [justAssignedAnswerId, setJustAssignedAnswerId] = useState<string | null>(null);
  const justAssignedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs pour les cartes joueurs (pour le scroll)
  const playerCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Refs des conteneurs scrollables (réponses non attribuées + liste joueurs)
  const answersScrollRef = useRef<HTMLDivElement | null>(null);
  const playersScrollRef = useRef<HTMLDivElement | null>(null);


  // Durée du timer GUESSING (120s à 3 joueurs, +20s/joueur), scalée par le
  // multiplicateur de temps du lobby. La formule de base vit dans getPhaseDuration.
  const timerDuration = useMemo(
    () => getPhaseDuration(RoundPhase.GUESSING, timeMultiplier, playerCount),
    [playerCount, timeMultiplier]
  );

  useStartTimerDelayed(isLeader, lobbyCode, timerDuration);

  // Sync guesses when initialGuesses changes (reconnection during GUESSING phase)
  useEffect(() => {
    if (initialGuesses && Object.keys(initialGuesses).length > 0) {
      setGuesses(prev => {
        // Merge: keep local changes but restore server state for missing keys
        const merged = { ...initialGuesses };
        // Local guesses take priority (user may have made changes)
        Object.keys(prev).forEach(key => {
          if (prev[key]) {
            merged[key] = prev[key];
          }
        });
        return merged;
      });
    }
  }, [initialGuesses]);

  useEffect(() => {
    socket.emit('requestShuffledAnswers', { lobbyCode });

    const onShuffledAnswersReceived = (data: { answers: Answer[]; players: IPlayer[]; roundNumber?: number }) => {
      // Ignorer les événements d'anciens rounds (race condition sur reconnexion)
      if (data.roundNumber !== undefined && data.roundNumber !== roundNumber) {
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
    };
    socket.on('shuffledAnswersReceived', onShuffledAnswersReceived);

    const onGuessUpdated = (data: { answerId: string; playerId: string | null }) => {
      setGuesses(prev => {
        const updated = { ...prev };
        if (data.playerId === null) {
          delete updated[data.answerId];
        } else {
          updated[data.answerId] = data.playerId;
        }
        return updated;
      });

      if (data.playerId && !isLeader) {
        const playerCard = playerCardRefs.current[data.playerId];
        if (playerCard) {
          playerCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        setHighlightedAnswerId(data.answerId);
        if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = setTimeout(() => setHighlightedAnswerId(null), 1500);

        // En mode remote, les spectateurs voient aussi l'animation snap-bounce
        if (gameMode === 'remote') {
          flashJustAssigned(data.answerId);
        }
      }
    };
    socket.on('guessUpdated', onGuessUpdated);

    return () => {
      // IMPORTANT: détacher uniquement NOS handlers (sinon on supprime aussi
      // les listeners du useStudioBot et de tout autre consommateur).
      socket.off('shuffledAnswersReceived', onShuffledAnswersReceived);
      socket.off('guessUpdated', onGuessUpdated);
      if (justAssignedTimeoutRef.current) clearTimeout(justAssignedTimeoutRef.current);
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    };
  }, [lobbyCode, isLeader, roundNumber]);

  const haptic = (pattern: number | number[]) => {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  };

  const flashJustAssigned = (answerId: string) => {
    setJustAssignedAnswerId(answerId);
    if (justAssignedTimeoutRef.current) clearTimeout(justAssignedTimeoutRef.current);
    justAssignedTimeoutRef.current = setTimeout(() => setJustAssignedAnswerId(null), 500);
  };

  const handleDragStart = (answerId: string) => {
    if (!isLeader) return;
    setDraggedAnswerId(answerId);
    haptic(15);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (playerId: string) => {
    if (!isLeader || !draggedAnswerId) return;

    // Vérifier si le joueur a déjà une réponse assignée
    const playerAlreadyHasAnswer = Object.values(guesses).includes(playerId);
    if (playerAlreadyHasAnswer) return;

    const newGuesses = { ...guesses, [draggedAnswerId]: playerId };
    setGuesses(newGuesses);

    socket.emit('updateGuess', {
      lobbyCode,
      answerId: draggedAnswerId,
      playerId
    });

    flashJustAssigned(draggedAnswerId);
    haptic([25, 40, 15]);
    setDraggedAnswerId(null);
  };

  // Gestion mobile: tap pour sélectionner une réponse
  const handleAnswerTap = (answerId: string) => {
    if (!isLeader) return;
    setSelectedAnswerId(selectedAnswerId === answerId ? null : answerId);
    haptic(10);
  };

  // Gestion mobile: tap sur un joueur pour assigner la réponse sélectionnée
  const handlePlayerTap = (playerId: string) => {
    if (!isLeader || !selectedAnswerId) return;

    // Vérifier si le joueur a déjà une réponse assignée
    const playerAlreadyHasAnswer = Object.values(guesses).includes(playerId);
    if (playerAlreadyHasAnswer) return;

    const newGuesses = { ...guesses, [selectedAnswerId]: playerId };
    setGuesses(newGuesses);

    socket.emit('updateGuess', {
      lobbyCode,
      answerId: selectedAnswerId,
      playerId
    });

    flashJustAssigned(selectedAnswerId);
    haptic([25, 40, 15]);
    setSelectedAnswerId(null);
  };

  const handleRemoveGuess = (answerId: string) => {
    if (!isLeader) return;

    const newGuesses = { ...guesses };
    delete newGuesses[answerId];
    setGuesses(newGuesses);

    socket.emit('updateGuess', {
      lobbyCode,
      answerId,
      playerId: null
    });
  };

  const handleSubmit = () => {
    if (!isLeader) return;

    const allAssigned = answers.every(answer => guesses[answer.id]);

    if (!allAssigned) {
      return;
    }

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
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate([120, 60, 120]);
      }
    } else if (!myAssignedAnswer) {
      lastVibratedAnswerIdRef.current = null;
    }
  }, [isLeader, myAssignedAnswer]);

  // Memoize filtered arrays to prevent unnecessary re-renders
  const unassignedAnswers = useMemo(() => {
    return answers.filter(answer => !guesses[answer.id]);
  }, [answers, guesses]);

  const getAssignedAnswers = useCallback((playerId: string) => {
    return answers.filter(answer => guesses[answer.id] === playerId);
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
          footer={
            <p className="landscape:hidden flex items-center gap-1.5 text-xs text-gray-500/80 mt-1">
              <Icon icon="mdi:phone-rotate-landscape" width={14} height={14} aria-hidden />
              {t.phases.guessing.rotateForLandscape}
            </p>
          }
        />
      </>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-[70dvh] p-2 md:p-4 overflow-hidden">
      <div className="shrink-0 mb-2 md:mb-3">
        <QuestionCard question={question} card={card} variant="compact" />
        {isLeader ? (
          <h2 className="text-sm md:text-lg font-bold text-gray-800 mt-2 md:mt-3 mb-1 md:mb-2 text-center">
            <span className="tablet:hidden">{t.phases.guessing.instructionMobile}</span>
            <span className="hidden tablet:inline">{t.phases.guessing.instructionDesktop}</span>
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

      {/* Layout responsive: colonnes sur desktop, empilé sur mobile. flex-1 min-h-0
          pour permettre aux listes internes de scroller au lieu de pousser le parent. */}
      <div className="flex-1 min-h-0 flex flex-col tablet:grid tablet:grid-cols-2 gap-2 tablet:gap-4 overflow-hidden">
        {/* Réponses non attribuées : zone bornée scrollable. En mobile portrait,
            on garde le design original (35dvh max) pour laisser la place aux
            cartes joueurs. En landscape mobile, la liste passe en 2 colonnes
            pour rester lisible quand le tel est tourné. */}
        <div className="relative bg-gray-100 rounded-lg p-2 md:p-3 border-2 border-gray-300 flex flex-col min-h-0 max-h-[35dvh] tablet:max-h-none tablet:flex-1 overflow-hidden">
          <h3 className="shrink-0 text-sm md:text-base font-bold text-gray-800 mb-1.5 md:mb-2 m-0 uppercase tracking-wider">{t.phases.guessing.answers}</h3>
          <div ref={answersScrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain no-scrollbar space-y-1.5 md:space-y-2 landscape-2col pr-1 md:pr-2">
            {unassignedAnswers.map((answer, i) => {
              const noResponse = isNoResponse(answer.text);
              const isSelected = selectedAnswerId === answer.id;
              const isDragging = draggedAnswerId === answer.id;
              return (
                <div
                  key={answer.id}
                  draggable={isLeader}
                  onDragStart={() => handleDragStart(answer.id)}
                  onDragEnd={() => setDraggedAnswerId(null)}
                  onClick={() => handleAnswerTap(answer.id)}
                  className={`
                    relative border rounded-lg px-2.5 md:px-3 py-1.5 md:py-2 break-words whitespace-pre-wrap
                    animate-answer-drop-in
                    ${noResponse ? 'bg-gray-100 border-gray-300' : isSelected ? 'bg-warning-100 border-black' : 'bg-white border-black stack-shadow-sm texture-paper'}
                    ${isLeader ? 'cursor-pointer md:cursor-grab active:cursor-grabbing select-none' : 'cursor-default'}
                    ${isSelected ? 'ring-[3px] ring-inset ring-warning-500 stack-shadow' : ''}
                    ${isDragging ? 'card-dragging' : ''}
                    transition-all duration-200
                  `}
                  style={{ animationDelay: `${Math.min(i, 8) * 70}ms` }}
                >
                  <AnswerText
                    text={answer.text}
                    className="text-xs md:text-sm m-0"
                    normalClass="text-gray-900"
                  />
                </div>
              );
            })}
            {unassignedAnswers.length === 0 && (
              <p className="text-gray-500 text-center py-4 md:py-8 text-sm">
                {t.phases.guessing.allAssigned}
              </p>
            )}
          </div>
          <ScrollFade scrollRef={answersScrollRef} className="rounded-b-lg" />
        </div>

        {/* Joueurs avec leurs réponses attribuées - alignés en haut, scroll
            interne si la liste déborde. Fade blanc en bas comme indice "il
            reste du contenu à scroller". */}
        <div className="relative flex-1 min-h-0">
        <div
          ref={playersScrollRef}
          className="absolute inset-0 overflow-y-auto overscroll-contain no-scrollbar px-2 py-1"
        >
        <div className="flex flex-col space-y-2 md:space-y-3">
          {players.map((player) => {
            const assignedAnswers = getAssignedAnswers(player.id);
            const hasAnswer = assignedAnswers.length > 0;
            // Target éligible : un answer est en cours de drag ou sélectionné, et ce joueur n'a pas encore de réponse
            const isActiveAnswerChoice = !!(draggedAnswerId || selectedAnswerId);
            const isEligibleTarget = isLeader && isActiveAnswerChoice && !hasAnswer;

            return (
              <div
                key={player.id}
                ref={(el) => { playerCardRefs.current[player.id] = el; }}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(player.id)}
                onClick={() => handlePlayerTap(player.id)}
                className={`
                  relative bg-cream-player rounded-xl p-2 md:p-3 flex gap-2 md:gap-3
                  border border-black stack-shadow-sm texture-paper transition-transform duration-200
                  ${isEligibleTarget ? 'animate-target-magnetic cursor-pointer' : ''}
                  ${hasAnswer && isActiveAnswerChoice ? 'opacity-60' : ''}
                `}
              >
                {/* Avatar et nom */}
                <div className="flex items-center justify-center min-w-[50px] md:min-w-[70px]">
                  <PlayerBadge player={player} size="sm" className="md:hidden !min-w-[50px]" />
                </div>

                {/* Zone de réponse */}
                <div className="flex-1 min-w-0">
                  {hasAnswer ? (
                    <div className="space-y-1 md:space-y-2">
                      {assignedAnswers.map((answer) => {
                        const noResponse = isNoResponse(answer.text);
                        const isHighlighted = highlightedAnswerId === answer.id;
                        const isJustAssigned = justAssignedAnswerId === answer.id;
                        return (
                          <div
                            key={answer.id}
                            className={`rounded-lg p-2 md:p-3 flex justify-between items-start border ${noResponse ? 'bg-gray-100 border-gray-200' : 'bg-white border-gray-300'} ${isHighlighted ? 'animate-halo-pulse' : ''} ${isJustAssigned ? 'animate-snap-bounce' : ''}`}
                          >
                            <AnswerText
                              text={answer.text}
                              className="text-xs md:text-sm flex-1 min-w-0 break-words whitespace-pre-wrap"
                              normalClass="text-gray-800"
                            />
                            {isLeader && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveGuess(answer.id);
                                }}
                                className="ml-1.5 md:ml-2 shrink-0 flex items-center justify-center group"
                                aria-label={t.phases.guessing.removeAria}
                              >
                                <svg
                                  width="22"
                                  height="22"
                                  viewBox="0 0 24 24"
                                  className="transition-transform group-active:translate-x-[1px] group-active:translate-y-[1px]"
                                >
                                  {/* Bordure noire (tracée en premier, plus épaisse) */}
                                  <path
                                    d="M6 6 L18 18 M18 6 L6 18"
                                    stroke="black"
                                    strokeWidth="7"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    fill="none"
                                  />
                                  {/* Croix rouge par-dessus */}
                                  <path
                                    d="M6 6 L18 18 M18 6 L6 18"
                                    stroke="var(--color-danger-500)"
                                    strokeWidth="3.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    fill="none"
                                  />
                                </svg>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-400 rounded-lg p-2 md:p-4 text-center bg-white h-full flex items-center justify-center min-h-[40px] md:min-h-[60px]">
                      <p className="text-gray-500 text-xs md:text-sm">
                        {isLeader ? (selectedAnswerId ? t.phases.guessing.dropHere : t.phases.guessing.tapToAssign) : '…'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        </div>
        <ScrollFade scrollRef={playersScrollRef} />
        </div>
      </div>

      {isLeader && (
        <div
          className="shrink-0 mt-2 md:mt-6 text-center"
        >
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
