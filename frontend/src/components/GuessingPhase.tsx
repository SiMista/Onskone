import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Icon } from '@iconify/react';
import { LuX } from 'react-icons/lu';
import socket from '../utils/socket';
import HourglassTimer from './HourglassTimer';
import Button from './Button';
import Avatar from './Avatar';
import QuestionCard from './QuestionCard';
import PlayerAnswerCard from './PlayerAnswerCard';
import ShowScreenFrame from './ShowScreenFrame';
import { IPlayer, RoundPhase, GameCard } from '@onskone/shared';
import { isNoResponse, getDisplayText } from '../utils/answerHelpers';

interface Answer {
  id: string;
  text: string;
}

interface GuessingPhaseProps {
  lobbyCode: string;
  isLeader: boolean;
  leaderName: string;
  currentPlayerId: string;
  question: string;
  card?: GameCard;
  initialGuesses?: Record<string, string>;
  playerCount: number; // Nombre total de joueurs (pour calculer la durée du timer)
  roundNumber: number; // Numéro du round actuel (pour éviter les race conditions)
}

const GuessingPhase: React.FC<GuessingPhaseProps> = ({ lobbyCode, isLeader, leaderName, currentPlayerId, question, card, initialGuesses, playerCount, roundNumber }) => {
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

  // Refs pour les cartes joueurs (pour le scroll)
  const playerCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  // Ref pour éviter de démarrer le timer plusieurs fois (React Strict Mode, re-renders)
  const timerStartedRef = useRef(false);

  // Calculer la durée du timer: 120s pour 3 joueurs, +20s par joueur supplémentaire
  const timerDuration = useMemo(() => {
    const baseTime = 120; // 3 joueurs = 120s
    const extraTimePerPlayer = 20;
    return baseTime + Math.max(0, playerCount - 3) * extraTimePerPlayer;
  }, [playerCount]);

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

    const startTimerTimeout = setTimeout(() => {
      // Vérifier si on n'a pas déjà démarré le timer pour éviter les doublons
      if (isLeader && !timerStartedRef.current) {
        timerStartedRef.current = true;
        socket.emit('startTimer', { lobbyCode, duration: timerDuration });
      }
    }, 500);

    socket.on('shuffledAnswersReceived', (data: { answers: Answer[]; players: IPlayer[]; roundNumber?: number }) => {
      // Ignorer les événements d'anciens rounds (race condition sur reconnexion)
      if (data.roundNumber !== undefined && data.roundNumber !== roundNumber) {
        console.log(`Ignoring stale shuffledAnswersReceived for round ${data.roundNumber}, current is ${roundNumber}`);
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

    socket.on('guessUpdated', (data: { answerId: string; playerId: string | null }) => {
      // Mise à jour locale basée sur le delta (économie de bande passante)
      setGuesses(prev => {
        const updated = { ...prev };
        if (data.playerId === null) {
          delete updated[data.answerId];
        } else {
          updated[data.answerId] = data.playerId;
        }
        return updated;
      });

      // Scroll et animation halo quand une réponse est assignée (seulement pour les non-piliers)
      if (data.playerId && !isLeader) {
        // Scroll vers la carte du joueur
        const playerCard = playerCardRefs.current[data.playerId];
        if (playerCard) {
          playerCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // Déclencher l'animation halo sur la zone de réponse
        setHighlightedAnswerId(data.answerId);
        setTimeout(() => {
          setHighlightedAnswerId(null);
        }, 1500); // Durée de l'animation
      }
    });

    return () => {
      clearTimeout(startTimerTimeout);
      socket.off('shuffledAnswersReceived');
      socket.off('guessUpdated');
      if (justAssignedTimeoutRef.current) clearTimeout(justAssignedTimeoutRef.current);
    };
  }, [lobbyCode, isLeader, timerDuration, roundNumber]);

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
          <p className="text-base md:text-xl text-gray-800">Chargement des réponses...</p>
        </div>
      </div>
    );
  }

  // ============================================================
  // VUE JOUEUR (non-pilier) — seule la réponse attribuée est affichée
  // ============================================================
  if (!isLeader) {
    const assignedText = myAssignedAnswer ? getDisplayText(myAssignedAnswer.text) : '';
    const noResponse = myAssignedAnswer ? isNoResponse(myAssignedAnswer.text) : false;

    return (
      <div className="flex flex-col h-full p-2 max-w-2xl mx-auto">
        <HourglassTimer
          duration={timerDuration}
          onExpire={handleTimerExpire}
          phase={RoundPhase.GUESSING}
          lobbyCode={lobbyCode}
          hidden
        />

        <div className="flex-1 flex flex-col items-center justify-center gap-4 md:gap-6 px-2">
          <ShowScreenFrame>
            {myAssignedAnswer ? (
              <PlayerAnswerCard
                key={myAssignedAnswer.id}
                answer={assignedText}
                isNoResponse={noResponse}
                pulse
                heading={null}
              />
            ) : (
              <PlayerAnswerCard
                answer={`En attente que ${leaderName} t'attribue une réponse…`}
                placeholder
                heading={null}
              />
            )}
          </ShowScreenFrame>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-2 md:p-4">
      <div className="mb-2 md:mb-3">
        <QuestionCard question={question} card={card} variant="compact" />
        {isLeader && (
          <h2 className="text-sm md:text-lg font-bold text-gray-800 mt-2 md:mt-3 mb-1 md:mb-2 text-center">
            <span className="md:hidden">Tapez une réponse puis un joueur</span>
            <span className="hidden md:inline">Glissez chaque réponse vers son auteur présumé</span>
          </h2>
        )}
        <HourglassTimer
          duration={timerDuration}
          onExpire={handleTimerExpire}
          phase={RoundPhase.GUESSING}
          lobbyCode={lobbyCode}
          hidden
        />
      </div>

      {/* Layout responsive: colonnes sur desktop, empilé sur mobile */}
      <div className="flex-1 flex flex-col md:grid md:grid-cols-2 gap-2 md:gap-4 overflow-auto">
        {/* Réponses non attribuées */}
        <div className="bg-gray-100 rounded-lg p-2 md:p-3 border-2 border-gray-300 max-h-[35vh] md:max-h-none overflow-y-auto">
          <h3 className="text-sm md:text-base font-bold text-gray-800 mb-1.5 md:mb-2 m-0 uppercase tracking-wider">Réponses</h3>
          <div className="space-y-1.5 md:space-y-2 pr-1 md:pr-2">
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
                    ${noResponse ? 'bg-gray-100 border-gray-300' : isSelected ? 'bg-[#FFF3C4] border-black' : 'bg-white border-black stack-shadow-sm texture-paper'}
                    ${isLeader ? 'cursor-pointer md:cursor-grab active:cursor-grabbing select-none' : 'cursor-default'}
                    ${isSelected ? 'scale-[1.02] ring-4 ring-[#FFE680]/60 stack-shadow translate-x-1 -translate-y-1' : ''}
                    ${isDragging ? 'card-dragging' : ''}
                    transition-all duration-200
                  `}
                  style={{ animationDelay: `${Math.min(i, 8) * 70}ms` }}
                >
                  <p className={`text-xs md:text-sm m-0 ${noResponse ? 'text-gray-400 italic' : 'text-gray-900'}`}>
                    {getDisplayText(answer.text)}
                  </p>
                </div>
              );
            })}
            {unassignedAnswers.length === 0 && (
              <p className="text-gray-500 text-center py-4 md:py-8 text-sm">
                Toutes les réponses ont été attribuées
              </p>
            )}
          </div>
        </div>

        {/* Joueurs avec leurs réponses attribuées */}
        <div className="space-y-2 md:space-y-3 overflow-auto flex-1">
          {players.map((player) => {
            const assignedAnswers = getAssignedAnswers(player.id);
            const hasAnswer = assignedAnswers.length > 0;
            const displayName = player.name.length > 8
              ? player.name.substring(0, 8) + '...'
              : player.name;
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
                <div className="flex flex-col items-center justify-center min-w-[50px] md:min-w-[70px]">
                  <Avatar avatarId={player.avatarId} name={player.name} size="sm" className="md:hidden" />
                  <Avatar avatarId={player.avatarId} name={player.name} size="md" className="hidden md:block" />
                  <span className="text-[10px] md:text-xs font-semibold text-gray-700 mt-1 text-center">
                    {displayName}
                  </span>
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
                            <p className={`text-xs md:text-sm flex-1 min-w-0 break-words whitespace-pre-wrap ${noResponse ? 'text-gray-400 italic' : 'text-gray-800'}`}>
                              {getDisplayText(answer.text)}
                            </p>
                            {isLeader && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveGuess(answer.id);
                                }}
                                className="ml-1 md:ml-2 text-red-500 hover:text-red-600 font-bold text-sm inline-flex items-center"
                                aria-label="Retirer"
                              >
                                <LuX size={14} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-400 rounded-lg p-2 md:p-4 text-center bg-white h-full flex items-center justify-center min-h-[40px] md:min-h-[60px]">
                      <p className="text-gray-500 text-xs md:text-sm">
                        {isLeader ? (selectedAnswerId ? 'Déposez ici' : 'Tapez pour assigner') : '—'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {isLeader && (
        <div
          className="mt-3 md:mt-6 text-center"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          {unassignedAnswers.length > 0 && (
            <p className="mb-2 text-xs md:text-sm font-medium text-gray-500">
              Il reste {unassignedAnswers.length} réponse(s) à attribuer
            </p>
          )}
          <Button
            variant="success"
            size="lg"
            onClick={handleSubmit}
            disabled={unassignedAnswers.length > 0}
          >
            Valider mes choix
          </Button>
        </div>
      )}
    </div>
  );
};

export default GuessingPhase;
