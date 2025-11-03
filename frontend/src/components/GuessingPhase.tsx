import React, { useEffect, useState } from 'react';
import socket from '../utils/socket';
import Timer from './Timer';
import { IPlayer } from '@onskone/shared';

interface Answer {
  id: string; // playerId de l'auteur
  text: string;
}

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
    if (isLeader) {
      socket.emit('requestShuffledAnswers', { lobbyCode });
      socket.emit('startTimer', { lobbyCode, duration: 90 }); // 90 secondes pour deviner
    }

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
    socket.emit('timerExpired', { lobbyCode });
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
          <p className="text-xl text-white">Chargement des réponses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-6">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-white mb-2 text-center">
          {isLeader ? 'Qui a écrit quoi?' : `${leaderName} devine...`}
        </h2>
        <p className="text-white/70 text-center mb-4">
          {isLeader
            ? 'Glissez-déposez chaque réponse vers le joueur correspondant'
            : 'Regardez le chef hésiter et rire ensemble!'}
        </p>
        <Timer duration={90} onExpire={handleTimerExpire} />
      </div>

      <div className="flex-1 grid grid-cols-2 gap-6 overflow-auto">
        {/* Colonne gauche: Réponses non attribuées */}
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-4">
          <h3 className="text-xl font-bold text-white mb-4">Réponses</h3>
          <div className="space-y-3">
            {getUnassignedAnswers().map((answer) => (
              <div
                key={answer.id}
                draggable={isLeader}
                onDragStart={() => handleDragStart(answer.id)}
                className={`
                  bg-white/20 rounded-lg p-4
                  ${isLeader ? 'cursor-move hover:bg-white/30' : 'cursor-default'}
                  transition-all duration-200
                  ${draggedAnswerId === answer.id ? 'opacity-50 scale-95' : ''}
                `}
              >
                <p className="text-white text-sm">{answer.text}</p>
              </div>
            ))}
            {getUnassignedAnswers().length === 0 && (
              <p className="text-white/50 text-center py-8">
                Toutes les réponses ont été attribuées
              </p>
            )}
          </div>
        </div>

        {/* Colonne droite: Joueurs avec leurs réponses attribuées */}
        <div className="space-y-4 overflow-auto">
          {players.map((player) => {
            const assignedAnswers = getAssignedAnswers(player.id);

            return (
              <div
                key={player.id}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(player.id)}
                className="bg-gradient-to-r from-primary/20 to-primary-light/20 backdrop-blur-md rounded-lg p-4
                  border-2 border-white/20 hover:border-white/40 transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-lg font-bold text-white">{player.name}</h4>
                  <span className="bg-white/20 px-3 py-1 rounded-full text-sm text-white">
                    {assignedAnswers.length} réponse{assignedAnswers.length > 1 ? 's' : ''}
                  </span>
                </div>

                <div className="space-y-2">
                  {assignedAnswers.map((answer) => (
                    <div
                      key={answer.id}
                      className="bg-white/30 rounded-lg p-3 flex justify-between items-start"
                    >
                      <p className="text-white text-sm flex-1">{answer.text}</p>
                      {isLeader && (
                        <button
                          onClick={() => handleRemoveGuess(answer.id)}
                          className="ml-2 text-red-400 hover:text-red-300 font-bold"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  {assignedAnswers.length === 0 && (
                    <div className="border-2 border-dashed border-white/30 rounded-lg p-6 text-center">
                      <p className="text-white/50 text-sm">
                        {isLeader ? 'Déposez une réponse ici' : 'Aucune réponse attribuée'}
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
          <button
            onClick={handleSubmit}
            disabled={getUnassignedAnswers().length > 0}
            className={`px-8 py-4 rounded-lg font-bold text-xl transition-all transform
              ${getUnassignedAnswers().length === 0
                ? 'bg-green-500 hover:bg-green-600 hover:scale-105 text-white cursor-pointer'
                : 'bg-gray-500 text-gray-300 cursor-not-allowed'
              }
            `}
          >
            Valider mes choix
          </button>
          {getUnassignedAnswers().length > 0 && (
            <p className="text-yellow-400 mt-2 text-sm">
              Il reste {getUnassignedAnswers().length} réponse(s) à attribuer
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default GuessingPhase;
