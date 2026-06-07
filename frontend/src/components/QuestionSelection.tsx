import { useEffect, useState, useRef } from 'react';
import socket from '../utils/socket';
import Timer from './Timer';
import { GameCard, IPlayer, RoundPhase } from '@onskone/shared';
import { getPhaseDuration } from '../constants/game';
import { getRandomFunFact, getNextFunFact } from '../constants/funFacts';
import { playSound } from '../utils/sounds';
import PlayerBadge from './PlayerBadge';
import ReportTrigger from './ReportTrigger';
import CardHand from './CardHand';
import { useSwipe } from '../hooks/useSwipe';
import { useSocketEvent } from '../hooks';
import { useLocale } from '../i18n';

const QuestionSelection = ({ lobbyCode, isLeader, leader, timeMultiplier }: {
  lobbyCode: string;
  isLeader: boolean;
  leader: Pick<IPlayer, 'id' | 'name' | 'avatarId'>;
  timeMultiplier: number;
}) => {
  const { t } = useLocale();
  const [cards, setCards] = useState<GameCard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(isLeader);
  const [funFact, setFunFact] = useState<string>(() => getRandomFunFact(t.funFacts));
  const [factFading, setFactFading] = useState(false);
  const factFadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref pour éviter de démarrer le timer plusieurs fois (React Strict Mode, re-renders)
  const timerStartedRef = useRef(false);

  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const hasInteractedRef = useRef(false);
  // Indices des cartes déjà retournées (dos -> face). Stagger reveal au démarrage.
  const [revealedIdx, setRevealedIdx] = useState<Set<number>>(new Set());

  const currentCard = cards.length > 0 ? cards[currentCardIndex] : null;
  const phaseDuration = getPhaseDuration(RoundPhase.QUESTION_SELECTION, timeMultiplier);

  // Jouer le son au début de la phase
  useEffect(() => {
    playSound('questionSelection');
  }, []);

  // Effet pour changer les faits insolites toutes les 12 secondes (pour les non-leaders)
  useEffect(() => {
    if (isLeader) return;

    const factInterval = setInterval(() => {
      setFactFading(true);
      // Annule un éventuel fondu en cours avant d'en programmer un nouveau
      if (factFadeTimeoutRef.current) {
        clearTimeout(factFadeTimeoutRef.current);
      }
      factFadeTimeoutRef.current = setTimeout(() => {
        setFunFact(prev => getNextFunFact(t.funFacts, prev));
        setFactFading(false);
      }, 300); // Durée du fade out avant de changer
    }, 12000);

    return () => {
      clearInterval(factInterval);
      if (factFadeTimeoutRef.current) {
        clearTimeout(factFadeTimeoutRef.current);
      }
    };
  }, [isLeader, t.funFacts]);

  useEffect(() => {
    // Petit délai pour laisser le temps aux listeners socket de s'initialiser sur tous les clients
    const startTimerTimeout = setTimeout(() => {
      // Vérifier si on n'a pas déjà démarré le timer pour éviter les doublons
      if (isLeader && !timerStartedRef.current) {
        timerStartedRef.current = true;
        // Le pilier demande 3 cartes
        socket.emit('requestQuestions', { lobbyCode, count: 3 });
        socket.emit('startTimer', { lobbyCode, duration: phaseDuration });
      }
    }, 500);

    return () => clearTimeout(startTimerTimeout);
  }, [isLeader, lobbyCode, phaseDuration]);

  useSocketEvent('questionsReceived', (data: { questions: GameCard[] }) => {
    if (data.questions.length > 0) {
      setCards(data.questions);
      setCurrentCardIndex(0);
    }
    setLoading(false);
  });

  // Stagger reveal : retourne la carte active d'abord, puis les autres dans l'ordre
  useEffect(() => {
    if (cards.length === 0) return;
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
  }, [cards]);

  const locked = selectedQuestion !== null;

  const handleSelectQuestion = (question: string) => {
    if (!isLeader || selectedQuestion !== null) return;

    setSelectedQuestion(question);
    socket.emit('selectQuestion', { lobbyCode, selectedQuestion: question });
  };

  const handleTimerExpire = () => {
    if (!isLeader) return;
    // Si pas de sélection, choisir une question au hasard dans la carte active
    // et l'émettre en premier, avant que le serveur ne pioche depuis une autre carte.
    if (selectedQuestion === null && currentCard && currentCard.questions.length > 0) {
      const q = currentCard.questions[Math.floor(Math.random() * currentCard.questions.length)];
      setSelectedQuestion(q);
      socket.emit('selectQuestion', { lobbyCode, selectedQuestion: q });
      return;
    }
    socket.emit('timerExpired', { lobbyCode });
  };

  const goToCard = (idx: number) => {
    if (locked) return;
    const total = cards.length;
    if (total === 0) return;
    const next = ((idx % total) + total) % total;
    setCurrentCardIndex(next);
  };

  const goPrev = () => goToCard(currentCardIndex - 1);
  const goNext = () => goToCard(currentCardIndex + 1);

  // Affiche un indice de swipe si le pilier ne swipe pas dans les 3 premières secondes (mobile)
  useEffect(() => {
    if (!isLeader || loading || locked || cards.length < 2) return;
    if (hasInteractedRef.current) return;
    const t = setTimeout(() => {
      if (!hasInteractedRef.current) setShowSwipeHint(true);
    }, 3000);
    return () => clearTimeout(t);
  }, [isLeader, loading, locked, cards.length]);

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
      <div className="flex flex-col items-center justify-center h-full w-full gap-2 md:gap-6 px-2 overflow-hidden">
        <div className="text-center w-full max-w-2xl">
          <div className="bg-primary-light rounded-lg px-3 md:px-4 py-1.5 md:py-2 max-w-2xl">
            <div className="flex items-center justify-center flex-wrap gap-x-1.5 gap-y-1">
              <p className="text-base md:text-2xl m-0">{t.phases.questionSelection.leaderIs}</p>
              <PlayerBadge player={leader} size="sm" />
            </div>
            <p className="text-center text-xs md:text-base mt-1.5">{t.phases.questionSelection.waitingSelection}</p>
            <Timer duration={phaseDuration} onExpire={handleTimerExpire} phase={RoundPhase.QUESTION_SELECTION} lobbyCode={lobbyCode} hidden />
          </div>
        </div>

        {/* Fait insolite - min-h figée pour que le changement de fait
            ne décale pas l'emoji situé en dessous. mt-* descend le bloc. */}
        <div className="w-full max-w-md text-center px-3 mt-4 md:mt-8 min-h-[72px] md:min-h-[88px] flex flex-col justify-start">
          <p className="text-[10px] md:text-xs text-gray-500 uppercase font-semibold mb-1">{t.phases.questionSelection.didYouKnow}</p>
          <p
            className={`text-gray-700 text-xs md:text-base italic leading-snug transition-opacity duration-300 ${factFading ? 'opacity-0' : 'opacity-100'}`}
          >
            {funFact}
          </p>
        </div>
      </div>
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
    if (locked) return;
    if (idx === currentCardIndex) return;
    setCurrentCardIndex(idx);
  };

  return (
    <div className="flex flex-col h-full p-2 tablet:p-4 overflow-hidden">
      {currentCard && (
        <div className="flex-1 flex flex-col items-center justify-center">
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

          {/* Signaler une question pourrie (pilier uniquement, tant que pas verrouillé) */}
          {!locked && currentCard && (
            <div className="text-center mt-2">
              <ReportTrigger
                variant="discreet"
                label={t.phases.questionSelection.reportQuestion}
                defaultType="question_report"
                extraContext={[
                  `Catégorie: ${currentCard.category}`,
                  `Thème: ${currentCard.theme}`,
                  `Sujet: ${currentCard.subject}`,
                  `Questions affichées:`,
                  ...currentCard.questions.map((q, i) => `  ${i + 1}. ${q}`),
                ].join('\n')}
              />
            </div>
          )}

          {/* Message de confirmation */}
          {locked && (
            <div className="text-center mt-3 md:mt-4">
              <p className="text-white text-base md:text-xl font-semibold drop-shadow">
                {t.phases.questionSelection.selected}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default QuestionSelection;
