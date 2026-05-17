import { useEffect, useRef } from 'react';
import socket from '../utils/socket';
import { isStudioFrame } from '../utils/studioStorage';
import { IGame, IPlayer, RoundPhase, GameCard } from '@onskone/shared';

// =====================================================================
// useStudioBot - auto-pilot for Studio iframes flagged as bots
// =====================================================================
// Activated when running inside a studio iframe AND either ?bot=1 in the URL
// OR a postMessage `{type: 'studio:setBot', enabled: true}` was received from
// the parent. State is persisted in sessionStorage so it survives navigations
// (Home → Lobby → Game) and reloads inside the iframe.
// =====================================================================

const BOT_KEY = 'studioBot';

const RANDOM_ANSWERS = [
  'oui', 'non', 'peut-être', '42', 'haha', 'chocolat',
  'jamais', 'tout le temps', 'bof', 'la vie', 'à fond', 'pas trop',
  'le mardi', 'avec des frites', 'genre vraiment ?', 'mdr',
];

const randomAnswer = () => {
  const base = RANDOM_ANSWERS[Math.floor(Math.random() * RANDOM_ANSWERS.length)];
  // Suffix random digits to make answers unique enough to avoid the
  // similarity-merge popup blocking the flow during automated runs.
  return `${base} ${Math.floor(Math.random() * 1000)}`;
};

const readInitialBotFlag = (): boolean => {
  if (!isStudioFrame || typeof window === 'undefined') return false;
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('bot');
    if (fromUrl === '1') { sessionStorage.setItem(BOT_KEY, '1'); return true; }
    if (fromUrl === '0') { sessionStorage.removeItem(BOT_KEY); return false; }
    return sessionStorage.getItem(BOT_KEY) === '1';
  } catch {
    return false;
  }
};

interface UseStudioBotArgs {
  game: IGame | null;
  currentPlayer: IPlayer | null;
  players: IPlayer[];
  lobbyCode: string | null;
}

