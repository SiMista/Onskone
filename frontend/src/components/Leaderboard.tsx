import React from 'react';

interface Player {
  id: string;
  name: string;
}

interface LeaderboardEntry {
  player: Player;
  score: number;
}

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  currentPlayerId?: string;
  leaderName?: string;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ entries, currentPlayerId, leaderName }) => {
  return (
    <div className="bg-white/10 backdrop-blur-md rounded-lg p-4">
      <h3 className="text-xl font-bold text-white mb-4 text-center flex items-center justify-center gap-2">
        <span>🏆</span>
        <span>Classement</span>
      </h3>

      <div className="space-y-2">
        {entries.map((entry, index) => {
          const isCurrentPlayer = entry.player.id === currentPlayerId;
          const isLeader = entry.player.name === leaderName;
          const position = index + 1;

          return (
            <div
              key={entry.player.id}
              className={`
                flex items-center justify-between p-3 rounded-lg transition-all
                ${isCurrentPlayer ? 'bg-blue-500/50 ring-2 ring-blue-400' : 'bg-white/5'}
                ${position === 1 ? 'bg-gradient-to-r from-yellow-500/30 to-orange-500/30' : ''}
                ${position === 2 ? 'bg-gradient-to-r from-gray-400/30 to-gray-500/30' : ''}
                ${position === 3 ? 'bg-gradient-to-r from-orange-600/30 to-orange-700/30' : ''}
              `}
            >
              {/* Position et médaille */}
              <div className="flex items-center gap-3 flex-1">
                <div className="text-2xl w-8 text-center">
                  {position === 1 ? '🥇' :
                   position === 2 ? '🥈' :
                   position === 3 ? '🥉' :
                   position}
                </div>

                {/* Nom du joueur */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`font-semibold ${isCurrentPlayer ? 'text-white' : 'text-white/90'}`}>
                      {entry.player.name}
                    </p>
                    {isLeader && (
                      <span className="text-sm bg-primary px-2 py-0.5 rounded-full">
                        👑 Chef
                      </span>
                    )}
                    {isCurrentPlayer && (
                      <span className="text-xs bg-blue-500 px-2 py-0.5 rounded-full">
                        Vous
                      </span>
                    )}
                  </div>
                </div>

                {/* Score */}
                <div className="text-right">
                  <p className="text-2xl font-bold text-white">
                    {entry.score}
                  </p>
                  <p className="text-xs text-white/60">
                    point{entry.score > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {entries.length === 0 && (
        <p className="text-white/50 text-center py-6">
          Aucun score pour le moment
        </p>
      )}
    </div>
  );
};

export default Leaderboard;
