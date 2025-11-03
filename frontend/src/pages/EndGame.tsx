import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import socket from '../utils/socket';
import { IPlayer, LeaderboardEntry, RoundStat, RoundData } from '@onskone/shared';

const EndGame: React.FC = () => {
  const { lobbyCode } = useParams<{ lobbyCode: string }>();
  const navigate = useNavigate();

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<IPlayer | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [bestRound, setBestRound] = useState<RoundStat | null>(null);

  // Redirect if no lobby code
  useEffect(() => {
    if (!lobbyCode) {
      navigate('/');
    }
  }, [lobbyCode, navigate]);

  useEffect(() => {
    // Récupérer le joueur actuel
    const storedPlayer = localStorage.getItem('currentPlayer');
    if (storedPlayer) {
      setCurrentPlayer(JSON.parse(storedPlayer));
    }

    // Récupérer les données finales
    socket.on('gameEnded', (data: { leaderboard: LeaderboardEntry[]; rounds: RoundData[] }) => {
      setLeaderboard(data.leaderboard);

      // Calculer le meilleur round (score le plus élevé en un seul round)
      if (data.rounds && data.rounds.length > 0) {
        const best = data.rounds.reduce((max: RoundStat, round: RoundData) => {
          const roundScore = Math.max(...Object.values(round.scores));
          return roundScore > max.score ? { roundNumber: round.roundNumber, leader: round.leader.name, score: roundScore } : max;
        }, { roundNumber: 0, leader: '', score: 0 });
        setBestRound(best);
      }

      // Afficher les confettis pour le gagnant
      if (data.leaderboard.length > 0 && storedPlayer) {
        const winner = data.leaderboard[0];
        const player = JSON.parse(storedPlayer);
        if (winner.player.id === player.id) {
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 5000);
        }
      }
    });

    // Demander les résultats finaux si pas déjà reçus
    if (lobbyCode) {
      socket.emit('getGameResults', { lobbyCode: lobbyCode! });
    }

    return () => {
      socket.off('gameEnded');
    };
  }, [lobbyCode]);

  const handleBackToLobby = () => {
    if (lobbyCode) {
      navigate(`/lobby/${lobbyCode}`);
    }
  };

  const handleBackToHome = () => {
    localStorage.removeItem('currentPlayer');
    navigate('/');
  };

  const getPodiumPosition = (index: number) => {
    // Position physique sur le podium (2ème = gauche, 1er = centre, 3ème = droite)
    if (index === 0) return { order: 2, height: 'h-64', medal: '🥇', color: 'from-yellow-400 to-yellow-600', rank: '1er' };
    if (index === 1) return { order: 1, height: 'h-48', medal: '🥈', color: 'from-gray-300 to-gray-500', rank: '2ème' };
    if (index === 2) return { order: 3, height: 'h-40', medal: '🥉', color: 'from-orange-400 to-orange-600', rank: '3ème' };
    return null;
  };

  return (
    <div className="min-h-screen p-8 relative overflow-hidden">
      {/* Confettis */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none z-50">
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={i}
              className="absolute animate-fall"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-${Math.random() * 20}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${2 + Math.random() * 3}s`,
              }}
            >
              <span className="text-4xl">
                {['🎉', '🎊', '⭐', '✨', '🏆'][Math.floor(Math.random() * 5)]}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-6xl font-bold text-white mb-4 animate-pulse">
            🎮 Partie terminée! 🎮
          </h1>
          <p className="text-2xl text-white/80">
            Félicitations à tous les joueurs!
          </p>
        </div>

        {/* Podium Top 3 */}
        {leaderboard.length >= 3 && (
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-white text-center mb-8">
              🏆 Podium 🏆
            </h2>
            <div className="flex items-end justify-center gap-4 max-w-4xl mx-auto">
              {leaderboard.slice(0, 3).map((entry, index) => {
                const podium = getPodiumPosition(index);
                if (!podium) return null;

                const isCurrentPlayer = entry.player.id === currentPlayer?.id;

                return (
                  <div
                    key={entry.player.id}
                    className="flex flex-col items-center"
                    style={{ order: podium.order }}
                  >
                    {/* Joueur */}
                    <div className={`mb-4 text-center ${isCurrentPlayer ? 'scale-110' : ''}`}>
                      <div className="text-6xl mb-2 animate-bounce">{podium.medal}</div>
                      <div className={`bg-white/20 backdrop-blur-md rounded-lg p-4 ${
                        isCurrentPlayer ? 'ring-4 ring-blue-400' : ''
                      }`}>
                        <p className="text-white font-bold text-xl mb-1">
                          {entry.player.name}
                        </p>
                        {isCurrentPlayer && (
                          <span className="text-xs bg-blue-500 px-2 py-1 rounded-full text-white">
                            Vous
                          </span>
                        )}
                        <p className="text-white text-4xl font-bold mt-2">
                          {entry.score}
                        </p>
                        <p className="text-white/70 text-sm">
                          point{entry.score > 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>

                    {/* Marche du podium */}
                    <div className={`
                      w-48 ${podium.height} bg-gradient-to-b ${podium.color}
                      rounded-t-xl flex items-center justify-center
                      border-4 border-white/30 shadow-2xl
                    `}>
                      <span className="text-white text-6xl font-bold opacity-50">
                        {podium.rank}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Classement complet */}
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 mb-8 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-4 text-center">
            📊 Classement complet
          </h2>
          <div className="space-y-2">
            {leaderboard.map((entry, index) => {
              const isCurrentPlayer = entry.player.id === currentPlayer?.id;
              const isTop3 = index < 3;

              return (
                <div
                  key={entry.player.id}
                  className={`
                    flex items-center justify-between p-4 rounded-lg
                    ${isCurrentPlayer ? 'bg-blue-500/50 ring-2 ring-blue-400' : 'bg-white/5'}
                    ${isTop3 ? 'font-bold' : ''}
                  `}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-3xl w-12 text-center">
                      {index < 3 ? ['🥇', '🥈', '🥉'][index] : `${index + 1}.`}
                    </span>
                    <span className="text-white text-lg">
                      {entry.player.name}
                      {isCurrentPlayer && (
                        <span className="ml-2 text-xs bg-blue-500 px-2 py-1 rounded-full">
                          Vous
                        </span>
                      )}
                    </span>
                  </div>
                  <span className="text-white text-2xl font-bold">
                    {entry.score} pts
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-2 gap-4 max-w-3xl mx-auto mb-8">
          {bestRound && (
            <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 text-center">
              <div className="text-4xl mb-2">🌟</div>
              <h3 className="text-lg font-bold text-white mb-2">Meilleur round</h3>
              <p className="text-white/80">
                Round {bestRound.roundNumber} - {bestRound.leader}
              </p>
              <p className="text-3xl font-bold text-yellow-400 mt-2">
                {bestRound.score} points
              </p>
            </div>
          )}

          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 text-center">
            <div className="text-4xl mb-2">🎯</div>
            <h3 className="text-lg font-bold text-white mb-2">Total de rounds</h3>
            <p className="text-3xl font-bold text-white mt-2">
              {leaderboard.length}
            </p>
            <p className="text-white/70 text-sm">
              (Chaque joueur a été chef)
            </p>
          </div>
        </div>

        {/* Boutons d'action */}
        <div className="flex justify-center gap-4">
          <button
            onClick={handleBackToLobby}
            className="px-8 py-4 rounded-lg font-bold text-xl bg-green-500 hover:bg-green-600
              text-white transition-all transform hover:scale-105 shadow-xl"
          >
            🔄 Rejouer
          </button>
          <button
            onClick={handleBackToHome}
            className="px-8 py-4 rounded-lg font-bold text-xl bg-gray-500 hover:bg-gray-600
              text-white transition-all transform hover:scale-105 shadow-xl"
          >
            🏠 Retour à l'accueil
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fall {
          to {
            transform: translateY(100vh) rotate(360deg);
          }
        }
        .animate-fall {
          animation: fall linear infinite;
        }
      `}</style>
    </div>
  );
};

export default EndGame;
