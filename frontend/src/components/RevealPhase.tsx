import { useEffect, useState } from 'react';
import socket from '../utils/socket';
import Button from './Button';
import Avatar from './Avatar';
import QuestionCard from './QuestionCard';
import SimilarityPopover from './SimilarityPopover';
import { RevealResult, LeaderboardEntry, GameCard } from '@onskone/shared';
import { isNoResponse, getDisplayText } from '../utils/answerHelpers';

interface RevealPhaseProps {
  lobbyCode: string;
  isLeader: boolean;
  leaderName: string;
  currentPlayerId: string;
  isGameOver: boolean;
  results: RevealResult[];
  question: string;
  card?: GameCard;
  initialRevealedIndices?: number[];
}

const RevealPhase: React.FC<RevealPhaseProps> = ({ lobbyCode, isLeader, leaderName, currentPlayerId, isGameOver, results, question, card, initialRevealedIndices }) => {
  const [revealedIndices, setRevealedIndices] = useState<Set<number>>(
    new Set(initialRevealedIndices || [])
  );
  const [similarityModal, setSimilarityModal] = useState<{
    answerIndex: number;
    guessedPlayerName: string;
  } | null>(null);
  const [correctedIndices, setCorrectedIndices] = useState<Set<number>>(new Set());
  // Index en cours d'attente côté pilier (pendant le délai de 2s avant affichage couleur)
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);

  useEffect(() => {
    socket.on('answerRevealed', (data: { revealedIndex: number; revealedIndices: number[] }) => {
      setRevealedIndices(new Set(data.revealedIndices));
      setPendingIndex(data.revealedIndex);
      // Libère le verrou après la fin du fondu (2s délai + 0.4s fade)
      setTimeout(() => {
        setPendingIndex(prev => (prev === data.revealedIndex ? null : prev));
      }, 2400);
    });

    socket.on('similarityDetected', (data: { answerIndex: number; guessedPlayerName: string }) => {
      setSimilarityModal({
        answerIndex: data.answerIndex,
        guessedPlayerName: data.guessedPlayerName,
      });
    });

    socket.on('similarityConfirmed', (data: { answerIndex: number; correctedScore: number; leaderboard: LeaderboardEntry[] }) => {
      setCorrectedIndices(prev => new Set(prev).add(data.answerIndex));
      setSimilarityModal(null);
    });

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
    if (isLeader && index === nextRevealIndex && !similarityModal && pendingIndex === null) {
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
  const nextRevealIndex = results.findIndex((_, index) => !revealedIndices.has(index));

  // ============================================================
  // VUE JOUEUR (non-pilier) — carte unique de la réponse attribuée
  // ============================================================
  if (!isLeader) {
    const myIndex = results.findIndex(r => r.guessedPlayerId === currentPlayerId);
    const myResult = myIndex >= 0 ? results[myIndex] : null;
    // Révélation bloquée pendant le popup de similarité pour cette ligne
    const myAwaitingSimilarity = myIndex >= 0 && similarityModal?.answerIndex === myIndex;
    const myRevealed = myIndex >= 0 && revealedIndices.has(myIndex) && !myAwaitingSimilarity;
    const myCorrect = myResult ? (myResult.correct || correctedIndices.has(myIndex)) : false;

    return (
      <div className="flex flex-col h-full p-2 max-w-2xl mx-auto">
        <div className="flex-1 flex flex-col items-center justify-center gap-4 md:gap-6 px-2">
          {myResult ? (
            <>
              <p className="text-gray-900 text-base md:text-xl font-semibold text-center">
                Montre ton écran à tout le monde !
              </p>

              <div
                className={`
                  w-full max-w-md rounded-xl p-6 md:p-8 border-2 md:border-[3px] border-black
                  transition-colors duration-500
                  ${myRevealed
                    ? myCorrect
                      ? 'bg-[#30c94d]'
                      : 'bg-[#ff6b6b]'
                    : 'bg-white'
                  }
                  shadow-[0_2px_10px_rgba(0,0,0,0.2)]
                `}
              >
                <p
                  className={`text-lg md:text-2xl font-bold text-center break-words ${
                    isNoResponse(myResult.answer) ? 'italic text-gray-500 font-normal' : 'text-black'
                  }`}
                >
                  {getDisplayText(myResult.answer)}
                </p>
              </div>

              {/* Avatar de l'auteur réel (vide avant reveal, fade-in au reveal) */}
              <div className="flex flex-col items-center gap-2">
                <p className="text-gray-700 text-xs md:text-sm font-semibold uppercase">Écrit par</p>
                <div className="relative w-16 h-16 md:w-20 md:h-20">
                  {/* Placeholder vide */}
                  <div
                    className={`absolute inset-0 rounded-full bg-gray-200 border-2 border-dashed border-gray-400 flex items-center justify-center text-gray-500 font-bold text-xl md:text-2xl shadow-md transition-opacity duration-500 ${
                      myRevealed ? 'opacity-0' : 'opacity-100'
                    }`}
                  >
                    ?
                  </div>
                  {/* Avatar réel qui se dévoile */}
                  <div
                    className={`absolute inset-0 flex items-center justify-center transition-opacity duration-500 ${
                      myRevealed ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    <Avatar avatarId={myResult.playerAvatarId ?? 0} name={myResult.playerName} size="lg" />
                  </div>
                </div>
                <span
                  className={`text-sm md:text-base font-semibold text-black transition-opacity duration-500 ${
                    myRevealed ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  {myResult.playerName}
                </span>
              </div>
            </>
          ) : (
            <>
              <p className="text-gray-900 text-lg md:text-2xl font-bold text-center">
                Le pilier ne t'a attribué aucune réponse.
              </p>
              <p className="text-gray-700 text-sm md:text-base text-center">
                Regarde les écrans des autres joueurs.
              </p>
            </>
          )}

          {allRevealed && (
            <div className="text-center mt-2">
              <p className="text-gray-900 text-sm md:text-base font-semibold">
                {isGameOver
                  ? `En attente que ${leaderName} révèle les résultats finaux...`
                  : `En attente que ${leaderName} lance la manche suivante...`
                }
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================================
  // VUE PILIER — tableau complet, fondu 3s sur chaque révélation
  // ============================================================
  return (
    <div className="flex flex-col h-full p-2 max-w-2xl mx-auto">
      <div className="mb-2 md:mb-3">
        <QuestionCard question={question} card={card} variant="compact" />
      </div>

      {!allRevealed && (
        <div className="text-center mb-2 md:mb-3">
          <p className="text-gray-900 text-sm md:text-base font-semibold">
            Regardez les autres écrans, puis clique pour révéler ({revealedCount}/{totalAnswers})
          </p>
        </div>
      )}

      <div className="flex-1 overflow-auto mb-3 md:mb-4">
        <div className="space-y-2 md:space-y-3 px-2 md:px-4">
          {/* En-têtes de colonnes */}
          <div className="px-2 md:px-4 pt-0 pb-0 border-2 md:border-[3px] border-transparent">
            <div className="grid grid-cols-[1fr_4.5rem_0.5rem_4.5rem] md:grid-cols-[1fr_5rem_0.5rem_5rem] gap-1 md:gap-2 items-center">
              <p className="text-black text-[11px] md:text-xs font-bold uppercase">Réponse</p>
              <p className="text-black text-[11px] md:text-xs font-bold uppercase text-center whitespace-nowrap">Pilier a dit</p>
              <p className="text-black text-[11px] md:text-xs font-bold text-center">|</p>
              <p className="text-black text-[11px] md:text-xs font-bold uppercase text-center whitespace-nowrap">Écrit par</p>
            </div>
          </div>
          {results.map((result, index) => {
            const isRevealed = revealedIndices.has(index);
            const noResponse = isNoResponse(result.answer);
            const showSimilarityPopover = similarityModal?.answerIndex === index;
            const isCorrect = result.correct || correctedIndices.has(index);
            const isClickable = !isRevealed && index === nextRevealIndex && !similarityModal && pendingIndex === null;

            return (
              <div key={result.playerId}>
                <div
                  className={`relative rounded-lg border-2 md:border-[3px] border-black shadow-[0_2px_10px_rgba(0,0,0,0.1)] transition-transform ${
                    isClickable
                      ? 'animate-card-soft-pulse hover:-translate-y-0.5 active:translate-y-0'
                      : pendingIndex === index && similarityModal?.answerIndex !== index
                        ? 'bg-white animate-card-light-shake'
                        : 'bg-white'
                  }`}
                >
                  {/* Couche colorée en fondu (délai 2s) — bloquée pendant le popup de similarité */}
                  {isRevealed && similarityModal?.answerIndex !== index && (
                    <div
                      key={`overlay-${index}-${isCorrect ? 'g' : 'r'}`}
                      className={`absolute inset-0 rounded-lg animate-reveal-fade ${
                        isCorrect ? 'bg-[#30c94d]' : 'bg-[#ff6b6b]'
                      }`}
                    />
                  )}

                  {/* Contenu au-dessus de la couche */}
                  <div className="relative p-2 md:p-4">
                    <div className="grid grid-cols-[1fr_4.5rem_0.5rem_4.5rem] md:grid-cols-[1fr_5rem_0.5rem_5rem] gap-1 md:gap-2 items-center">
                      <p
                        className={`text-xs md:text-base line-clamp-2 ${noResponse ? 'italic text-gray-500 font-normal' : 'font-bold text-black'}`}
                        title={getDisplayText(result.answer)}
                      >
                        {getDisplayText(result.answer)}
                      </p>

                      {/* Pilier a dit */}
                      <div className="flex flex-col items-center">
                        {result.guessedPlayerName && result.guessedPlayerName !== 'Personne' ? (
                          <>
                            <Avatar avatarId={result.guessedPlayerAvatarId ?? 0} name={result.guessedPlayerName} size="sm" className="md:hidden" />
                            <Avatar avatarId={result.guessedPlayerAvatarId ?? 0} name={result.guessedPlayerName} size="md" className="hidden md:block" />
                            <span className="text-[10px] md:text-xs font-semibold mt-0.5 md:mt-1 text-black" title={result.guessedPlayerName}>
                              {truncateName(result.guessedPlayerName, 6)}
                            </span>
                          </>
                        ) : (
                          <>
                            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gray-300 border-2 border-black flex items-center justify-center text-gray-600 font-bold text-sm md:text-lg shadow-md">
                              ?
                            </div>
                            <span className="text-[10px] md:text-xs font-semibold mt-0.5 md:mt-1 text-black">
                              Aucun
                            </span>
                          </>
                        )}
                      </div>

                      <div></div>

                      {/* Écrit par / bouton révéler */}
                      <div className="flex flex-col items-center">
                        {isRevealed ? (
                          <>
                            <Avatar avatarId={result.playerAvatarId ?? 0} name={result.playerName} size="sm" className="md:hidden" />
                            <Avatar avatarId={result.playerAvatarId ?? 0} name={result.playerName} size="md" className="hidden md:block" />
                            <span className="text-[10px] md:text-xs font-semibold text-black mt-0.5 md:mt-1" title={result.playerName}>
                              {truncateName(result.playerName, 6)}
                            </span>
                          </>
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

                  {/* Zone de clic couvrant toute la carte (vue pilier) */}
                  {isClickable && (
                    <button
                      type="button"
                      onClick={() => handleReveal(index)}
                      aria-label="Révéler cette réponse"
                      className="absolute inset-0 z-10 rounded-lg cursor-pointer hover:bg-yellow-400/10 active:bg-yellow-400/20 focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-500"
                    />
                  )}

                  {/* Icône main (Fluent emoji) qui apparaît avec 2s de délai + tap doux */}
                  {isClickable && (
                    <div
                      aria-hidden="true"
                      className="absolute -top-2 left-[30%] md:-top-1 md:left-[28%] z-20 pointer-events-none animate-hand-appear"
                    >
                      <span className="text-3xl md:text-4xl select-none drop-shadow-[2px_3px_0_rgba(0,0,0,0.25)]">
                        👇
                      </span>
                    </div>
                  )}
                </div>

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

      {allRevealed && (
        <div className="flex flex-col items-center gap-2 md:gap-3">
          <p className="text-base md:text-lg font-semibold">
            {isGameOver ? 'Partie terminée !' : 'Prêt pour la suite ?'}
          </p>
          <Button
            text={isGameOver ? 'Voir les résultats finaux' : 'Manche suivante'}
            variant='success'
            rotateEffect={true}
            onClick={handleNextRound}
          />
        </div>
      )}
    </div>
  );
};

export default RevealPhase;