export function useStudioBot({ game, currentPlayer, players, lobbyCode }: UseStudioBotArgs) {
  const enabledRef = useRef<boolean>(readInitialBotFlag());
  // Memoize phase decisions so we don't fire the same action twice
  // (handlers can re-run because of state updates within the same phase).
  const firedRef = useRef<Set<string>>(new Set());

  // Listen for live toggle from the studio parent.
  useEffect(() => {
    if (!isStudioFrame) return;
    const onMessage = (e: MessageEvent) => {
      const data = e?.data;
      if (data?.type !== 'studio:setBot') return;
      enabledRef.current = !!data.enabled;
      try {
        if (data.enabled) sessionStorage.setItem(BOT_KEY, '1');
        else sessionStorage.removeItem(BOT_KEY);
      } catch { /* silent */ }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    if (!isStudioFrame || !enabledRef.current) return;
    if (!game?.currentRound || !currentPlayer || !lobbyCode) return;

    const round = game.currentRound;
    const phase = round.phase;
    const isLeader = round.leader.id === currentPlayer.id;
    const isSubstitute = round.substitutePlayerId === currentPlayer.id;
    const fireKey = `${round.roundNumber}:${phase}`;
    if (firedRef.current.has(fireKey)) return;

    const fire = (delay: number, fn: () => void) => {
      firedRef.current.add(fireKey);
      const t = setTimeout(() => {
        if (!enabledRef.current) return;
        try { fn(); } catch (err) { console.warn('[studio-bot] action failed', err); }
      }, delay);
      return () => clearTimeout(t);
    };

    // ----- QUESTION_SELECTION (leader) -----
    if (phase === RoundPhase.QUESTION_SELECTION && isLeader) {
      // The QuestionSelection component already emits requestQuestions on mount.
      // We listen for the response and immediately select the first question.
      const onQuestions = (data: { questions: GameCard[] }) => {
        if (!data.questions?.length) return;
        const first = data.questions[0];
        const q = first.questions[0];
        if (!q) return;
        socket.emit('selectQuestion', { lobbyCode, selectedQuestion: q });
      };
      // One-shot listener.
      socket.once('questionsReceived', onQuestions);
      firedRef.current.add(fireKey);
      return () => { socket.off('questionsReceived', onQuestions); };
    }

    // ----- SUBSTITUTE_SELECTION (leader) -----
    if (phase === RoundPhase.SUBSTITUTE_SELECTION && isLeader) {
      const candidate = players.find(
        (p) => p.isActive && p.id !== currentPlayer.id
      );
      if (!candidate) return;
      return fire(600, () => {
        socket.emit('selectSubstitute', {
          lobbyCode,
          substitutePlayerId: candidate.id,
        });
      });
    }

    // ----- ANSWERING (non-leader) -----
    if (phase === RoundPhase.ANSWERING && !isLeader) {
      // Skip if we've already answered (round.answers already contains us).
      if (round.answers && round.answers[currentPlayer.id]) {
        firedRef.current.add(fireKey);
        return;
      }
      return fire(500 + Math.random() * 600, () => {
        socket.emit('submitAnswer', {
          lobbyCode,
          playerId: currentPlayer.id,
          answer: randomAnswer(),
        });
      });
    }

    // ----- SUBSTITUTE_ANSWERING (substitute) -----
    if (phase === RoundPhase.SUBSTITUTE_ANSWERING && isSubstitute) {
      return fire(500 + Math.random() * 600, () => {
        socket.emit('submitSubstituteAnswer', {
          lobbyCode,
          answer: randomAnswer(),
        });
      });
    }

    // ----- GUESSING (leader) -----
    if (phase === RoundPhase.GUESSING && isLeader) {
      // GuessingPhase mounts and emits requestShuffledAnswers. Listen for the
      // response, then submit a random mapping of answer → player.
      const onShuffled = (data: {
        answers: Array<{ id: string; text: string }>;
        players: IPlayer[];
        roundNumber?: number;
      }) => {
        if (data.roundNumber !== undefined && data.roundNumber !== round.roundNumber) return;
        const candidates = data.players.map((p) => p.id);
        const shuffledCandidates = [...candidates].sort(() => Math.random() - 0.5);
        const guesses: Record<string, string> = {};
        data.answers.forEach((a, i) => {
          guesses[a.id] = shuffledCandidates[i % shuffledCandidates.length];
        });
        setTimeout(() => {
          socket.emit('submitGuesses', { lobbyCode, guesses });
        }, 600);
      };
      socket.once('shuffledAnswersReceived', onShuffled);
      firedRef.current.add(fireKey);
      return () => { socket.off('shuffledAnswersReceived', onShuffled); };
    }

    // ----- REVEAL (leader) -----
    if (phase === RoundPhase.REVEAL && isLeader) {
      // Reveal each unrevealed answer sequentially, then advance to next round.
      firedRef.current.add(fireKey);
      const totalAnswers = Object.keys(round.answers ?? {}).length;
      const already = new Set(round.revealedIndices ?? []);
      let idx = 0;
      let cancelled = false;

      const revealNext = () => {
        if (cancelled || !enabledRef.current) return;
        while (idx < totalAnswers && already.has(idx)) idx++;
        if (idx >= totalAnswers) {
          setTimeout(() => {
            if (cancelled || !enabledRef.current) return;
            socket.emit('nextRound', { lobbyCode });
          }, 800);
          return;
        }
        socket.emit('revealAnswer', { lobbyCode, answerIndex: idx });
        already.add(idx);
        idx++;
        setTimeout(revealNext, 900);
      };

      const t = setTimeout(revealNext, 900);
      return () => { cancelled = true; clearTimeout(t); };
    }
  }, [
    game?.currentRound?.roundNumber,
    game?.currentRound?.phase,
    game?.currentRound?.leader.id,
    game?.currentRound?.substitutePlayerId,
    currentPlayer?.id,
    lobbyCode,
    players,
  ]);

  // Reset fired-set when round number changes so we re-arm per round.
  const lastRoundRef = useRef<number | null>(null);
  useEffect(() => {
    const r = game?.currentRound?.roundNumber ?? null;
    if (r !== lastRoundRef.current) {
      firedRef.current = new Set();
      lastRoundRef.current = r;
    }
  }, [game?.currentRound?.roundNumber]);
}
