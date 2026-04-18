import { useEffect, useState } from 'react';
import socket from '../utils/socket';
import Button from './Button';
import Avatar from './Avatar';
import SimilarityPopover from './SimilarityPopover';
import { RevealResult, LeaderboardEntry } from '@onskone/shared';
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
  // Modal de similarité
  const [similarityModal, setSimilarityModal] = useState<{
    answerIndex: number;
    guessedPlayerName: string;
  } | null>(null);
  // Indices corrigés par similarité
  const [correctedIndices, setCorrectedIndices] = useState<Set<number>>(new Set());

  useEffect(() => {
    // Écouter les révélations du pilier
    socket.on('answerRevealed', (data: { revealedIndex: number; revealedIndices: number[] }) => {
      setRevealedIndices(new Set(data.revealedIndices));
    });

    // Écouter la détection de similarité
    socket.on('similarityDetected', (data: { answerIndex: number; guessedPlayerName: string }) => {
      setSimilarityModal({
        answerIndex: data.answerIndex,
        guessedPlayerName: data.guessedPlayerName,
      });
    });

    // Écouter la confirmation de similarité
    socket.on('similarityConfirmed', (data: { answerIndex: number; correctedScore: number; leaderboard: LeaderboardEntry[] }) => {
      setCorrectedIndices(prev => new Set(prev).add(data.answerIndex));
      setSimilarityModal(null);
    });

    // Écouter le rejet de similarité
    socket.on('similarityDismissed', () => {
      setSimilarityModal(null);
    });

    return () => {
      socket.off('answerRevealed');
      socket.off('similarityDetected');
      socket.off('similarityConfirmed');
      socket.off('similarityDismissed');
    };
  }, []);

  const handleReveal = (index: number) => {
    // Ne peut révéler que le prochain dans l'ordre, et pas pendant un popover de similarité
    if (isLeader && index === nextRevealIndex && !similarityModal) {
      socket.emit('revealAnswer', { lobbyCode, answerIndex: index });
    }
  };

  const handleConfirmSimilarity = () => {
    if (!similarityModal) return;
    socket.emit('confirmSimilarity', {
      lobbyCode,
      answerIndex: similarityModal.answerIndex,
    });
  };

  const handleDismissSimilarity = () => {
    if (!similarityModal) return;
    socket.emit('dismissSimilarity', {
      lobbyCode,
      answerIndex: similarityModal.answerIndex,
    });
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
        {/* Liste des résultats */}
        <div className="space-y-2 md:space-y-3 px-2 md:px-4">
          {/* En-têtes de colonnes - même structure que les cartes pour alignement */}
          <div className="px-2 md:px-4 pt-0 pb-0 border-2 md:border-[3px] border-transparent">
            <div className="grid grid-cols-[1fr_3.5rem_0.5rem_3.5rem] md:grid-cols-[1fr_5rem_0.5rem_5rem] gap-1 md:gap-2 items-center">
              <p className="text-black text-[10px] md:text-xs font-bold uppercase">Réponse</p>
              <p className="text-black text-[10px] md:text-xs font-bold uppercase text-center">Pilier a dit</p>
              <p className="text-black text-[10px] md:text-xs font-bold text-center">|</p>
              <p className="text-black text-[10px] md:text-xs font-bold uppercase text-center">Écrit par</p>
            </div>
          </div>
          {results.map((result, index) => {
            const isRevealed = revealedIndices.has(index);
            const noResponse = isNoResponse(result.answer);

            const showSimilarityPopover = similarityModal?.answerIndex === index;

            return (
              <div key={result.playerId}>
                <div
                  className={`
                    rounded-lg p-2 md:p-4 transform transition-all duration-500 border-2 md:border-[3px]
                    ${isRevealed
                      ? (result.correct || correctedIndices.has(index))
                        ? 'bg-[#30c94d] border-black shadow-[0_2px_10px_rgba(0,0,0,0.3)]'
                        : 'bg-[#ff6b6b] border-black shadow-[0_2px_10px_rgba(0,0,0,0.3)]'
                      : 'bg-white border-gray-300 shadow-[0_2px_10px_rgba(0,0,0,0.1)]'
                    }
                  `}
                >
                <div className="grid grid-cols-[1fr_3.5rem_0.5rem_3.5rem] md:grid-cols-[1fr_5rem_0.5rem_5rem] gap-1 md:gap-2 items-center">
                  {/* Réponse */}
                  <p
                    className={`text-xs md:text-base line-clamp-2 ${noResponse ? 'italic text-gray-500 font-normal' : 'font-bold'} ${isRevealed && !noResponse ? 'text-black' : noResponse ? '' : 'text-gray-800'}`}
                    title={getDisplayText(result.answer)}
                  >
                    {getDisplayText(result.answer)}
                  </p>

                  {/* Pilier a dit (toujours visible) */}
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

                  {/* Colonne vide pour alignement avec l'en-tête */}
                  <div></div>

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
                        // Prochain à révéler - jaune si disponible, grisé si modal similarité ouvert
                        <>
                          <button
                            onClick={() => handleReveal(index)}
                            disabled={!!similarityModal}
                            className={`w-8 h-8 md:w-12 md:h-12 rounded-full border-2 flex items-center justify-center font-bold text-xs md:text-sm shadow-md transition-all ${
                              similarityModal
                                ? 'bg-gray-300 border-gray-400 text-gray-500 opacity-50 cursor-not-allowed'
                                : 'bg-yellow-400 border-black text-black hover:bg-yellow-300 hover:scale-110 cursor-pointer animate-pulse'
                            }`}
                            title={similarityModal ? 'Répondez d\'abord à la question de similarité' : 'Révéler cette réponse'}
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

                {/* Popover de similarité sous la carte */}
                {showSimilarityPopover && (
                  <SimilarityPopover
                    guessedPlayerName={similarityModal.guessedPlayerName}
                    isLeader={isLeader}
                    onConfirm={handleConfirmSimilarity}
                    onDismiss={handleDismissSimilarity}
                  />
                )}
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
