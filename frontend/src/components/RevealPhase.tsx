import { useEffect, useState, useCallback, useRef } from 'react';
import { Icon } from '@iconify/react';
import socket from '../utils/socket';
import Button from './Button';
import Avatar from './Avatar';
import PlayerBadge from './PlayerBadge';
import RevealedAnswerCard from './RevealedAnswerCard';
import SimilarityPopover from './SimilarityPopover';
import { IPlayer, RevealResult, LeaderboardEntry, GameCard, GameMode } from '@onskone/shared';

interface RevealPhaseProps {
  lobbyCode: string;
  isLeader: boolean;
  leader: Pick<IPlayer, 'id' | 'name' | 'avatarId'>;
  currentPlayerId: string;
  isGameOver: boolean;
  results: RevealResult[];
  question: string;
  card?: GameCard;
  initialRevealedIndices?: number[];
  gameMode: GameMode;
}

const isPersonneGuess = (r: RevealResult) =>
  !r.guessedPlayerId || !r.guessedPlayerName || r.guessedPlayerName === 'Aucun' || r.guessedPlayerName === 'Personne';

const RevealPhase: React.FC<RevealPhaseProps> = ({ lobbyCode, isLeader, leader, currentPlayerId, isGameOver, results, initialRevealedIndices, gameMode }) => {
  const leaderId = leader.id;
  const [revealedIndices, setRevealedIndices] = useState<Set<number>>(
    new Set(initialRevealedIndices || [])
  );
  const [similarityModal, setSimilarityModal] = useState<{
    answerIndex: number;
    guessedPlayerName: string;
    playerName: string;
  } | null>(null);
  const [correctedIndices, setCorrectedIndices] = useState<Set<number>>(new Set());

  // Index de l'entrée que le pilier s'est attribuée à lui-même (mode "Devine ma réponse")
  // - on la garde pour la fin du reveal. Doit être calculé à partir de leaderId
  // (et non currentPlayerId) pour que tous les clients aient le même curseur initial.
  const pilierGuessedIdx = results.findIndex(r => r.guessedPlayerId === leaderId);

  // Curseur pilier : index de la réponse actuellement affichée au pilier.
  // L'entrée "pilier deviné" est repoussée en dernier : on la skip pendant l'itération
  // normale et on la renvoie uniquement quand toutes les autres ont été révélées.
  const findFirstDisplayable = useCallback((fromIdx: number, alreadyRevealed: Set<number>) => {
    for (let i = fromIdx; i < results.length; i++) {
      if (alreadyRevealed.has(i)) continue;
      if (isPersonneGuess(results[i])) continue;
      if (i === pilierGuessedIdx) continue;
      return i;
    }
    if (
      pilierGuessedIdx >= 0 &&
      !alreadyRevealed.has(pilierGuessedIdx) &&
      !isPersonneGuess(results[pilierGuessedIdx])
    ) {
      return pilierGuessedIdx;
    }
    return -1;
  }, [results, pilierGuessedIdx]);

  const [pilierCursor, setPilierCursor] = useState<number>(() =>
    findFirstDisplayable(0, new Set(initialRevealedIndices || []))
  );
  const [pilierPhase, setPilierPhase] = useState<'prompt' | 'revealed'>('prompt');
  // Le bouton "Suivant" apparaît 1s après la révélation
  const [showNextButton, setShowNextButton] = useState(false);
  // Joueur sans réponse attribuée : bascule en rouge après un court délai
  const [noAnswerLitRed, setNoAnswerLitRed] = useState(false);
  // Animation de reveal sur la carte joueur
  const [revealAnimating, setRevealAnimating] = useState(false);
  const prevMyRevealedRef = useRef(false);

  // Afficher le bouton Suivant 1s après passage en phase revealed
  useEffect(() => {
    if (pilierPhase !== 'revealed') {
      setShowNextButton(false);
      return;
    }
    const t = setTimeout(() => setShowNextButton(true), 1000);
    return () => clearTimeout(t);
  }, [pilierPhase, pilierCursor]);

  // Refs pour conserver les valeurs courantes sans re-souscrire les listeners socket
  const pilierCursorRef = useRef(pilierCursor);
  const isLeaderRef = useRef(isLeader);
  const gameModeRef = useRef(gameMode);
  useEffect(() => { pilierCursorRef.current = pilierCursor; }, [pilierCursor]);
  useEffect(() => { isLeaderRef.current = isLeader; }, [isLeader]);
  useEffect(() => { gameModeRef.current = gameMode; }, [gameMode]);

  useEffect(() => {
    const onAnswerRevealed = (data: { revealedIndex: number; revealedIndices: number[] }) => {
      setRevealedIndices(new Set(data.revealedIndices));
      setPilierPhase(prev => (data.revealedIndex === pilierCursorRef.current ? 'revealed' : prev));
    };
    const onSimilarityDetected = (data: { answerIndex: number; guessedPlayerName: string; playerName: string }) => {
      setSimilarityModal({
        answerIndex: data.answerIndex,
        guessedPlayerName: data.guessedPlayerName,
        playerName: data.playerName,
      });
    };
    const onSimilarityConfirmed = (data: { answerIndex: number; correctedScore: number; leaderboard: LeaderboardEntry[] }) => {
      setCorrectedIndices(prev => new Set(prev).add(data.answerIndex));
      setSimilarityModal(null);
    };
    const onSimilarityDismissed = () => {
      setSimilarityModal(null);
    };
    const onRevealCursorAdvanced = (data: { nextIndex: number }) => {
      if (!isLeaderRef.current && gameModeRef.current === 'remote') {
        setPilierCursor(data.nextIndex);
        setPilierPhase('prompt');
        setShowNextButton(false);
      }
    };

    socket.on('answerRevealed', onAnswerRevealed);
    socket.on('similarityDetected', onSimilarityDetected);
    socket.on('similarityConfirmed', onSimilarityConfirmed);
    socket.on('similarityDismissed', onSimilarityDismissed);
    socket.on('revealCursorAdvanced', onRevealCursorAdvanced);

    return () => {
      socket.off('answerRevealed', onAnswerRevealed);
      socket.off('similarityDetected', onSimilarityDetected);
      socket.off('similarityConfirmed', onSimilarityConfirmed);
      socket.off('similarityDismissed', onSimilarityDismissed);
      socket.off('revealCursorAdvanced', onRevealCursorAdvanced);
    };
  }, []);

  // Auto-reveal silencieux des réponses où le pilier avait ciblé "Personne".
  // On garde une ref des indices déjà émis pour éviter le flood d'événements
  // à chaque re-render (results ou revealedIndices change).
  const sentRevealsRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (!isLeader) return;
    results.forEach((r, idx) => {
      if (isPersonneGuess(r) && !revealedIndices.has(idx) && !sentRevealsRef.current.has(idx)) {
        sentRevealsRef.current.add(idx);
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
    if (gameMode === 'remote') {
      socket.emit('advanceRevealCursor', { lobbyCode, nextIndex: next });
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

  const totalAnswers = results.length;
  const revealedCount = revealedIndices.size;
  const allRevealed = revealedCount >= totalAnswers;

  // ============================================================
  // VUE JOUEUR (non-pilier) - carte unique de la réponse attribuée
  // ============================================================
  const myIndex = !isLeader ? results.findIndex(r => r.guessedPlayerId === currentPlayerId) : -1;
  const myResult = myIndex >= 0 ? results[myIndex] : null;

  useEffect(() => {
    if (isLeader) return;
    if (myResult) return;
    const t = setTimeout(() => setNoAnswerLitRed(true), 1200);
    return () => clearTimeout(t);
  }, [isLeader, myResult]);

  // Déclenche l'animation de reveal côté joueur quand sa carte est révélée
  // (mais pas tant qu'une similarité est en attente de validation par le pilier)
  useEffect(() => {
    if (isLeader) return;
    const awaitingSim = myIndex >= 0 && similarityModal?.answerIndex === myIndex;
    const myRev = myIndex >= 0 && revealedIndices.has(myIndex) && !awaitingSim;
    if (myRev && !prevMyRevealedRef.current) {
      setRevealAnimating(true);
      const t = setTimeout(() => setRevealAnimating(false), 500);
      prevMyRevealedRef.current = true;
      return () => clearTimeout(t);
    }
    if (!myRev) prevMyRevealedRef.current = false;
  }, [isLeader, myIndex, revealedIndices, similarityModal]);

  if (!isLeader && gameMode === 'local') {
    const myAwaitingSimilarity = myIndex >= 0 && similarityModal?.answerIndex === myIndex;
    const myRevealed = myIndex >= 0 && revealedIndices.has(myIndex) && !myAwaitingSimilarity;
    const myCorrect = myResult ? (myResult.correct || correctedIndices.has(myIndex)) : false;
    // Tant qu'une similarité est en attente, on retire l'index concerné des "déjà révélés"
    // pour TOUS les joueurs : le joueur ciblé garde son pulse, et les suivants n'avancent
    // pas (ils ne deviennent pas "next" tant que le pilier n'a pas tranché).
    const effectiveRevealed = similarityModal
      ? new Set(Array.from(revealedIndices).filter(i => i !== similarityModal.answerIndex))
      : revealedIndices;
    const isNextToReveal = !myRevealed && myIndex >= 0 && myIndex === findFirstDisplayable(0, effectiveRevealed);

    const waitingFooter = allRevealed ? (
      <div className="flex items-center justify-center flex-wrap gap-x-2 gap-y-1 leading-none text-gray-900 text-base tablet:text-lg phone-landscape:text-xs">
        <span>En attente que</span>
        <Avatar avatarId={leader?.avatarId ?? 0} name={leader?.name} size="sm" />
        <span>{leader?.name}</span>
        <span>{isGameOver ? 'révèle les résultats finaux…' : 'lance la manche suivante…'}</span>
      </div>
    ) : undefined;

    const rotateHint = (
      <p className="landscape:hidden flex items-center gap-1.5 text-xs text-gray-500/80 shrink-0">
        <Icon icon="mdi:phone-rotate-landscape" width={14} height={14} aria-hidden />
        Tourne ton téléphone pour un affichage plus large
      </p>
    );

    if (myResult) {
      return (
        <RevealedAnswerCard
          result={myResult}
          revealed={myRevealed}
          correct={myCorrect}
          cardClassName={`${isNextToReveal ? 'animate-card-soft-pulse' : ''} ${revealAnimating ? 'animate-reveal-pop' : ''}`}
          footer={
            <>
              {waitingFooter && <div className="shrink-0 mt-1">{waitingFooter}</div>}
              {rotateHint}
            </>
          }
        />
      );
    }

    // Pas de réponse attribuée : on réutilise RevealedAnswerCard avec showBubble=false
    // pour garder la même structure (header "Montre ton écran" + stickman + carte
    // + footer) sans la bulle "Écrit par". Le bg de la carte bascule en rouge via
    // `revealed=true correct=false` quand le timer noAnswerLitRed est passé.
    const noAnswerResult: RevealResult = {
      playerId: '',
      playerName: '',
      playerAvatarId: 0,
      answer: `${leader.name} ne t'a attribué aucune réponse`,
      guessedPlayerId: '',
      guessedPlayerName: '',
      guessedPlayerAvatarId: 0,
      correct: false,
    };
    return (
      <RevealedAnswerCard
        result={noAnswerResult}
        revealed={noAnswerLitRed}
        correct={false}
        showBubble={false}
        cardClassName="transition-colors duration-500"
        footer={
          <>
            {waitingFooter && <div className="shrink-0 mt-1">{waitingFooter}</div>}
            {rotateHint}
          </>
        }
      />
    );
  }

  // ============================================================
  // VUE PILIER - une seule carte à la fois, avatar du joueur ciblé
  // ============================================================
  const currentResult = pilierCursor >= 0 ? results[pilierCursor] : null;
  // Ordre d'affichage : entrées normales dans l'ordre du tableau, puis l'entrée
  // "pilier deviné" en dernier (mode "Devine ma réponse").
  const displayOrder = results
    .map((_, i) => i)
    .filter(i => !isPersonneGuess(results[i]) && i !== pilierGuessedIdx);
  if (pilierGuessedIdx >= 0 && !isPersonneGuess(results[pilierGuessedIdx])) {
    displayOrder.push(pilierGuessedIdx);
  }
  const displayableTotal = displayOrder.length;
  const displayablePosition = currentResult
    ? displayOrder.indexOf(pilierCursor) + 1
    : displayableTotal;

  const showSimilarity = !!(currentResult && similarityModal?.answerIndex === pilierCursor);
  const nextDisplayableIdx =
    pilierCursor >= 0 ? findFirstDisplayable(pilierCursor + 1, revealedIndices) : -1;
  const isLastDisplayable = pilierCursor >= 0 && nextDisplayableIdx === -1;
  const showEndButton =
    isLastDisplayable && pilierPhase === 'revealed' && showNextButton && !showSimilarity;
  // Mode "Devine ma réponse" : entrée où le pilier s'est attribué une réponse
  const isPilierGuessedCard =
    !!currentResult && currentResult.guessedPlayerId === leaderId;
  const pilierCardRevealed = isPilierGuessedCard && pilierPhase === 'revealed';
  const pilierCardCorrect =
    isPilierGuessedCard && (currentResult!.correct || correctedIndices.has(pilierCursor));

  // ============================================================
  // VUE REMOTE - bulle Écrit par + carte (sans stickman ni "Montre ton écran")
  // Réutilise la disposition de la vue joueur locale pour tous les joueurs.
  // ============================================================
  if (gameMode === 'remote') {
    if (!currentResult) {
      return (
        <div className="flex flex-col h-full p-2 max-w-2xl mx-auto" style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}>
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-2 py-4">
            {isGameOver ? (
              <p className="text-base md:text-lg font-semibold text-center">Partie terminée !</p>
            ) : isLeader ? (
              <p className="text-base md:text-lg font-semibold text-center">Prêt pour la suite ?</p>
            ) : (
              <div className="flex items-center justify-center flex-wrap gap-x-2 gap-y-1 leading-none text-base md:text-lg">
                <span>En attente que</span>
                <Avatar avatarId={leader?.avatarId ?? 0} name={leader?.name} size="sm" />
                <span>{leader?.name}</span>
                <span>lance la manche suivante…</span>
              </div>
            )}
            {isLeader && (
              <Button
                text={isGameOver ? 'Voir les résultats finaux' : 'Manche suivante'}
                variant="success"
                rotateEffect
                onClick={handleNextRound}
              />
            )}
          </div>
        </div>
      );
    }

    // Tant que la popup de similarité est ouverte, on garde la carte non-colorée
    // (le pilier doit trancher Oui/Non avant que la couleur correct/incorrect s'affiche).
    const cardRevealed = pilierPhase === 'revealed' && !showSimilarity;
    const cardCorrect = currentResult.correct || correctedIndices.has(pilierCursor);

    return (
      <RevealedAnswerCard
        result={currentResult}
        revealed={cardRevealed}
        correct={cardCorrect}
        cardClassName={cardRevealed ? 'animate-reveal-pop' : ''}
        swapAnimation
        rowKey={`remote-card-${pilierCursor}`}
        showStickman={false}
        header={
          !isLeader ? (
            <div className="flex items-center gap-2">
              <PlayerBadge player={leader} size="sm" />
              <p className="text-gray-500 text-xs md:text-sm italic m-0">révèle les résultats…</p>
            </div>
          ) : (
            <p className="text-gray-900 text-sm md:text-base font-semibold text-center">
              Réponse attribuée à <span className="text-brand-500">{currentResult.guessedPlayerName}</span>
            </p>
          )
        }
        footer={
          <>
            {showSimilarity && isLeader && (
              <SimilarityPopover
                guessedPlayerName={similarityModal!.guessedPlayerName}
                playerName={similarityModal!.playerName}
                isLeader={isLeader}
                onConfirm={handleConfirmSimilarity}
                onDismiss={handleDismissSimilarity}
              />
            )}

            <p className="text-gray-700 text-xs md:text-sm mt-1">
              {displayablePosition}/{displayableTotal}
            </p>

            {isLeader && (
              <div className="mt-3 md:mt-4 flex items-center justify-center">
                {showEndButton ? (
                  <div className="animate-fade-in">
                    <Button
                      text={isGameOver ? 'Voir les résultats finaux' : 'Manche suivante'}
                      variant="success"
                      size="lg"
                      rotateEffect
                      disabled={showSimilarity}
                      onClick={handleNextRound}
                    />
                  </div>
                ) : pilierPhase === 'revealed' && showNextButton && !isLastDisplayable ? (
                  <div key={`next-${pilierCursor}`} className="animate-fade-in">
                    <Button
                      text="Suivant"
                      variant="primary"
                      size="lg"
                      rotateEffect
                      disabled={showSimilarity}
                      onClick={handleNext}
                    />
                  </div>
                ) : (
                  <Button
                    text="Révéler"
                    variant="primary"
                    size="lg"
                    rotateEffect
                    disabled={showSimilarity || pilierPhase === 'revealed'}
                    onClick={handleReveal}
                  />
                )}
              </div>
            )}
          </>
        }
      />
    );
  }

  // Vue spéciale "pilier deviné" - reproduit exactement la mise en page de la
  // carte reçue par les autres joueurs, sans l'indication "tourne ton téléphone".
  if (isPilierGuessedCard && currentResult) {
    return (
      <RevealedAnswerCard
        result={currentResult}
        revealed={pilierCardRevealed}
        correct={pilierCardCorrect}
        cardClassName={pilierCardRevealed ? 'animate-reveal-pop' : ''}
        swapAnimation
        rowKey={`pilier-big-${pilierCursor}`}
        footer={
          <>
            {showSimilarity && isLeader && (
              <SimilarityPopover
                guessedPlayerName={similarityModal!.guessedPlayerName}
                playerName={similarityModal!.playerName}
                isLeader={isLeader}
                onConfirm={handleConfirmSimilarity}
                onDismiss={handleDismissSimilarity}
              />
            )}

            <p className="text-gray-700 text-xs md:text-sm mt-1">
              {displayablePosition}/{displayableTotal}
            </p>

            <div className="mt-3 md:mt-4 flex items-center justify-center">
              {showEndButton ? (
                <div className="animate-fade-in">
                  <Button
                    text={isGameOver ? 'Voir les résultats finaux' : 'Manche suivante'}
                    variant="success"
                    size="lg"
                    rotateEffect
                    disabled={showSimilarity}
                    onClick={handleNextRound}
                  />
                </div>
              ) : (
                <Button
                  text="Révéler"
                  variant="primary"
                  size="lg"
                  rotateEffect
                  disabled={showSimilarity || pilierPhase === 'revealed'}
                  onClick={handleReveal}
                />
              )}
            </div>
          </>
        }
      />
    );
  }

  return (
    <div
      className="flex flex-col h-full p-2 max-w-2xl mx-auto"
      style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="flex flex-col items-center gap-3 md:gap-4 px-2 py-3">
        {currentResult ? (
          <>
            <div className="flex flex-col items-center justify-center gap-3 md:gap-4 w-full">
              <div className="relative flex items-center justify-center gap-3 md:gap-5 w-full">
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
                    className="relative z-10 bg-cream-player rounded-2xl border border-black stack-shadow-sm texture-paper px-8 py-6 md:px-12 md:py-8 flex flex-col items-center gap-3 animate-reveal-card-swap transition-colors duration-500"
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

                {/* Bouton Suivant à droite de la carte - pilier uniquement */}
                <div className="relative z-20 w-16 md:w-24 shrink-0 flex justify-start">
                  {isLeader && showNextButton && !showSimilarity && !isLastDisplayable && (
                    <button
                      key={`next-${pilierCursor}`}
                      type="button"
                      onClick={handleNext}
                      aria-label="Suivant"
                      className="animate-next-pop group flex flex-col items-center gap-1 cursor-pointer text-black hover:text-brand-500 transition-colors"
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

                {/* Popover similarité - flotte sous la carte, ne pousse rien */}
                {showSimilarity && (
                  <div className="absolute left-1/2 -translate-x-1/2 top-full z-30 pt-2">
                    <SimilarityPopover
                      guessedPlayerName={similarityModal!.guessedPlayerName}
                      playerName={similarityModal!.playerName}
                      isLeader={true}
                      onConfirm={handleConfirmSimilarity}
                      onDismiss={handleDismissSimilarity}
                    />
                  </div>
                )}
              </div>

              <div className="text-center px-2 mt-1 md:mt-2">
                <p className="text-gray-900 text-sm md:text-base font-semibold">
                  Regarde son écran !
                </p>
                <p className="text-gray-700 text-xs md:text-sm mt-0.5">
                  {displayablePosition}/{displayableTotal}
                </p>
              </div>
            </div>

            {isLeader && !showEndButton && (
              <Button
                text="Révéler sur son téléphone"
                variant="primary"
                size="lg"
                rotateEffect
                disabled={showSimilarity || pilierPhase === 'revealed'}
                onClick={handleReveal}
                className="!text-sm sm:!text-base whitespace-nowrap"
              />
            )}

            {isLeader && showEndButton && (
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
