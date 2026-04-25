import { useEffect, useState, useCallback } from 'react';
import socket from '../utils/socket';
import Button from './Button';
import Avatar from './Avatar';
import PlayerAnswerCard from './PlayerAnswerCard';
import SimilarityPopover from './SimilarityPopover';
import ShowScreenFrame from './ShowScreenFrame';
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

const isPersonneGuess = (r: RevealResult) =>
  !r.guessedPlayerId || !r.guessedPlayerName || r.guessedPlayerName === 'Aucun' || r.guessedPlayerName === 'Personne';

const RevealPhase: React.FC<RevealPhaseProps> = ({ lobbyCode, isLeader, leaderName, currentPlayerId, isGameOver, results, initialRevealedIndices }) => {
  const [revealedIndices, setRevealedIndices] = useState<Set<number>>(
    new Set(initialRevealedIndices || [])
  );
  const [similarityModal, setSimilarityModal] = useState<{
    answerIndex: number;
    guessedPlayerName: string;
  } | null>(null);
  const [correctedIndices, setCorrectedIndices] = useState<Set<number>>(new Set());

  // Curseur pilier : index de la réponse actuellement affichée au pilier
  const findFirstDisplayable = useCallback((fromIdx: number, alreadyRevealed: Set<number>) => {
    for (let i = fromIdx; i < results.length; i++) {
      if (alreadyRevealed.has(i)) continue;
      if (isPersonneGuess(results[i])) continue;
      return i;
    }
    return -1;
  }, [results]);

  const [pilierCursor, setPilierCursor] = useState<number>(() =>
    findFirstDisplayable(0, new Set(initialRevealedIndices || []))
  );
  const [pilierPhase, setPilierPhase] = useState<'prompt' | 'revealed'>('prompt');
  // Le bouton "Suivant" apparaît 1s après la révélation
  const [showNextButton, setShowNextButton] = useState(false);
  // Joueur sans réponse attribuée : bascule en rouge après un court délai
  const [noAnswerLitRed, setNoAnswerLitRed] = useState(false);

  // Afficher le bouton Suivant 1s après passage en phase revealed
  useEffect(() => {
    if (pilierPhase !== 'revealed') {
      setShowNextButton(false);
      return;
    }
    const t = setTimeout(() => setShowNextButton(true), 1000);
    return () => clearTimeout(t);
  }, [pilierPhase, pilierCursor]);

  useEffect(() => {
    socket.on('answerRevealed', (data: { revealedIndex: number; revealedIndices: number[] }) => {
      setRevealedIndices(new Set(data.revealedIndices));
      setPilierPhase(prev => {
        // Si c'est l'index affiché au pilier qui vient d'être révélé, on passe en phase Suivant
        return data.revealedIndex === pilierCursor ? 'revealed' : prev;
      });
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
  }, [pilierCursor]);

  // Auto-reveal silencieux de toutes les réponses où le pilier avait ciblé "Personne".
  // Ces réponses ne sont jamais affichées sur son écran mais doivent être marquées
  // revealed côté backend pour que allRevealed devienne vrai.
  useEffect(() => {
    if (!isLeader) return;
    results.forEach((r, idx) => {
      if (isPersonneGuess(r) && !revealedIndices.has(idx)) {
        socket.emit('revealAnswer', { lobbyCode, answerIndex: idx });
      }
    });
  }, [isLeader, results, revealedIndices, lobbyCode]);

  const handleReveal = () => {
    if (pilierCursor < 0 || similarityModal) return;
    if (revealedIndices.has(pilierCursor)) {
      setPilierPhase('revealed');
      return;
    }
    socket.emit('revealAnswer', { lobbyCode, answerIndex: pilierCursor });
  };

  const handleNext = () => {
    const next = findFirstDisplayable(pilierCursor + 1, revealedIndices);
    setPilierCursor(next);
    setPilierPhase('prompt');
    setShowNextButton(false);
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

  const totalAnswers = results.length;
  const revealedCount = revealedIndices.size;
  const allRevealed = revealedCount >= totalAnswers;

  // ============================================================
  // VUE JOUEUR (non-pilier) — carte unique de la réponse attribuée
  // ============================================================
  const myIndex = !isLeader ? results.findIndex(r => r.guessedPlayerId === currentPlayerId) : -1;
  const myResult = myIndex >= 0 ? results[myIndex] : null;

  useEffect(() => {
    if (isLeader) return;
    if (myResult) return;
    const t = setTimeout(() => setNoAnswerLitRed(true), 1200);
    return () => clearTimeout(t);
  }, [isLeader, myResult]);

  if (!isLeader) {
    const myAwaitingSimilarity = myIndex >= 0 && similarityModal?.answerIndex === myIndex;
    const myRevealed = myIndex >= 0 && revealedIndices.has(myIndex) && !myAwaitingSimilarity;
    const myCorrect = myResult ? (myResult.correct || correctedIndices.has(myIndex)) : false;

    return (
      <div className="flex flex-col h-full p-2 max-w-2xl mx-auto">
        <div className="flex-1 flex flex-col items-center justify-center gap-4 md:gap-6 px-2">
          {myResult ? (
            <>
              <ShowScreenFrame>
                <PlayerAnswerCard
                  answer={getDisplayText(myResult.answer)}
                  isNoResponse={isNoResponse(myResult.answer)}
                  bgClass={myRevealed ? (myCorrect ? 'bg-[#30c94d]' : 'bg-[#ff6b6b]') : 'bg-cream-answer'}
                  className="transition-colors duration-500"
                  heading={null}
                />
              </ShowScreenFrame>

              {/* Avatar de l'auteur réel (vide avant reveal, fade-in au reveal) */}
              <div className="flex flex-col items-center gap-2">
                <p className="text-gray-700 text-xs md:text-sm font-semibold uppercase">Écrit par</p>
                <div className="relative w-16 h-16 md:w-20 md:h-20">
                  <div
                    className={`absolute inset-0 rounded-full bg-gray-200 border-2 border-dashed border-gray-400 flex items-center justify-center text-gray-500 font-bold text-xl md:text-2xl shadow-md transition-opacity duration-500 ${
                      myRevealed ? 'opacity-0' : 'opacity-100'
                    }`}
                  >
                    ?
                  </div>
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
              <ShowScreenFrame>
                <PlayerAnswerCard
                  answer="Le pilier ne t'a attribué aucune réponse"
                  bgClass={noAnswerLitRed ? 'bg-[#ff6b6b]' : 'bg-cream-answer'}
                  className="transition-colors duration-500"
                  heading={null}
                />
              </ShowScreenFrame>
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
  // VUE PILIER — une seule carte à la fois, avatar du joueur ciblé
  // ============================================================
  const currentResult = pilierCursor >= 0 ? results[pilierCursor] : null;
  // Position "humaine" du curseur parmi les cartes affichables (hors Personne déjà filtrées)
  const displayableTotal = results.filter(r => !isPersonneGuess(r)).length;
  const displayablePosition = currentResult
    ? results.slice(0, pilierCursor + 1).filter(r => !isPersonneGuess(r)).length
    : displayableTotal;

  const showSimilarity = !!(currentResult && similarityModal?.answerIndex === pilierCursor);
  const nextDisplayableIdx =
    pilierCursor >= 0 ? findFirstDisplayable(pilierCursor + 1, revealedIndices) : -1;
  const isLastDisplayable = pilierCursor >= 0 && nextDisplayableIdx === -1;
  const showEndButton =
    isLastDisplayable && pilierPhase === 'revealed' && showNextButton && !showSimilarity;

  return (
    <div
      className="flex flex-col h-full p-2 max-w-2xl mx-auto"
      style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="flex-1 flex flex-col items-center justify-between gap-4 md:gap-6 px-2 py-4">
        {currentResult ? (
          <>
            <div className="flex-1 flex flex-col items-center justify-center gap-3 md:gap-4 w-full">
              <div className="flex items-center justify-center gap-3 md:gap-5 w-full">
                {/* Spacer miroir pour que la carte reste centrée */}
                <div className="w-14 md:w-20 shrink-0" aria-hidden />

                <div className="relative">
                  {/* Tranche d'une "prochaine" carte qui dépasse à droite, inclinée et fondue */}
                  {!isLastDisplayable && (
                    <div
                      aria-hidden
                      className="absolute top-3 bottom-3 bg-cream-player rounded-r-2xl border border-black border-l-0 pointer-events-none"
                      style={{
                        left: 'calc(100% - 0.75rem)',
                        width: '2.5rem',
                        zIndex: 0,
                        transform: 'rotate(5deg)',
                        transformOrigin: 'left center',
                        opacity: 0.45,
                      }}
                    />
                  )}

                  <div
                    key={`pilier-card-${pilierCursor}`}
                    className="relative z-10 bg-cream-player rounded-2xl border border-black stack-shadow-sm texture-paper px-8 py-6 md:px-12 md:py-8 flex flex-col items-center gap-3 animate-reveal-card-swap"
                  >
                    <Avatar
                      avatarId={currentResult.guessedPlayerAvatarId ?? 0}
                      name={currentResult.guessedPlayerName}
                      size="xl"
                    />
                    <span className="text-base md:text-lg font-bold text-black">
                      {currentResult.guessedPlayerName}
                    </span>
                  </div>
                </div>

                {/* Bouton Suivant à droite de la carte — apparaît 1s après le reveal (sauf dernier) */}
                <div className="w-16 md:w-24 shrink-0 flex justify-start">
                  {showNextButton && !showSimilarity && !isLastDisplayable && (
                    <button
                      key={`next-${pilierCursor}`}
                      type="button"
                      onClick={handleNext}
                      aria-label="Suivant"
                      className="animate-next-pop group flex flex-col items-center gap-1 cursor-pointer text-black hover:text-[#1AAFDA] transition-colors"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-10 h-10 md:w-12 md:h-12 transition-transform group-hover:translate-x-1 group-active:scale-95"
                        aria-hidden
                      >
                        <path d="M5 12h14" />
                        <path d="M13 5l7 7-7 7" />
                      </svg>
                      <span className="font-display text-[11px] md:text-sm font-bold uppercase tracking-wider">
                        Suivant
                      </span>
                    </button>
                  )}
                </div>
              </div>

              <div className="text-center px-2 mt-1 md:mt-2">
                <p className="text-gray-900 text-sm md:text-base font-semibold">
                  Regarde l'écran de <span className="text-[#1AAFDA]">{currentResult.guessedPlayerName}</span> !
                </p>
                <p className="text-gray-700 text-xs md:text-sm mt-0.5">
                  {displayablePosition}/{displayableTotal}
                </p>
              </div>
            </div>

            {showSimilarity && (
              <SimilarityPopover
                guessedPlayerName={similarityModal!.guessedPlayerName}
                isLeader={true}
                onConfirm={handleConfirmSimilarity}
                onDismiss={handleDismissSimilarity}
              />
            )}

            {!showSimilarity && !showEndButton && (
              <Button
                text="Révéler sur son téléphone"
                variant="primary"
                size="lg"
                rotateEffect
                disabled={pilierPhase === 'revealed'}
                onClick={handleReveal}
              />
            )}

            {showEndButton && (
              <div className="animate-fade-in">
                <Button
                  text={isGameOver ? 'Voir les résultats finaux' : 'Manche suivante'}
                  variant="success"
                  size="lg"
                  rotateEffect
                  onClick={handleNextRound}
                />
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 md:gap-3">
            <p className="text-base md:text-lg font-semibold">
              {isGameOver ? 'Partie terminée !' : 'Prêt pour la suite ?'}
            </p>
            <Button
              text={isGameOver ? 'Voir les résultats finaux' : 'Manche suivante'}
              variant="success"
              rotateEffect
              onClick={handleNextRound}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default RevealPhase;
