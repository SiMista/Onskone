import { useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import Avatar from '../Avatar';
import RevealedAnswerCard from '../RevealedAnswerCard';
import { IPlayer, RevealResult } from '@onskone/shared';
import { useLocale } from '../../i18n';
import type { RevealCursorState } from '../../hooks/useRevealCursor';
import PremiumName from '../PremiumName';
import { hapticNextToReveal } from '../../utils/haptics';
import RevealAuthorOverlay from './RevealAuthorOverlay';

/**
 * Vue REVEAL d'un joueur non-pilier en mode local : carte unique de la réponse
 * qui lui a été attribuée (ou état "pas de réponse attribuée"), avec stickman
 * et footer "Montre ton écran". Gère ses propres animations (pulse "à révéler",
 * pop de révélation, bascule rouge quand aucune réponse n'est attribuée).
 */
const RevealPlayerLocalView = ({
  reveal,
  leader,
  currentPlayerId,
  isGameOver,
  results,
}: {
  reveal: RevealCursorState;
  leader: Pick<IPlayer, 'id' | 'name' | 'avatarId' | 'isPremium'>;
  currentPlayerId: string;
  isGameOver: boolean;
  results: RevealResult[];
}) => {
  const { t } = useLocale();
  const {
    revealedIndices,
    correctedIndices,
    similarityModal,
    allRevealed,
    findFirstDisplayable,
  } = reveal;

  const myIndex = results.findIndex(r => r.guessedPlayerId === currentPlayerId);
  const myResult = myIndex >= 0 ? results[myIndex] : null;

  // Joueur sans réponse attribuée : bascule en rouge après un court délai
  const [noAnswerLitRed, setNoAnswerLitRed] = useState(false);
  // Animation de reveal sur la carte joueur
  const [revealAnimating, setRevealAnimating] = useState(false);
  // Overlay plein écran "qui a écrit ?" sur le tel du joueur dont la carte est révélée
  const [authorOverlay, setAuthorOverlay] = useState(false);
  // Init sur l'état courant : une resync avec ma carte déjà révélée ne rejoue ni pop ni overlay.
  const prevMyRevealedRef = useRef(
    myIndex >= 0 && revealedIndices.has(myIndex) && similarityModal?.answerIndex !== myIndex,
  );

  useEffect(() => {
    if (myResult) return;
    const t = setTimeout(() => setNoAnswerLitRed(true), 1200);
    return () => clearTimeout(t);
  }, [myResult]);

  // Déclenche l'animation de reveal côté joueur quand sa carte est révélée
  // (mais pas tant qu'une similarité est en attente de validation par le pilier)
  useEffect(() => {
    const awaitingSim = myIndex >= 0 && similarityModal?.answerIndex === myIndex;
    const myRev = myIndex >= 0 && revealedIndices.has(myIndex) && !awaitingSim;
    if (myRev && !prevMyRevealedRef.current) {
      setRevealAnimating(true);
      setAuthorOverlay(true);
      const t = setTimeout(() => setRevealAnimating(false), 500);
      prevMyRevealedRef.current = true;
      return () => clearTimeout(t);
    }
    if (!myRev) prevMyRevealedRef.current = false;
  }, [myIndex, revealedIndices, similarityModal]);

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

  // Petit tap quand ma carte devient la prochaine à révéler (même moment que le pulse).
  const wasNextToRevealRef = useRef(false);
  useEffect(() => {
    if (isNextToReveal && !wasNextToRevealRef.current) hapticNextToReveal();
    wasNextToRevealRef.current = isNextToReveal;
  }, [isNextToReveal]);

  const waitingFooter = allRevealed ? (
    <div className="flex items-center justify-center flex-wrap gap-x-2 gap-y-1 leading-none text-gray-900 text-base tablet:text-lg phone-landscape:text-xs">
      {t.phases.reveal.waitingPrefix && <span>{t.phases.reveal.waitingPrefix}</span>}
      <Avatar avatarId={leader?.avatarId ?? 0} name={leader?.name} size="sm" />
      <PremiumName name={leader?.name ?? ''} premium={!!leader?.isPremium} />
      <span>{isGameOver ? t.phases.reveal.waitingLeaderFinal : t.phases.reveal.waitingLeaderNext}</span>
    </div>
  ) : undefined;

  const rotateHint = (
    <p className="landscape:hidden flex items-center gap-1.5 text-xs text-gray-600 shrink-0">
      <Icon icon="mdi:phone-rotate-landscape" width={14} height={14} aria-hidden />
      {t.phases.reveal.rotateForLandscape}
    </p>
  );

  if (myResult) {
    return (
      <>
      {authorOverlay && myResult.playerName && (
        <RevealAuthorOverlay
          name={myResult.playerName}
          avatarId={myResult.playerAvatarId ?? 0}
          premium={!!myResult.playerIsPremium}
          correct={myCorrect}
          onDone={() => setAuthorOverlay(false)}
        />
      )}
      <RevealedAnswerCard
        result={myResult}
        revealed={myRevealed}
        correct={myCorrect}
        cardClassName={`${isNextToReveal ? 'animate-card-soft-pulse' : ''} ${revealAnimating ? 'animate-reveal-pop' : ''}`}
        footer={
          <>
            {waitingFooter && <div className="shrink-0 mt-1">{waitingFooter}</div>}
            {!allRevealed && rotateHint}
          </>
        }
      />
      </>
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
    answer: t.phases.reveal.noAttribution(leader.name),
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
          {!allRevealed && rotateHint}
        </>
      }
    />
  );
};

export default RevealPlayerLocalView;
