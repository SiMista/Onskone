import { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import socket from '../utils/socket';
import { IPlayer, LeaderboardEntry, RoundData } from '@onskone/shared';
import Button from '../components/Button';
import Avatar from '../components/Avatar';
import Logo from '../components/Logo';
import { getCurrentPlayerFromStorage } from '../utils/playerHelpers';

const EndGame: React.FC = () => {
  const { lobbyCode } = useParams<{ lobbyCode: string }>();
  const navigate = useNavigate();
  const confettiTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<IPlayer | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  // Redirect if no lobby code
  useEffect(() => {
    if (!lobbyCode) {
      navigate('/');
    }
  }, [lobbyCode, navigate]);

  useEffect(() => {
    // Récupérer et valider le joueur actuel
    const parsedPlayer = getCurrentPlayerFromStorage();
    if (parsedPlayer) {
      setCurrentPlayer(parsedPlayer);
    }

    // Récupérer les données finales
    socket.on('gameEnded', (data: { leaderboard: LeaderboardEntry[]; rounds: RoundData[] }) => {
      setLeaderboard(data.leaderboard);

      // Afficher les confettis pour le gagnant
      if (data.leaderboard.length > 0 && parsedPlayer) {
        const winner = data.leaderboard[0];
        if (winner.player.id === parsedPlayer.id) {
          setShowConfetti(true);
          // Clean up previous timeout if exists
          if (confettiTimeoutRef.current) {
            clearTimeout(confettiTimeoutRef.current);
          }
          confettiTimeoutRef.current = setTimeout(() => setShowConfetti(false), 5000);
        }
      }
    });

    // Demander les résultats finaux si pas déjà reçus
    if (lobbyCode) {
      socket.emit('getGameResults', { lobbyCode: lobbyCode! });
    }

    return () => {
      socket.off('gameEnded');
      // Clean up confetti timeout on unmount
      if (confettiTimeoutRef.current) {
        clearTimeout(confettiTimeoutRef.current);
      }
    };
  }, [lobbyCode]);

  const handleBackToLobby = () => {
    if (lobbyCode) {
      navigate(`/lobby/${lobbyCode}`);
    }
  };

  const handleBackToHome = () => {
    // Notifier le serveur que le joueur quitte le lobby
    if (lobbyCode && currentPlayer) {
      socket.emit('leaveLobby', { lobbyCode, currentPlayerId: currentPlayer.id });
    }
    localStorage.removeItem('currentPlayer');
    navigate('/');
  };

  const getPodiumPosition = (index: number) => {
    // Position physique sur le podium (2ème = gauche, 1er = centre, 3ème = droite)
    if (index === 0) return { order: 2, height: 'h-32 md:h-64', medal: '🥇', color: 'from-yellow-400 to-yellow-600', rank: '1er' };
    if (index === 1) return { order: 1, height: 'h-24 md:h-48', medal: '🥈', color: 'from-gray-300 to-gray-500', rank: '2ème' };
    if (index === 2) return { order: 3, height: 'h-20 md:h-40', medal: '🥉', color: 'from-orange-400 to-orange-600', rank: '3ème' };
    return null;
  };

  // Pre-generate stable random values for confetti animation (prevents re-renders issues)
  const confettiItems = useMemo(() => {
    const emojis = ['🎉', '🎊', '⭐', '✨', '🏆'];
    return Array.from({ length: 50 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 20,
      delay: Math.random() * 3,
      duration: 2 + Math.random() * 3,
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
    }));
  }, []);

  return (
    <div className="min-h-screen p-3 md:p-8 relative overflow-hidden">
      {/* Confettis */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none z-50">
          {confettiItems.map((item) => (
            <div
              key={item.id}
              className="absolute animate-fall"
              style={{
                left: `${item.left}%`,
                top: `-${item.top}%`,
                animationDelay: `${item.delay}s`,
                animationDuration: `${item.duration}s`,
              }}
            >
              <span className="text-2xl md:text-4xl">
                {item.emoji}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        {/* Logo */}
        <div className="flex justify-center mb-3 md:mb-6">
          <Logo size="small" />
        </div>

        {/* Header */}
        <div className="text-center mb-4 md:mb-8">
          <p className="text-base md:text-2xl text-white/80 ">
            <strong>{leaderboard[0]?.player.name}</strong> est celui qui vous connait le mieux !
          </p>
        </div>

        {/* Podium Top 3 */}
        {leaderboard.length >= 3 && (
          <div className="mb-6 md:mb-12">
            <div className="flex items-end justify-center gap-5 md:gap-4 max-w-4xl mx-auto">
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
                    <div className={`mb-2 md:mb-4 text-center`}>
                      <div className="text-3xl md:text-6xl mb-1 md:mb-2">{podium.medal}</div>

                      <div className={`bg-white/20 backdrop-blur-md rounded-lg px-2 md:px-8 py-2 md:py-5 ${isCurrentPlayer ? 'ring-2 md:ring-4 ring-yellow-500 ring-offset-0' : ''
                        }`}>
                        {/* Avatar */}
                        <Avatar avatarId={entry.player.avatarId} name={entry.player.name} size="md" className="mx-auto mb-1 md:mb-2 md:hidden" />
                        <Avatar avatarId={entry.player.avatarId} name={entry.player.name} size="xl" className="mx-auto mb-1 md:mb-2 hidden md:block" />
                        <p className="text-white font-bold text-sm md:text-xl mb-0.5 md:mb-1 truncate max-w-[70px] md:max-w-none">
                          {entry.player.name}
                        </p>
                        {isCurrentPlayer && (
                          <span className="text-[10px] md:text-xs bg-yellow-500 px-1.5 md:px-2 py-0.5 md:py-1 rounded-full text-white">
                            Vous
                          </span>
                        )}
                        <p className="text-white text-xl md:text-4xl font-bold mt-1 md:mt-2">
                          {entry.score}
                        </p>
                        <p className="text-white/70 text-[10px] md:text-sm">
                          point{entry.score > 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>

                    {/* Marche du podium */}
                    <div className={`
                      w-25 md:w-48 ${podium.height} bg-gradient-to-b ${podium.color}
                      rounded-t-lg md:rounded-t-xl flex items-center justify-center
                      border-2 md:border-4 border-white/30 shadow-2xl
                    `}>
                      <span className="text-white text-2xl md:text-6xl font-bold opacity-50">
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
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-3 md:p-6 mb-4 md:mb-8 max-w-3xl mx-auto">
          <h2 className="text-lg md:text-2xl font-bold text-white mb-3 md:mb-4 text-center">
            Classement final
          </h2>
          <div className="space-y-1.5 md:space-y-2">
            {leaderboard.map((entry, index) => {
              const isCurrentPlayer = entry.player.id === currentPlayer?.id;
              const isTop3 = index < 3;

              return (
                <div
                  key={entry.player.id}
                  className={`
                    flex items-center justify-between p-2 md:p-4 rounded-lg
                    ${isCurrentPlayer ? 'bg-blue-500/50 ring-2 ring-blue-400' : 'bg-white/5'}
                    ${isTop3 ? 'font-bold' : ''}
                  `}
                >
                  <div className="flex items-center gap-2 md:gap-4 min-w-0">
                    <span className="text-xl md:text-3xl w-8 md:w-12 text-center flex-shrink-0">
                      {index < 3 ? ['🥇', '🥈', '🥉'][index] : `${index + 1}.`}
                    </span>
                    {/* Avatar */}
                    <Avatar avatarId={entry.player.avatarId} name={entry.player.name} size="sm" className="flex-shrink-0 md:hidden" />
                    <Avatar avatarId={entry.player.avatarId} name={entry.player.name} size="md" className="flex-shrink-0 hidden md:block" />
                    <span className="text-white text-sm md:text-lg truncate">
                      {entry.player.name}
                      {isCurrentPlayer && (
                        <span className="ml-1 md:ml-2 text-[10px] md:text-xs bg-blue-500 px-1.5 md:px-2 py-0.5 md:py-1 rounded-full">
                          Vous
                        </span>
                      )}
                    </span>
                  </div>
                  <span className="text-white text-lg md:text-2xl font-bold flex-shrink-0 ml-2">
                    {entry.score} pts
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Boutons d'action */}
        <div className="flex flex-col md:flex-row justify-center items-center gap-2 md:gap-10 w-2/3 md:w-auto mx-auto">
          <Button
            variant="success"
            size="lg"
            onClick={handleBackToLobby}
          >
            Rejouer
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={handleBackToHome}
          >
            Retour à l'accueil
          </Button>
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
