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
// (Home -> Lobby -> Game) and reloads inside the iframe.
// =====================================================================

const BOT_KEY = 'studioBot';

const RANDOM_ANSWERS = [
  'oui', 'non', 'peut-être', '42', 'haha', 'chocolat',
  'jamais', 'tout le temps', 'bof', 'la vie', 'à fond', 'pas trop',
  'le mardi', 'avec des frites', 'genre vraiment ?', 'mdr',
];

const randomAnswer = () => {
  const base = RANDOM_ANSWERS[Math.floor(Math.random() * RANDOM_ANSWERS.length)];
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
  // Limit-breaker mode : à chaque entrée en phase, on émet l'action N fois
  // dans une boucle serrée (au lieu du burst one-shot du bouton "Break").
  const limitBreakerRef = useRef<{ enabled: boolean; count: number }>({ enabled: false, count: 10 });
  // Tracks which phase-actions have already been emitted, keyed by
  // `${roundNumber}:${phase}`. Reset on round change.
  const firedRef = useRef<Set<string>>(new Set());

  // Refs miroir pour que les listeners et timers (qui survivent au-delà du
  // cycle de l'effect) puissent lire l'état courant sans dépendances React.
  const gameRef = useRef(game);
  const currentPlayerRef = useRef(currentPlayer);
  const playersRef = useRef(players);
  const lobbyCodeRef = useRef(lobbyCode);
  useEffect(() => { gameRef.current = game; }, [game]);
  useEffect(() => { currentPlayerRef.current = currentPlayer; }, [currentPlayer]);
  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { lobbyCodeRef.current = lobbyCode; }, [lobbyCode]);

  // Listen for live toggle + stress burst from the studio parent.
  useEffect(() => {
    if (!isStudioFrame) return;
    const onMessage = (e: MessageEvent) => {
      // Les commandes Studio viennent de la fenêtre parente, MÊME ORIGINE que l'iframe.
      // Rejeter tout message cross-origin (injection postMessage depuis un autre site).
      if (e.origin !== window.location.origin) return;
      const data = e?.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'studio:setBot') {
        enabledRef.current = !!data.enabled;
        try {
          if (data.enabled) sessionStorage.setItem(BOT_KEY, '1');
          else sessionStorage.removeItem(BOT_KEY);
        } catch { /* silent */ }
        return;
      }

      if (data.type === 'studio:setLimitBreaker') {
        limitBreakerRef.current = {
          enabled: !!data.enabled,
          count: Math.max(1, Math.min(200, Number(data.count) || 10)),
        };
        return;
      }

      if (data.type === 'studio:stress') {
        runStressBurst(Math.max(1, Math.min(200, Number(data.count) || 10)));
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Émet l'action de phase courante `burst` fois (utilisé par le bouton Break
  // one-shot ET par le mode Limit Breakers persistant à chaque transition).
  const runStressBurst = (burst: number) => {
    const g = gameRef.current;
    const cp = currentPlayerRef.current;
    const code = lobbyCodeRef.current;
    const pls = playersRef.current;
    if (!g?.currentRound || !cp || !code) return;
    const round = g.currentRound;
    const phase = round.phase;
    const isLeader = round.leader.id === cp.id;
    const isSubstitute = round.substitutePlayerId === cp.id;

    const spam = (fn: () => void) => {
      for (let i = 0; i < burst; i++) {
        try { fn(); } catch (err) { console.warn('[studio-stress] failed', err); }
      }
    };

    if (phase === RoundPhase.QUESTION_SELECTION && isLeader) {
      spam(() => socket.emit('requestQuestions', { lobbyCode: code }));
    } else if (phase === RoundPhase.SUBSTITUTE_SELECTION && isLeader) {
      const candidate = pls.find((p) => p.isActive && p.id !== cp.id);
      if (candidate) spam(() => socket.emit('selectSubstitute', {
        lobbyCode: code, substitutePlayerId: candidate.id,
      }));
    } else if (phase === RoundPhase.ANSWERING && !isLeader) {
      spam(() => socket.emit('submitAnswer', {
        lobbyCode: code, playerId: cp.id, answer: randomAnswer(),
      }));
    } else if (phase === RoundPhase.SUBSTITUTE_ANSWERING && isSubstitute) {
      spam(() => socket.emit('submitSubstituteAnswer', {
        lobbyCode: code, answer: randomAnswer(),
      }));
    } else if (phase === RoundPhase.GUESSING && isLeader) {
      spam(() => socket.emit('submitGuesses', { lobbyCode: code, guesses: {} }));
    } else if (phase === RoundPhase.REVEAL && isLeader) {
      spam(() => socket.emit('revealAnswer', { lobbyCode: code, answerIndex: 0 }));
      spam(() => socket.emit('nextRound', { lobbyCode: code }));
    }
  };

  // Limit Breakers : à chaque entrée en phase, si activé, relance un burst.
  // firedRef gère la dedupe par (round, phase) - la même phase ne sera pas
  // re-spammée à chaque re-render. Le setTimeout est annulé si la phase
  // change avant son déclenchement (sinon on spammerait l'ancienne phase).
  useEffect(() => {
    if (!isStudioFrame) return;
    const lb = limitBreakerRef.current;
    if (!lb.enabled) return;
    const round = game?.currentRound;
    if (!round || !currentPlayer || !lobbyCode) return;
    const key = `${round.roundNumber}:${round.phase}:limit-breaker`;
    if (firedRef.current.has(key)) return;
    firedRef.current.add(key);
    const id = window.setTimeout(() => runStressBurst(lb.count), 250);
    return () => window.clearTimeout(id);
  }, [
    game?.currentRound?.roundNumber,
    game?.currentRound?.phase,
    currentPlayer?.id,
    lobbyCode,
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

  // ---------------------------------------------------------------------
  // Long-lived listeners for phases dont l'action dépend d'une réponse
  // serveur asynchrone (questionsReceived / shuffledAnswersReceived).
  // Enregistrés UNE seule fois (deps vides) pour éviter qu'un re-render
  // ne les détache avant que la réponse n'arrive.
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (!isStudioFrame) return;

    const onQuestions = (data: { questions: GameCard[] }) => {
      if (!enabledRef.current) return;
      const g = gameRef.current;
      const cp = currentPlayerRef.current;
      const code = lobbyCodeRef.current;
      if (!g?.currentRound || !cp || !code) return;
      const round = g.currentRound;
      if (round.phase !== RoundPhase.QUESTION_SELECTION) return;
      if (round.leader.id !== cp.id) return;
      const key = `${round.roundNumber}:selectQuestion`;
      if (firedRef.current.has(key)) return;
      if (!data.questions?.length) return;
      const first = data.questions[0];
      const q = first.questions[0];
      if (!q) return;
      firedRef.current.add(key);
      socket.emit('selectQuestion', { lobbyCode: code, selectedQuestion: q });
    };

    const onShuffled = (data: {
      answers: Array<{ id: string; text: string }>;
      players: IPlayer[];
      roundNumber?: number;
    }) => {
      if (!enabledRef.current) return;
      const g = gameRef.current;
      const cp = currentPlayerRef.current;
      const code = lobbyCodeRef.current;
      if (!g?.currentRound || !cp || !code) return;
      const round = g.currentRound;
      if (round.phase !== RoundPhase.GUESSING) return;
      if (round.leader.id !== cp.id) return;
      if (data.roundNumber !== undefined && data.roundNumber !== round.roundNumber) return;
      const key = `${round.roundNumber}:submitGuesses`;
      if (firedRef.current.has(key)) return;
      firedRef.current.add(key);
      const candidates = data.players.map((p) => p.id);
      const shuffledCandidates = [...candidates].sort(() => Math.random() - 0.5);
      const guesses: Record<string, string> = {};
      data.answers.forEach((a, i) => {
        guesses[a.id] = shuffledCandidates[i % shuffledCandidates.length];
      });
      setTimeout(() => {
        if (!enabledRef.current) return;
        socket.emit('submitGuesses', { lobbyCode: code, guesses });
      }, 600);
    };

    socket.on('questionsReceived', onQuestions);
    socket.on('shuffledAnswersReceived', onShuffled);
    return () => {
      socket.off('questionsReceived', onQuestions);
      socket.off('shuffledAnswersReceived', onShuffled);
    };
  }, []);

  // ---------------------------------------------------------------------
  // Effet principal : déclenche l'action de phase. PAS de cleanup qui tue
  // les setTimeout en vol -- on garde le flag firedRef pour éviter le
  // double-emit, donc laisser le timer aller au bout est sans risque.
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (!isStudioFrame || !enabledRef.current) return;
    if (!game?.currentRound || !currentPlayer || !lobbyCode) return;

    const round = game.currentRound;
    const phase = round.phase;
    const isLeader = round.leader.id === currentPlayer.id;
    const isSubstitute = round.substitutePlayerId === currentPlayer.id;

    const schedule = (key: string, delay: number, fn: () => void) => {
      if (firedRef.current.has(key)) return;
      firedRef.current.add(key);
      setTimeout(() => {
        if (!enabledRef.current) return;
        try { fn(); } catch (err) { console.warn('[studio-bot] action failed', err); }
      }, delay);
    };

    // ----- QUESTION_SELECTION (leader) -----
    // Le listener long-lived déclenche selectQuestion ; on (re)demande les
    // questions ici pour couvrir le cas où QuestionSelection a déjà reçu sa
    // réponse avant qu'on soit activé, OU si on rejoint en cours.
    if (phase === RoundPhase.QUESTION_SELECTION && isLeader) {
      schedule(`${round.roundNumber}:requestQuestions`, 400, () => {
        socket.emit('requestQuestions', { lobbyCode });
      });
      return;
    }

    // ----- SUBSTITUTE_SELECTION (leader) -----
    if (phase === RoundPhase.SUBSTITUTE_SELECTION && isLeader) {
      const candidate = playersRef.current.find(
        (p) => p.isActive && p.id !== currentPlayer.id
      );
      if (!candidate) return;
      schedule(`${round.roundNumber}:selectSubstitute`, 600, () => {
        socket.emit('selectSubstitute', {
          lobbyCode,
          substitutePlayerId: candidate.id,
        });
      });
      return;
    }

    // ----- ANSWERING (non-leader) -----
    if (phase === RoundPhase.ANSWERING && !isLeader) {
      if (round.answers && round.answers[currentPlayer.id]) {
        firedRef.current.add(`${round.roundNumber}:submitAnswer`);
        return;
      }
      schedule(`${round.roundNumber}:submitAnswer`, 500 + Math.random() * 600, () => {
        socket.emit('submitAnswer', {
          lobbyCode,
          playerId: currentPlayer.id,
          answer: randomAnswer(),
        });
      });
      return;
    }

    // ----- SUBSTITUTE_ANSWERING (substitute) -----
    if (phase === RoundPhase.SUBSTITUTE_ANSWERING && isSubstitute) {
      schedule(`${round.roundNumber}:submitSubstituteAnswer`, 500 + Math.random() * 600, () => {
        socket.emit('submitSubstituteAnswer', {
          lobbyCode,
          answer: randomAnswer(),
        });
      });
      return;
    }

    // ----- GUESSING (leader) -----
    // Le listener long-lived déclenche submitGuesses ; on (re)demande le
    // shuffle pour amorcer la réponse.
    if (phase === RoundPhase.GUESSING && isLeader) {
      schedule(`${round.roundNumber}:requestShuffled`, 400, () => {
        socket.emit('requestShuffledAnswers', { lobbyCode });
      });
      return;
    }

    // ----- REVEAL (leader) -----
    // Boucle de reveal séquentiel + nextRound. PAS de cleanup `cancelled` :
    // un re-render ne doit pas tuer la séquence. firedRef garantit qu'on
    // ne relance pas la boucle deux fois pour le même round.
    if (phase === RoundPhase.REVEAL && isLeader) {
      const key = `${round.roundNumber}:reveal`;
      if (firedRef.current.has(key)) return;
      firedRef.current.add(key);

      // En mode "Devine ma réponse", le pool de devinette inclut la réponse du substitut
      // (clé = id du pilier), absente de round.answers : on l'ajoute pour ne pas s'arrêter
      // une réponse trop tôt (même formule que playerStats.computeTeamPct).
      const totalAnswers =
        Object.keys(round.answers ?? {}).length +
        (round.guessMyAnswerMode && round.substituteAnswer ? 1 : 0);
      const already = new Set(round.revealedIndices ?? []);
      let idx = 0;

      const revealNext = () => {
        if (!enabledRef.current) return;
        // Re-lire l'état courant : si le round a changé entre-temps, stop.
        const g = gameRef.current;
        if (!g?.currentRound || g.currentRound.roundNumber !== round.roundNumber) return;
        if (g.currentRound.phase !== RoundPhase.REVEAL) return;

        while (idx < totalAnswers && already.has(idx)) idx++;
        if (idx >= totalAnswers) {
          setTimeout(() => {
            if (!enabledRef.current) return;
            const gg = gameRef.current;
            if (!gg?.currentRound || gg.currentRound.roundNumber !== round.roundNumber) return;
            socket.emit('nextRound', { lobbyCode });
          }, 800);
          return;
        }
        socket.emit('revealAnswer', { lobbyCode, answerIndex: idx });
        already.add(idx);
        idx++;
        setTimeout(revealNext, 900);
      };

      setTimeout(revealNext, 900);
    }
  }, [
    game?.currentRound?.roundNumber,
    game?.currentRound?.phase,
    game?.currentRound?.leader.id,
    game?.currentRound?.substitutePlayerId,
    currentPlayer?.id,
    lobbyCode,
    // NB: pas de `players` ici - on lit playersRef pour éviter qu'un update
    // serveur (très fréquent) ne re-déclenche l'effect en milieu de phase.
  ]);
}
