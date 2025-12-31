import { useEffect, useState } from 'react';
import socket from '../utils/socket';
import Button from './Button';
import Avatar from './Avatar';
import { RevealResult } from '@onskone/shared';
import { isNoResponse, getDisplayText } from '../utils/answerHelpers';

interface RevealPhaseProps {
  lobbyCode: string;
  isLeader: boolean;
  leaderName: string;
  isGameOver: boolean;
  results: RevealResult[];
  question: string;
  initialRevealedIndices?: number[];
}

const RevealPhase: React.FC<RevealPhaseProps> = ({ lobbyCode, isLeader, leaderName, isGameOver, results, question, initialRevealedIndices }) => {
  // Indices des réponses révélées (synchronisé via socket)
  const [revealedIndices, setRevealedIndices] = useState<Set<number>>(
    new Set(initialRevealedIndices || [])
  );

  useEffect(() => {
    // Écouter les révélations du pilier
    socket.on('answerRevealed', (data: { revealedIndex: number; revealedIndices: number[] }) => {
      setRevealedIndices(new Set(data.revealedIndices));
    });

    return () => {
      socket.off('answerRevealed');
    };
  }, []);

  const handleReveal = (index: number) => {
    // Ne peut révéler que le prochain dans l'ordre (de haut en bas)
    if (isLeader && index === nextRevealIndex) {
      socket.emit('revealAnswer', { lobbyCode, answerIndex: index });
    }
  };

  const handleNextRound = () => {
    socket.emit('nextRound', { lobbyCode });
  };

  const truncateName = (name: string, maxLength: number = 8) => {
    return name.length > maxLength ? name.substring(0, maxLength) + '...' : name;
  };

  const totalAnswers = results.length;
  const revealedCount = revealedIndices.size;
  const allRevealed = revealedCount >= totalAnswers;

  // Trouver le prochain index à révéler (premier non-révélé de haut en bas)
  const nextRevealIndex = results.findIndex((_, index) => !revealedIndices.has(index));

  return (
    <div className="flex flex-col h-full p-2 max-w-2xl mx-auto">
      {/* Header - Question */}
      <div className="bg-primary-light rounded-lg px-2 py-2 max-w-2xl text-center mb-2 md:mb-3">
        <p className="text-xs md:text-sm text-gray-500 mb-1 md:mb-2">
          Question posée durant cette manche:
        </p>
        <p className="text-base md:text-2xl font-semibold text-gray-800">
          {question}
        </p>
      </div>

      {/* Instruction en haut */}
      {!allRevealed && (
        <div className="text-center mb-2 md:mb-3">
          {isLeader ? (
            <p className="text-gray-900 text-sm md:text-base font-semibold">
              Clique sur <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-400 border-2 border-black text-black font-bold text-xs mx-1">?</span> pour révéler ({revealedCount}/{totalAnswers})
            </p>
          ) : (
            <p className="text-gray-900 text-sm md:text-base font-semibold">
              {leaderName} révèle les réponses... ({revealedCount}/{totalAnswers})
            </p>
          )}
        </div>
      )}

      {/* Résultats détaillés avec en-têtes de colonnes */}
      <div className="flex-1 overflow-auto mb-3 md:mb-4">
        {/* En-têtes de colonnes - inversées : Chef a dit | Écrit par */}
        <div className="mb-2 md:mb-3 px-2 md:px-4">
          <div className="grid grid-cols-[1fr_3.5rem_3.5rem] md:grid-cols-[1fr_5rem_5rem] gap-2 md:gap-4 items-center">
            <p className="text-black text-[10px] md:text-xs font-bold uppercase">Réponse</p>
            <p className="text-black text-[10px] md:text-xs font-bold uppercase text-center">Chef a dit</p>
            <p className="text-black text-[10px] md:text-xs font-bold uppercase text-center">Écrit par</p>
          </div>
        </div>

        {/* Liste des résultats */}
        <div className="space-y-2 md:space-y-3 px-2 md:px-4">
          {results.map((result, index) => {
            const isRevealed = revealedIndices.has(index);
            const noResponse = isNoResponse(result.answer);

            return (
              <div
                key={result.playerId}
                className={`
                  rounded-lg p-2 md:p-4 transform transition-all duration-500 border-2 md:border-[3px]
                  ${isRevealed
                    ? result.correct
                      ? 'bg-[#30c94d] border-black shadow-[0_2px_10px_rgba(0,0,0,0.3)]'
                      : 'bg-[#ff6b6b] border-black shadow-[0_2px_10px_rgba(0,0,0,0.3)]'
                    : 'bg-white border-gray-300 shadow-[0_2px_10px_rgba(0,0,0,0.1)]'
                  }
                `}
              >
                <div className="grid grid-cols-[1fr_3.5rem_3.5rem] md:grid-cols-[1fr_5rem_5rem] gap-2 md:gap-4 items-center">
                  {/* Réponse */}
                  <p
                    className={`text-xs md:text-base truncate ${noResponse ? 'italic text-gray-500 font-normal' : 'font-bold'} ${isRevealed && !noResponse ? 'text-black' : noResponse ? '' : 'text-gray-800'}`}
                    title={getDisplayText(result.answer)}
                  >
                    {getDisplayText(result.answer)}
                  </p>

                  {/* Chef a dit (toujours visible) */}
                  <div className="flex flex-col items-center">
                    {result.guessedPlayerName && result.guessedPlayerName !== 'Personne' ? (
                      <>
                        <Avatar avatarId={result.guessedPlayerAvatarId ?? 0} name={result.guessedPlayerName} size="sm" className="md:hidden" />
                        <Avatar avatarId={result.guessedPlayerAvatarId ?? 0} name={result.guessedPlayerName} size="md" className="hidden md:block" />
                        <span className={`text-[10px] md:text-xs font-semibold mt-0.5 md:mt-1 ${isRevealed ? 'text-black' : 'text-gray-700'}`} title={result.guessedPlayerName}>
                          {truncateName(result.guessedPlayerName, 6)}
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gray-300 border-2 border-black flex items-center justify-center text-gray-600 font-bold text-sm md:text-lg shadow-md">
                          ?
                        </div>
                        <span className={`text-[10px] md:text-xs font-semibold mt-0.5 md:mt-1 ${isRevealed ? 'text-black' : 'text-gray-700'}`}>
                          Aucun
                        </span>
                      </>
                    )}
                  </div>

                  {/* Écrit par (révélé ou bouton révéler) */}
                  <div className="flex flex-col items-center">
                    {isRevealed ? (
                      <>
                        <Avatar avatarId={result.playerAvatarId ?? 0} name={result.playerName} size="sm" className="md:hidden" />
                        <Avatar avatarId={result.playerAvatarId ?? 0} name={result.playerName} size="md" className="hidden md:block" />
                        <span className="text-[10px] md:text-xs font-semibold text-black mt-0.5 md:mt-1" title={result.playerName}>
                          {truncateName(result.playerName, 6)}
                        </span>
                      </>
                    ) : isLeader ? (
                      index === nextRevealIndex ? (
                        // Prochain à révéler - jaune, cliquable
                        <>
                          <button
                            onClick={() => handleReveal(index)}
                            className="w-8 h-8 md:w-12 md:h-12 rounded-full bg-yellow-400 border-2 border-black flex items-center justify-center text-black font-bold text-xs md:text-sm shadow-md hover:bg-yellow-300 hover:scale-110 transition-all cursor-pointer animate-pulse"
                            title="Révéler cette réponse"
                          >
                            ?
                          </button>
                          <span className="text-[10px] md:text-xs font-semibold text-gray-500 mt-0.5 md:mt-1">
                            ???
                          </span>
                        </>
                      ) : (
                        // Verrouillé - grisé avec cadenas
                        <>
                          <div className="w-8 h-8 md:w-12 md:h-12 rounded-full bg-gray-300 border-2 border-gray-400 flex items-center justify-center text-gray-500 font-bold text-xs md:text-sm shadow-md opacity-50">
                            ?
                          </div>
                          <span className="text-[10px] md:text-xs font-semibold text-gray-400 mt-0.5 md:mt-1">
                            ???
                          </span>
                        </>
                      )
                    ) : (
                      <>
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gray-200 border-2 border-dashed border-gray-400 flex items-center justify-center text-gray-500 font-bold text-base md:text-xl shadow-md">
                          ?
                        </div>
                        <span className="text-[10px] md:text-xs font-semibold text-gray-500 mt-0.5 md:mt-1">
                          ???
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Boutons - seulement quand tout est révélé */}
      {allRevealed && (
        <div className="flex flex-col items-center gap-2 md:gap-3">
          {isLeader ? (
            <>
              <p className="text-base md:text-lg font-semibold">
                {isGameOver ? 'Partie terminée !' : 'Prêt pour la suite ?'}
              </p>
              <Button
                text={isGameOver ? 'Voir les résultats finaux' : 'Manche suivante'}
                variant='success'
                rotateEffect={true}
                onClick={handleNextRound}
              />
            </>
          ) : (
            <div className="text-center">
              <p className="text-gray-900 text-sm md:text-base font-semibold">
                {isGameOver
                  ? `En attente que ${leaderName} révèle les résultats finaux...`
                  : `En attente que ${leaderName} lance la manche suivante...`
                }
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RevealPhase;
