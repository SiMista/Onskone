import React, { useEffect, useState } from 'react';
import socket from '../utils/socket';
import Timer from './Timer';
import Button from './Button';
import Avatar from './Avatar';
import { IPlayer, RoundPhase } from '@onskone/shared';
import { GAME_CONFIG } from '../constants/game';

interface Answer {
  id: string; // playerId de l'auteur
  text: string;
}

const NO_RESPONSE_PREFIX = '__NO_RESPONSE__';

// Vérifie si une réponse est une "non-réponse" automatique
const isNoResponse = (text: string): boolean => {
  return text.startsWith(NO_RESPONSE_PREFIX);
};

// Retourne le texte à afficher (sans le préfixe)
const getDisplayText = (text: string): string => {
  if (isNoResponse(text)) {
    return text.substring(NO_RESPONSE_PREFIX.length);
  }
  return text;
};

interface GuessingPhaseProps {
  lobbyCode: string;
  isLeader: boolean;
  leaderName: string;
}

const GuessingPhase: React.FC<GuessingPhaseProps> = ({ lobbyCode, isLeader, leaderName }) => {
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [players, setPlayers] = useState<IPlayer[]>([]);
  const [guesses, setGuesses] = useState<Record<string, string>>({}); // answerId -> playerId
  const [draggedAnswerId, setDraggedAnswerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Demander les réponses mélangées au montage du composant (fallback au cas où l'événement automatique a été manqué)
    socket.emit('requestShuffledAnswers', { lobbyCode });

    // Petit délai pour laisser le temps aux listeners socket de s'initialiser sur tous les clients
    const startTimerTimeout = setTimeout(() => {
      if (isLeader) {
        socket.emit('startTimer', { lobbyCode, duration: GAME_CONFIG.TIMERS.GUESSING });
      }
    }, 500);

    // Tous les joueurs reçoivent les réponses mélangées
    socket.on('shuffledAnswersReceived', (data: { answers: Answer[]; players: IPlayer[] }) => {
      setAnswers(data.answers);
      setPlayers(data.players);
      setLoading(false);
    });

    socket.on('guessUpdated', (data: { answerId: string; playerId: string | null; currentGuesses: Record<string, string> }) => {
      // Synchronisation en temps réel du drag & drop
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

    // Mettre à jour localement
    const newGuesses = { ...guesses, [draggedAnswerId]: playerId };
    setGuesses(newGuesses);

    // Broadcaster aux autres joueurs
    socket.emit('updateGuess', {
      lobbyCode,
      answerId: draggedAnswerId,
      playerId
    });

    setDraggedAnswerId(null);
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

    // Vérifier que toutes les réponses ont été attribuées
    const allAssigned = answers.every(answer => guesses[answer.id]);

    if (!allAssigned) {
      alert('Vous devez attribuer toutes les réponses avant de valider!');
      return;
    }

    socket.emit('submitGuesses', { lobbyCode, guesses });
  };

  const handleTimerExpire = () => {
    // Seul le chef doit appeler timerExpired pour éviter les appels multiples
    if (isLeader) {
      socket.emit('timerExpired', { lobbyCode });
    }
  };

  const getAssignedAnswers = (playerId: string) => {
    return answers.filter(answer => guesses[answer.id] === playerId);
  };

  const getUnassignedAnswers = () => {
    return answers.filter(answer => !guesses[answer.id]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin text-6xl mb-4">⏳</div>
          <p className="text-xl text-gray-800">Chargement des réponses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">
          {isLeader ? 'Qui a écrit quoi?' : `${leaderName} devine...`}
        </h2>
        <p className="text-sm text-gray-600 text-center mb-3">
          {isLeader
            ? 'Glissez-déposez chaque réponse vers le joueur correspondant'
            : 'Regardez le chef hésiter et rire ensemble!'}
        </p>
        <Timer duration={GAME_CONFIG.TIMERS.GUESSING} onExpire={handleTimerExpire} phase={RoundPhase.GUESSING} />
      </div>

      <div className="flex-1 grid grid-cols-2 gap-4 overflow-auto">
        {/* Colonne gauche: Réponses non attribuées */}
        <div className="bg-gray-100 rounded-lg p-4 border-2 border-gray-300">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Réponses</h3>
          <div className="space-y-3">
            {getUnassignedAnswers().map((answer) => {
              const noResponse = isNoResponse(answer.text);
              return (
                <div
                  key={answer.id}
                  draggable={isLeader}
                  onDragStart={() => handleDragStart(answer.id)}
                  className={`
                    border-2 rounded-lg p-4 break-words whitespace-pre-wrap
                    ${noResponse ? 'bg-gray-100 border-gray-200' : 'bg-white border-gray-300'}
                    ${isLeader ? 'cursor-move hover:border-primary hover:bg-blue-50' : 'cursor-default'}
                    transition-all duration-200
                    ${draggedAnswerId === answer.id ? 'opacity-50 scale-95' : ''}
                  `}
                >
                  <p className={`text-sm ${noResponse ? 'text-gray-400 italic' : 'text-gray-800'}`}>
                    {getDisplayText(answer.text)}
                  </p>
                </div>
              );
            })}
            {getUnassignedAnswers().length === 0 && (
              <p className="text-gray-500 text-center py-8">
                Toutes les réponses ont été attribuées
              </p>
            )}
          </div>
        </div>

        {/* Colonne droite: Joueurs avec leurs réponses attribuées */}
        <div className="space-y-3 overflow-auto">
          {players.map((player) => {
            const assignedAnswers = getAssignedAnswers(player.id);
            // Tronquer le nom si > 10 caractères
            const displayName = player.name.length > 10
              ? player.name.substring(0, 10) + '...'
              : player.name;

            return (
              <div
                key={player.id}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(player.id)}
                className="bg-primary-light rounded-lg p-3 flex gap-3
                  border-2 border-primary hover:border-primary-dark transition-all"
              >
                {/* Avatar et nom à gauche */}
                <div className="flex flex-col items-center justify-center min-w-[70px]">
                  <Avatar avatarId={player.avatarId} name={player.name} size="md" />
                  <span className="text-xs font-semibold text-gray-700 mt-1 text-center">
                    {displayName}
                  </span>
                </div>

                {/* Zone de réponse à droite */}
                <div className="flex-1 min-w-0">
                  {assignedAnswers.length > 0 ? (
                    <div className="space-y-2">
                      {assignedAnswers.map((answer) => {
                        const noResponse = isNoResponse(answer.text);
                        return (
                          <div
                            key={answer.id}
                            className={`rounded-lg p-3 flex justify-between items-start border-2 ${noResponse ? 'bg-gray-100 border-gray-200' : 'bg-white border-gray-300'}`}
                          >
                            <p className={`text-sm flex-1 min-w-0 break-words whitespace-pre-wrap ${noResponse ? 'text-gray-400 italic' : 'text-gray-800'}`}>
                              {getDisplayText(answer.text)}
                            </p>
                            {isLeader && (
                              <button
                                onClick={() => handleRemoveGuess(answer.id)}
                                className="ml-2 text-red-500 hover:text-red-600 font-bold"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-400 rounded-lg p-4 text-center bg-white h-full flex items-center justify-center">
                      <p className="text-gray-500 text-sm">
                        {isLeader ? 'Déposez une réponse ici' : 'Aucune réponse'}
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
        <div className="mt-6 text-center">
          {getUnassignedAnswers().length > 0 && (
            <p className="text-gray-500 mt-2 text-sm">
              Il reste {getUnassignedAnswers().length} réponse(s) à attribuer
            </p>
          )}
          <Button
            variant="success"
            size="xl"
            onClick={handleSubmit}
            disabled={getUnassignedAnswers().length > 0}
          >
            Valider mes choix
          </Button>
        </div>
      )}
    </div>
  );
};

export default GuessingPhase;
