import { useEffect, useState, useRef } from 'react';
import socket from '../utils/socket';
import Timer from './Timer';
import { GameCard, IPlayer, RoundPhase } from '@onskone/shared';
import type { DrawingIdeaPick, GameSpeed } from '@onskone/shared';
import { getPhaseDuration } from '../constants/game';
import { playSound } from '../utils/sounds';
import WhiteboardWaiting from './WhiteboardWaiting';
import CardHand from './CardHand';
import { useSwipe } from '../hooks/useSwipe';
import { useSocketEvent } from '../hooks';
import { useLocale } from '../i18n';

const QuestionSelection = ({ lobbyCode, isLeader, leader, players, drawingIdea, currentPlayerId, roundNumber, gameSpeed, intro = false }: {
  lobbyCode: string;
  isLeader: boolean;
  currentPlayerId: string;
  roundNumber: number;
  leader: Pick<IPlayer, 'id' | 'name' | 'avatarId' | 'isPremium'>;
  /** Joueurs de la partie (pseudo du portrait, idée de dessin du tableau blanc). */
  players?: readonly Pick<IPlayer, 'id' | 'name'>[];
  /** Idée de dessin de la manche, tirée par le serveur (IRound.drawingIdea). */
  drawingIdea?: DrawingIdeaPick | null;
  gameSpeed: GameSpeed;
  /** « À ton tour d'être PILIER » affiché par-dessus : les cartes se retournent à sa fin. */
  intro?: boolean;
}) => {
  const { t } = useLocale();
  const [cards, setCards] = useState<GameCard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
  // Question tapée, en attente de ✅/❌ : rien n'est envoyé au serveur tant que
  // le pilier n'a pas confirmé (ou que le timer n'a pas expiré).
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  // Questions déjà jouées dans la partie : grisées et non sélectionnables.
  const [usedQuestions, setUsedQuestions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(isLeader);
  // Ref pour éviter de démarrer le timer plusieurs fois (React Strict Mode, re-renders)
  const timerStartedRef = useRef(false);

  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const hasInteractedRef = useRef(false);
  // Indices des cartes déjà retournées (dos -> face). Stagger reveal au démarrage.
  const [revealedIdx, setRevealedIdx] = useState<Set<number>>(new Set());

  const currentCard = cards.length > 0 ? cards[currentCardIndex] : null;
  const phaseDuration = getPhaseDuration(RoundPhase.QUESTION_SELECTION, gameSpeed);

  // Jouer le son au début de la phase
  useEffect(() => {
    playSound('questionSelection');
  }, []);

  useEffect(() => {
    // Petit délai pour laisser le temps aux listeners socket de s'initialiser sur tous les clients
    const startTimerTimeout = setTimeout(() => {
      // Vérifier si on n'a pas déjà démarré le timer pour éviter les doublons
      if (isLeader && !timerStartedRef.current) {
        timerStartedRef.current = true;
        // Le pilier demande 3 cartes
        socket.emit('requestQuestions', { lobbyCode, count: 3 });
        // (Re)montage = aucune bulle affichée : on oublie une éventuelle question en
        // attente d'un montage précédent (resync, reconnexion), sinon le serveur la
        // retiendrait à l'expiration alors que le pilier ne la voit plus sélectionnée.
        socket.emit('setPendingQuestion', { lobbyCode, question: null });
        socket.emit('startTimer', { lobbyCode, duration: phaseDuration });
      }
    }, 500);

    return () => clearTimeout(startTimerTimeout);
  }, [isLeader, lobbyCode, phaseDuration]);

  useSocketEvent('questionsReceived', (data: { questions: GameCard[]; usedQuestions?: string[] }) => {
    setUsedQuestions(new Set(data.usedQuestions ?? []));
    if (data.questions.length > 0) {
      setCards(data.questions);
      setCurrentCardIndex(0);
    }
    // Se recaler sur l'autorité serveur (corrige un éventuel décrément optimiste).
    setLoading(false);
  });

  // Stagger reveal : retourne la carte active d'abord, puis les autres dans l'ordre.
  // Pas sous l'intro du pilier : la donne se joue sous ses yeux, une fois l'overlay parti.
  useEffect(() => {
    if (cards.length === 0 || intro) return;
    setRevealedIdx(new Set());
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const order = [currentCardIndex, ...cards.map((_, i) => i).filter(i => i !== currentCardIndex)];
    order.forEach((idx, pos) => {
      const delay = 250 + pos * 220;
      timeouts.push(setTimeout(() => {
        setRevealedIdx(prev => {
          const next = new Set(prev);
          next.add(idx);
          return next;
        });
      }, delay));
    });
    return () => timeouts.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, intro]);

  const locked = selectedQuestion !== null;

  const submitQuestion = (question: string) => {
    setPendingQuestion(null);
    setSelectedQuestion(question);
    socket.emit('selectQuestion', { lobbyCode, selectedQuestion: question });
  };

  // Un tap n'envoie rien au serveur de jeu : il met la question en avant, le ✅ de la
  // popup l'envoie. Re-taper la même question l'annule ; taper à côté ne fait rien,
  // et taper une autre question remplace la sélection (ou changer de carte, cf. goToCard).
  const handleSelectQuestion = (question: string) => {
    if (!isLeader || selectedQuestion !== null || usedQuestions.has(question)) return;
    if (pendingQuestion === question) {
      handleCancelQuestion();
      return;
    }
    setPendingQuestion(question);
    // Le serveur expire avant le client : il doit connaître le choix pour l'auto-sélection.
    socket.emit('setPendingQuestion', { lobbyCode, question });
  };

  const handleCancelQuestion = () => {
    setPendingQuestion(null);
    socket.emit('setPendingQuestion', { lobbyCode, question: null });
  };

  const handleConfirmQuestion = () => {
    if (pendingQuestion === null || selectedQuestion !== null) return;
    submitQuestion(pendingQuestion);
  };

  const handleTimerExpire = () => {
    if (!isLeader) return;
    // Question en attente à l'expiration : elle EST la question choisie.
    if (selectedQuestion === null && pendingQuestion !== null && !usedQuestions.has(pendingQuestion)) {
      submitQuestion(pendingQuestion);
      return;
    }
    // Si pas de sélection, choisir une question au hasard dans la carte active
    // et l'émettre en premier, avant que le serveur ne pioche depuis une autre carte.
    if (selectedQuestion === null && currentCard && currentCard.questions.length > 0) {
      const unused = currentCard.questions.filter(q => !usedQuestions.has(q));
      const pickFrom = unused.length > 0 ? unused : currentCard.questions;
      const q = pickFrom[Math.floor(Math.random() * pickFrom.length)];
      submitQuestion(q);
      return;
    }
    socket.emit('timerExpired', { lobbyCode, phase: RoundPhase.QUESTION_SELECTION });
  };

  const goToCard = (idx: number) => {
    if (locked) return;
    const total = cards.length;
    if (total === 0) return;
    const next = ((idx % total) + total) % total;
    // La bulle est ancrée à une question de la carte quittée : on la ferme.
    // Seulement s'il y a une bulle : chaque swipe émettait sinon un `setPendingQuestion`
    // (rate-limité, le dépassement remonte en toast d'erreur au pilier).
    if (next !== currentCardIndex && pendingQuestion !== null) handleCancelQuestion();
    setCurrentCardIndex(next);
  };

  const goPrev = () => goToCard(currentCardIndex - 1);
  const goNext = () => goToCard(currentCardIndex + 1);

  // Affiche un indice de swipe si le pilier ne swipe pas dans les 5 premières
  // secondes (mobile). Laisser le temps de LIRE la carte avant de couvrir l'écran :
  // à 3s le rappel tombait alors que le pilier était encore en train de lire.
  // Compté depuis la fin de l'intro du pilier, pas sous l'overlay.
  useEffect(() => {
    if (!isLeader || loading || locked || cards.length < 2 || intro) return;
    if (hasInteractedRef.current) return;
    const t = setTimeout(() => {
      if (!hasInteractedRef.current) setShowSwipeHint(true);
    }, 5000);
    return () => clearTimeout(t);
  }, [isLeader, loading, locked, cards.length, intro]);

  const dismissSwipeHint = () => {
    hasInteractedRef.current = true;
    setShowSwipeHint(false);
  };

  // Détection de swipe (touch + souris) factorisée dans useSwipe ;
  // le touchstart masque le hint via onInteract.
  const swipeHandlers = useSwipe({
    onPrev: goPrev,
    onNext: goNext,
    onInteract: dismissSwipeHint,
  });

  if (!isLeader) {
    return (
      <>
        <Timer duration={phaseDuration} onExpire={handleTimerExpire} phase={RoundPhase.QUESTION_SELECTION} lobbyCode={lobbyCode} hidden />
        <WhiteboardWaiting lobbyCode={lobbyCode} playerId={currentPlayerId} roundNumber={roundNumber} leader={leader} players={players} drawingIdea={drawingIdea} />
      </>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-base md:text-lg text-gray-800">{t.phases.questionSelection.loading}</p>
        </div>
      </div>
    );
  }

  const handleCardClick = (idx: number) => {
    if (idx === currentCardIndex) return;
    goToCard(idx);
  };

  return (
    <div className="relative flex flex-col h-full p-2 tablet:p-4 overflow-hidden phone-landscape:overflow-y-auto overscroll-contain no-scrollbar">
      {currentCard && (
        <>
        {/* Zone cartes : scrollable si l'écran est trop court (iPhone SE). */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain no-scrollbar flex flex-col items-center">
          <div className="my-auto w-full flex flex-col items-center phone-landscape:my-0">
          <div className="bg-primary text-base tablet:text-xl px-3 tablet:px-6 py-1 tablet:py-1.5 rounded-2xl mb-0 w-full text-center">
            <p className="font-display text-base tablet:text-2xl m-0 tracking-tight leading-tight">
              {t.phases.questionSelection.chooseQuestion}
            </p>
            <Timer
              duration={phaseDuration}
              onExpire={handleTimerExpire}
              phase={RoundPhase.QUESTION_SELECTION}
              lobbyCode={lobbyCode}
              hidden
            />
          </div>

          <CardHand
            cards={cards}
            currentCardIndex={currentCardIndex}
            locked={locked}
            selectedQuestion={selectedQuestion}
            pendingQuestion={pendingQuestion}
            onConfirmQuestion={handleConfirmQuestion}
            onCancelQuestion={handleCancelQuestion}
            usedQuestions={usedQuestions}
            revealedIdx={revealedIdx}
            showSwipeHint={showSwipeHint}
            swipeHandlers={swipeHandlers}
            onDismissSwipeHint={dismissSwipeHint}
            onSelectQuestion={handleSelectQuestion}
            onCardClick={handleCardClick}
            onPrev={goPrev}
            onNext={goNext}
            onGoToCard={goToCard}
          />

          </div>
        </div>

        {/* Message de confirmation */}
        {locked && (
          <div className="shrink-0 text-center pt-2 pb-1 md:pt-3">
            <p className="text-white text-base md:text-xl font-semibold drop-shadow">
              {t.phases.questionSelection.selected}
            </p>
          </div>
        )}
        </>
      )}
    </div>
  );
};

export default QuestionSelection;
