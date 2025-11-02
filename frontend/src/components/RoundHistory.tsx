import React, { useState } from 'react';

interface Player {
  id: string;
  name: string;
}

interface RoundData {
  roundNumber: number;
  leader: Player;
  selectedQuestion: string;
  answers: Record<string, string>; // playerId -> answer
  guesses: Record<string, string>; // answerId -> playerId
  scores: Record<string, number>; // playerId -> score for this round
}

interface RoundHistoryProps {
  rounds: RoundData[];
  players: Player[];
  isOpen: boolean;
  onClose: () => void;
}

const RoundHistory: React.FC<RoundHistoryProps> = ({ rounds, players, isOpen, onClose }) => {
  const [selectedRound, setSelectedRound] = useState<number | null>(null);

  if (!isOpen) return null;

  const getPlayerName = (playerId: string) => {
    return players.find(p => p.id === playerId)?.name || 'Inconnu';
  };

  const getRoundResults = (round: RoundData) => {
    const results = Object.entries(round.answers).map(([playerId, answer]) => {
      const guessedPlayerId = round.guesses[playerId];
      const correct = guessedPlayerId === playerId;

      return {
        playerId,
        playerName: getPlayerName(playerId),
        answer,
        guessedPlayerId,
        guessedPlayerName: getPlayerName(guessedPlayerId),
        correct
      };
    });

    const correctCount = results.filter(r => r.correct).length;
    const totalCount = results.length;

    return { results, correctCount, totalCount };
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white/20 backdrop-blur-md rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden border border-white/30">
        {/* Header */}
        <div className="bg-white/10 backdrop-blur-md p-6 flex justify-between items-center border-b border-white/20">
          <h2 className="text-3xl font-bold text-white flex items-center gap-3">
            <span>📜</span>
            <span>Historique des manches</span>
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:text-red-400 text-3xl font-bold transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex h-[calc(90vh-100px)]">
          {/* Liste des rounds (sidebar gauche) */}
          <div className="w-1/3 bg-white/5 backdrop-blur-md p-4 overflow-y-auto border-r border-white/20">
            <h3 className="text-xl font-bold text-white mb-4">Sélectionnez une manche</h3>
            <div className="space-y-2">
              {rounds.map((round) => {
                const { correctCount, totalCount } = getRoundResults(round);
                const isSelected = selectedRound === round.roundNumber;

                return (
                  <button
                    key={round.roundNumber}
                    onClick={() => setSelectedRound(round.roundNumber)}
                    className={`
                      w-full text-left p-4 rounded-lg transition-all
                      ${isSelected
                        ? 'bg-primary ring-2 ring-white'
                        : 'bg-white/10 hover:bg-white/20'
                      }
                    `}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-white font-bold text-lg">
                        Round {round.roundNumber}
                      </span>
                      <span className="text-white/70 text-sm">
                        {correctCount}/{totalCount} ✓
                      </span>
                    </div>
                    <p className="text-white/80 text-sm">
                      👑 Chef : {round.leader.name}
                    </p>
                    <p className="text-white/60 text-xs mt-1 truncate">
                      {round.selectedQuestion}
                    </p>
                  </button>
                );
              })}

              {rounds.length === 0 && (
                <p className="text-white/50 text-center py-8">
                  Aucune manche jouée pour le moment
                </p>
              )}
            </div>
          </div>

          {/* Détails du round sélectionné (contenu principal) */}
          <div className="flex-1 p-6 overflow-y-auto">
            {selectedRound !== null ? (
              (() => {
                const round = rounds.find(r => r.roundNumber === selectedRound);
                if (!round) return <p className="text-white">Round non trouvé</p>;

                const { results, correctCount, totalCount } = getRoundResults(round);
                const leaderScore = round.scores[round.leader.id] || 0;

                return (
                  <div className="space-y-6">
                    {/* En-tête du round */}
                    <div className="bg-white/10 backdrop-blur-md rounded-lg p-6">
                      <h3 className="text-2xl font-bold text-white mb-4">
                        Round {round.roundNumber}
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-white/70 text-sm">Chef de la manche</p>
                          <p className="text-white text-xl font-bold">👑 {round.leader.name}</p>
                        </div>
                        <div>
                          <p className="text-white/70 text-sm">Score du chef</p>
                          <p className="text-white text-xl font-bold">
                            {correctCount}/{totalCount} ({leaderScore} pts)
                          </p>
                        </div>
                      </div>
                      <div className="mt-4">
                        <p className="text-white/70 text-sm mb-2">Question posée</p>
                        <p className="text-white text-lg font-medium bg-white/10 rounded-lg p-3">
                          {round.selectedQuestion}
                        </p>
                      </div>
                    </div>

                    {/* Résultats détaillés */}
                    <div>
                      <h4 className="text-xl font-bold text-white mb-4">Résultats détaillés</h4>
                      <div className="space-y-3">
                        {results.map((result) => (
                          <div
                            key={result.playerId}
                            className="bg-white/10 backdrop-blur-md rounded-lg p-4"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <span className="text-2xl">
                                  {result.correct ? '✅' : '❌'}
                                </span>
                                <div>
                                  <p className="text-white font-semibold">
                                    {result.playerName}
                                  </p>
                                  <p className="text-white/60 text-sm">
                                    Le chef a dit : {result.guessedPlayerName || 'Personne'}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="bg-white/10 rounded-lg p-3">
                              <p className="text-white/70 text-xs mb-1">Réponse :</p>
                              <p className="text-white">{result.answer}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="text-6xl mb-4">📋</div>
                  <p className="text-xl text-white/70">
                    Sélectionnez une manche pour voir les détails
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoundHistory;
