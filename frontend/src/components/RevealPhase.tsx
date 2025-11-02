import React, { useEffect, useState } from 'react';
import socket from '../utils/socket';

interface Result {
  playerId: string;
  playerName: string;
  answer: string;
  guessedPlayerId: string;
  guessedPlayerName: string;
  correct: boolean;
}

interface LeaderboardEntry {
  player: {
    id: string;
    name: string;
  };
  score: number;
}

interface RevealPhaseProps {
  lobbyCode: string;
  isLeader: boolean;
  leaderName: string;
  isGameOver: boolean;
}

const RevealPhase: React.FC<RevealPhaseProps> = ({ lobbyCode, isLeader, leaderName, isGameOver }) => {
  const [results, setResults] = useState<Result[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [roundScore, setRoundScore] = useState(0);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    socket.on('revealResults', (data: { phase: string; results: Result[]; scores: Record<string, number>; leaderboard: LeaderboardEntry[] }) => {
      setResults(data.results);
      setLeaderboard(data.leaderboard);

      // Le score du round est le score du chef (nombre de bonnes attributions)
      // On le trouve en comptant les résultats corrects
      const correctCount = data.results.filter((r: Result) => r.correct).length;
      setRoundScore(correctCount);

      // Animation de révélation
      setTimeout(() => setRevealed(true), 500);
    });

    return () => {
      socket.off('revealResults');
    };
  }, []);

  const handleNextRound = () => {
    // Le backend gère la logique isGameOver et envoie gameEnded si nécessaire
    socket.emit('nextRound', { lobbyCode });
  };

  const correctGuesses = results.filter(r => r.correct).length;
  const totalAnswers = results.length;

  return (
    <div className="flex flex-col h-full p-6">
      {/* Header avec score du chef */}
      <div className="mb-6 text-center">
        <h2 className="text-4xl font-bold text-white mb-4">Résultats</h2>
        <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-lg p-6 max-w-2xl mx-auto">
          <p className="text-white text-lg mb-2">{leaderName} a trouvé :</p>
          <p className="text-6xl font-bold text-white mb-2">
            {correctGuesses} / {totalAnswers}
          </p>
          <p className="text-white text-xl">
            Score du round : +{roundScore} point{roundScore > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Résultats détaillés */}
      <div className="flex-1 overflow-auto space-y-4 mb-6">
        {results.map((result, index) => (
          <div
            key={result.playerId}
            className={`
              bg-white/10 backdrop-blur-md rounded-lg p-6 transform transition-all duration-500
              ${revealed ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'}
            `}
            style={{ transitionDelay: `${index * 100}ms` }}
          >
            <div className="grid grid-cols-3 gap-4 items-center">
              {/* Réponse */}
              <div className="col-span-1">
                <p className="text-white/70 text-sm mb-1">Réponse :</p>
                <p className="text-white text-lg font-medium">{result.answer}</p>
              </div>

              {/* Attribution du chef */}
              <div className="col-span-1 text-center">
                <div className="flex items-center justify-center space-x-3">
                  <div className="text-center">
                    <p className="text-white/70 text-sm mb-1">Vraie réponse :</p>
                    <div className="bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold">
                      {result.playerName}
                    </div>
                  </div>

                  <div className="text-4xl">
                    {result.correct ? '✅' : '❌'}
                  </div>

                  <div className="text-center">
                    <p className="text-white/70 text-sm mb-1">Le chef a dit :</p>
                    <div className={`px-4 py-2 rounded-lg font-semibold ${
                      result.correct ? 'bg-green-500' : 'bg-red-500'
                    } text-white`}>
                      {result.guessedPlayerName || 'Personne'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Résultat */}
              <div className="col-span-1 text-right">
                {result.correct ? (
                  <div className="text-green-400 text-3xl font-bold animate-bounce">
                    TROUVÉ!
                  </div>
                ) : (
                  <div className="text-red-400 text-2xl font-bold">
                    RATÉ!
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Leaderboard mini */}
      <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 mb-4">
        <h3 className="text-xl font-bold text-white mb-3 text-center">Classement général</h3>
        <div className="grid grid-cols-4 gap-2">
          {leaderboard.slice(0, 4).map((entry, index) => (
            <div
              key={entry.player.id}
              className={`text-center p-3 rounded-lg ${
                index === 0 ? 'bg-yellow-500' :
                index === 1 ? 'bg-gray-400' :
                index === 2 ? 'bg-orange-600' :
                'bg-white/20'
              }`}
            >
              <div className="text-2xl mb-1">
                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '👤'}
              </div>
              <p className="text-white font-semibold text-sm">{entry.player.name}</p>
              <p className="text-white text-xl font-bold">{entry.score}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bouton next round */}
      {isLeader && (
        <div className="text-center">
          <button
            onClick={handleNextRound}
            className="px-8 py-4 rounded-lg font-bold text-xl bg-primary hover:bg-primary/90
              text-white transition-all transform hover:scale-105"
          >
            {isGameOver ? 'Voir les résultats finaux' : 'Manche suivante'}
          </button>
        </div>
      )}

      {!isLeader && (
        <div className="text-center">
          <p className="text-white/70">
            {isGameOver
              ? 'En attente des résultats finaux...'
              : `En attente que ${leaderName} lance la manche suivante...`
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default RevealPhase;
