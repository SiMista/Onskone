import { useEffect, useState, useMemo, useCallback } from 'react';
import socket from '../utils/socket';
import Timer from './Timer';
import Button from './Button';
import Avatar from './Avatar';
import { IPlayer, RoundPhase } from '@onskone/shared';
import { GAME_CONFIG } from '../constants/game';
import { isNoResponse, getDisplayText } from '../utils/answerHelpers';

interface Answer {
  id: string;
  text: string;
}

interface GuessingPhaseProps {
  lobbyCode: string;
  isLeader: boolean;
  leaderName: string;
  question: string;
  initialGuesses?: Record<string, string>;
}

const GuessingPhase: React.FC<GuessingPhaseProps> = ({ lobbyCode, isLeader, leaderName, question, initialGuesses }) => {
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [players, setPlayers] = useState<IPlayer[]>([]);
  const [guesses, setGuesses] = useState<Record<string, string>>(initialGuesses || {});
  const [draggedAnswerId, setDraggedAnswerId] = useState<string | null>(null);
  const [selectedAnswerId, setSelectedAnswerId] = useState<string | null>(null); // Pour mobile
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    socket.emit('requestShuffledAnswers', { lobbyCode });

    const startTimerTimeout = setTimeout(() => {
      if (isLeader) {
        socket.emit('startTimer', { lobbyCode, duration: GAME_CONFIG.TIMERS.GUESSING });
      }
    }, 500);

    socket.on('shuffledAnswersReceived', (data: { answers: Answer[]; players: IPlayer[] }) => {
      setAnswers(data.answers);
      setPlayers(data.players);
      setLoading(false);
    });

    socket.on('guessUpdated', (data: { answerId: string; playerId: string | null; currentGuesses: Record<string, string> }) => {
      setGuesses(data.currentGuesses);
    });

    return () => {
      clearTimeout(startTimerTimeout);
      socket.off('shuffledAnswersReceived');
      socket.off('guessUpdated');
    };
  }, [lobbyCode, isLeader]);

  const handleDragStart = (answerId: string) => {
    if (!isLeader) return;
    setDraggedAnswerId(answerId);
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

    setDraggedAnswerId(null);
  };

  // Gestion mobile: tap pour sélectionner une réponse
  const handleAnswerTap = (answerId: string) => {
    if (!isLeader) return;
    setSelectedAnswerId(selectedAnswerId === answerId ? null : answerId);
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
      alert('Vous devez attribuer toutes les réponses avant de valider!');
      return;
    }

    socket.emit('submitGuesses', { lobbyCode, guesses });
  };

  const handleTimerExpire = () => {
    if (isLeader) {
      socket.emit('timerExpired', { lobbyCode });
    }
  };

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
          <div className="animate-spin text-4xl md:text-6xl mb-4">⏳</div>
          <p className="text-base md:text-xl text-gray-800">Chargement des réponses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-2 md:p-4">
      <div className="mb-2 md:mb-4">
        <h2 className="text-lg md:text-2xl font-bold text-gray-800 mb-1 md:mb-2 text-center">
          {isLeader ? (
            <>
              <span className="md:hidden">Tapez une réponse puis un joueur</span>
              <span className="hidden md:inline">Glissez-déposez chaque réponse vers le joueur</span>
            </>
          ) : (
            `${leaderName} devine...`
          )}
        </h2>
        <div className="bg-primary-light rounded-lg px-3 py-2 mb-2 md:mb-3">
          <p className="text-sm md:text-base text-gray-800 text-center font-medium">{question}</p>
        </div>
        <Timer duration={GAME_CONFIG.TIMERS.GUESSING} onExpire={handleTimerExpire} phase={RoundPhase.GUESSING} lobbyCode={lobbyCode} />
      </div>

      {/* Layout responsive: colonnes sur desktop, empilé sur mobile */}
      <div className="flex-1 flex flex-col md:grid md:grid-cols-2 gap-2 md:gap-4 overflow-auto">
        {/* Réponses non attribuées */}
        <div className="bg-gray-100 rounded-lg p-2 md:p-4 border-2 border-gray-300 max-h-[35vh] md:max-h-none overflow-y-auto">
          <h3 className="text-base md:text-xl font-bold text-gray-800 mb-2 md:mb-4">Réponses</h3>
          <div className="space-y-2 md:space-y-3">
            {unassignedAnswers.map((answer) => {
              const noResponse = isNoResponse(answer.text);
              const isSelected = selectedAnswerId === answer.id;
              return (
                <div
                  key={answer.id}
                  draggable={isLeader}
                  onDragStart={() => handleDragStart(answer.id)}
                  onClick={() => handleAnswerTap(answer.id)}
                  className={`
                    border-2 rounded-lg p-2 md:p-4 break-words whitespace-pre-wrap
                    ${noResponse ? 'bg-gray-100 border-gray-200' : 'bg-white border-gray-300'}
                    ${isLeader ? 'cursor-pointer md:cursor-move hover:border-primary hover:bg-blue-50' : 'cursor-default'}
                    ${isSelected ? 'ring-2 ring-primary border-primary bg-blue-100' : ''}
                    transition-all duration-200
                    ${draggedAnswerId === answer.id ? 'opacity-50 scale-95' : ''}
                  `}
                >
                  <p className={`text-xs md:text-sm ${noResponse ? 'text-gray-400 italic' : 'text-gray-800'}`}>
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

            return (
              <div
                key={player.id}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(player.id)}
                onClick={() => handlePlayerTap(player.id)}
                className={`
                  bg-[#f9f4ee] rounded-lg p-2 md:p-3 flex gap-2 md:gap-3
                  border-2 shadow-[0_2px_6px_rgba(0,0,0,0.1)] transition-all border-[#ddd] hover:border-primary-dark
                  ${selectedAnswerId && isLeader && !hasAnswer ? 'cursor-pointer hover:bg-blue-100' : ''}
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
                        return (
                          <div
                            key={answer.id}
                            className={`rounded-lg p-2 md:p-3 flex justify-between items-start border-2 bg-white border-gray-300`}
                          >
                            <p className={`text-xs md:text-sm flex-1 min-w-0 break-words whitespace-pre-wrap text-gray-800`}>
                              {getDisplayText(answer.text)}
                            </p>
                            {isLeader && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveGuess(answer.id);
                                }}
                                className="ml-1 md:ml-2 text-red-500 hover:text-red-600 font-bold text-sm"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-400 rounded-lg p-2 md:p-4 text-center bg-white h-full flex items-center justify-center min-h-[40px] md:min-h-[60px]">
                      <p className="text-gray-500 text-xs md:text-sm">
                        {isLeader ? (selectedAnswerId ? 'Tapez pour assigner' : 'Déposez ici') : '—'}
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
        <div className="mt-3 md:mt-6 text-center">
          {unassignedAnswers.length > 0 && (
            <p className="text-gray-500 mb-2 text-xs md:text-sm">
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
