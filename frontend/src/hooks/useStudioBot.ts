import { useEffect, useRef, useState } from 'react';
import socket from '../utils/socket';
import {
  isStudioFrame, studioSlotIndex, getStudioBotFlag, setStudioBotFlag,
  getStudioScenarioRun, markStudioScenarioReached,
} from '../utils/studioStorage';
import {
  STUDIO_STOPS, findStudioScenario, isPhaseStop, scenarioGuesses, scenarioRolePlayers,
  type StudioScenario, type StudioStop,
} from '../utils/studioScenarios';
import { IGame, IPlayer, RoundPhase, GameCard, GAME_CONSTANTS } from '@onskone/shared';
import type { ServerToClientEvents } from '@onskone/shared';

// =====================================================================
// useStudioBot - auto-pilot for Studio iframes flagged as bots
// =====================================================================
// Activated when running inside a studio iframe AND either ?bot=1 in the URL
// OR a postMessage `{type: 'studio:setBot', enabled: true}` was received from
// the parent. State is persisted in sessionStorage so it survives navigations
// (Home -> Lobby -> Game) and reloads inside the iframe.
// =====================================================================

const RANDOM_ANSWERS = [
  'oui', 'non', 'peut-être', '42', 'haha', 'chocolat',
  'jamais', 'tout le temps', 'bof', 'la vie', 'à fond', 'pas trop',
  'le mardi', 'avec des frites', 'genre vraiment ?', 'mdr',
];

const randomAnswer = () => {
  const base = RANDOM_ANSWERS[Math.floor(Math.random() * RANDOM_ANSWERS.length)];
  return `${base} ${Math.floor(Math.random() * 1000)}`;
};

// Le flag vit dans un sessionStorage namespacé par slot (cf studioStorage), déjà
// synchronisé depuis l'URL `?bot=` au boot du module et tenu à jour par l'écoute
// module-level de `studio:setBot` (y compris hors /game).
const readInitialBotFlag = (): boolean => getStudioBotFlag();

/** Scénario de Régie en cours (cf. utils/studioScenarios.ts), null = bots aléatoires. */
const currentScenario = (): { scenario: StudioScenario; stop: StudioStop; armed: boolean } | null => {
  const run = getStudioScenarioRun();
  const scenario = run ? findStudioScenario(run.id) : null;
  if (!run || !scenario) return null;
  const stop = (run.stop in STUDIO_STOPS ? run.stop : 'never') as StudioStop;
  return { scenario, stop, armed: !run.reached && stop !== 'never' };
};

// Scénario : laisser le temps de voir chaque écran (overlay « qui a écrit ? », popup).
const SCENARIO_REVEAL_STEP_MS = GAME_CONSTANTS.REVEAL_AUTHOR_OVERLAY_MS + 500;
const SCENARIO_DECISION_DELAY_MS = 2500;

interface UseStudioBotArgs {
  game: IGame | null;
  currentPlayer: IPlayer | null;
  players: IPlayer[];
  lobbyCode: string | null;
  /** Ordre du reveal (tour de table) : le pilier bot révèle dans cet ordre, comme un humain. */
  revealOrder?: readonly number[];
}

export function useStudioBot({ game, currentPlayer, players, lobbyCode, revealOrder }: UseStudioBotArgs) {
  const enabledRef = useRef<boolean>(readInitialBotFlag());
  // Le bot joue-t-il ? enabledRef ET le flag du slot (source de vérité, tenu à jour par
  // l'écoute module-level de studioStorage, toute la vie de l'iframe). enabledRef seul ne
  // suffit pas : une instance rendue juste avant un `studio:scenarioReached` le lit à true,
  // et son écoute (posée dans un effet, APRÈS le rendu) rate le message. Vu en vrai : le
  // pilier bot choisissait sa question malgré l'arrêt « Tableau de dessin ».
  const botOn = () => enabledRef.current && getStudioBotFlag();
  // Tracks which phase-actions have already been emitted, keyed by
  // `${roundNumber}:${phase}`. Reset on round change.
  const firedRef = useRef<Set<string>>(new Set());
  // Incrémenté à chaque RÉactivation du bot : relance l'effet principal sur la
  // phase COURANTE. Sans ça, un bot réactivé en pleine phase restait inerte
  // jusqu'à la transition suivante (enabledRef n'est pas une dépendance), et
  // pouvait bloquer la table (pilier bot qui ne choisit jamais sa question).
  const [botWakeTick, setBotWakeTick] = useState(0);

  // Refs miroir pour que les listeners et timers (qui survivent au-delà du
  // cycle de l'effect) puissent lire l'état courant sans dépendances React.
  const gameRef = useRef(game);
  const currentPlayerRef = useRef(currentPlayer);
  const playersRef = useRef(players);
  const lobbyCodeRef = useRef(lobbyCode);
  const revealOrderRef = useRef<readonly number[]>(revealOrder ?? []);
  revealOrderRef.current = revealOrder ?? [];
  useEffect(() => { gameRef.current = game; }, [game]);
  useEffect(() => { currentPlayerRef.current = currentPlayer; }, [currentPlayer]);
  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { lobbyCodeRef.current = lobbyCode; }, [lobbyCode]);

  // Point d'arrêt du scénario atteint ICI : ce bot s'arrête et prévient la Régie, qui
  // l'annonce à toutes les iframes (`studio:scenarioReached`) : tout le monde rend la main.
  const handOverRef = useRef((stop: StudioStop) => {
    enabledRef.current = false;
    markStudioScenarioReached();
    try {
      window.parent?.postMessage({ type: 'studio:scenarioReached', slot: studioSlotIndex, stop }, '*');
    } catch { /* silent */ }
  });

  // Listen for the live bot toggle from the studio parent.
  useEffect(() => {
    if (!isStudioFrame) return;
    const onMessage = (e: MessageEvent) => {
      // Les commandes Studio viennent de la fenêtre parente, MÊME ORIGINE que l'iframe.
      // Rejeter tout message cross-origin (injection postMessage depuis un autre site).
      if (e.origin !== window.location.origin) return;
      const data = e?.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'studio:setBot') {
        const next = !!data.enabled;
        const wasEnabled = enabledRef.current;
        enabledRef.current = next;
        setStudioBotFlag(next); // idempotent (l'écoute module-level l'a déjà fait)
        if (next && !wasEnabled) {
          // Oublier les actions « déjà planifiées » : celles armées avant la coupure
          // ont avorté (garde enabledRef dans leur timer) mais leur clé bloquait
          // toute nouvelle tentative dans ce round. Le serveur protège déjà contre
          // un doublon (gardes de phase, réponse = édition).
          firedRef.current.clear();
          setBotWakeTick((t) => t + 1);
        }
        return;
      }

      // Point d'arrêt atteint par un autre slot : on rend la main aussi.
      if (data.type === 'studio:scenarioReached') {
        enabledRef.current = false;
        return;
      }

      // `studio:setPremium` est écouté au niveau module dans utils/premium.ts
      // (actif sur toutes les pages, pas seulement /game).
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

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

    const onQuestions = (data: { questions: GameCard[]; usedQuestions?: string[] }) => {
      if (!botOn()) return;
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
      const used = new Set(data.usedQuestions ?? []);
      const q = data.questions.flatMap(c => c.questions).find(x => !used.has(x));
      if (!q) return;
      firedRef.current.add(key);
      socket.emit('selectQuestion', { lobbyCode: code, selectedQuestion: q });
    };

    const onShuffled = (data: Parameters<ServerToClientEvents['shuffledAnswersReceived']>[0]) => {
      if (!botOn()) return;
      const g = gameRef.current;
      const cp = currentPlayerRef.current;
      const code = lobbyCodeRef.current;
      if (!g?.currentRound || !cp || !code) return;
      const round = g.currentRound;
      if (round.phase !== RoundPhase.GUESSING) return;
      if (round.leader.id !== cp.id) return;
      if (data.roundNumber !== round.roundNumber) return;
      const key = `${round.roundNumber}:submitGuesses`;
      if (firedRef.current.has(key)) return;
      const sc = currentScenario();
      if (sc?.armed && isPhaseStop(sc.stop, RoundPhase.GUESSING)) {
        handOverRef.current(sc.stop);
        return;
      }
      firedRef.current.add(key);
      let guesses: Record<string, string> = {};
      if (sc) {
        // Scénario : le pilier pose chaque carte où le script le dit (auteur retrouvé par le texte).
        guesses = scenarioGuesses(sc.scenario, data.answers, scenarioRolePlayers(playersRef.current, round.leader.id), round.leader.id);
      } else {
        const candidates = data.players.map((p) => p.id);
        const shuffledCandidates = [...candidates].sort(() => Math.random() - 0.5);
        data.answers.forEach((a, i) => {
          guesses[a.id] = shuffledCandidates[i % shuffledCandidates.length];
        });
      }
      setTimeout(() => {
        if (!botOn()) return;
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
  // Deps volontairement granulaires (roundNumber/phase/leaderId/... primitifs) et
  // non les objets game/currentPlayer : on ne veut PAS re-déclencher la séquence à
  // chaque gameStateUpdate serveur en milieu de phase. Le round complet est lu via
  // gameRef à l'intérieur (identique à `game.currentRound` au moment du commit).
  const mainRoundNumber = game?.currentRound?.roundNumber;
  const mainPhase = game?.currentRound?.phase;
  const mainLeaderId = game?.currentRound?.leader.id;
  const mainSubstituteId = game?.currentRound?.substitutePlayerId;
  const mainPlayerId = currentPlayer?.id;
  useEffect(() => {
    if (!isStudioFrame || !botOn()) return;
    const round = gameRef.current?.currentRound;
    if (!round || mainRoundNumber == null || mainPhase == null || !mainPlayerId || !lobbyCode) return;

    const phase = mainPhase;
    const isLeader = mainLeaderId === mainPlayerId;
    const isSubstitute = mainSubstituteId === mainPlayerId;

    // Scénario de Régie : arrêt en arrivant dans la phase choisie, sinon réponses et
    // choix scriptés par rôle (A, B, C… = non-piliers dans l'ordre des places).
    const sc = currentScenario();
    if (sc?.armed && isPhaseStop(sc.stop, phase)) {
      handOverRef.current(sc.stop);
      return;
    }
    const rolePlayers = mainLeaderId ? scenarioRolePlayers(playersRef.current, mainLeaderId) : [];
    const myRole = rolePlayers.findIndex((p) => p.id === mainPlayerId);

    const schedule = (key: string, delay: number, fn: () => void) => {
      if (firedRef.current.has(key)) return;
      firedRef.current.add(key);
      setTimeout(() => {
        if (!botOn()) return;
        try { fn(); } catch (err) { console.warn('[studio-bot] action failed', err); }
      }, delay);
    };

    // ----- QUESTION_SELECTION (leader) -----
    // Le listener long-lived déclenche selectQuestion ; on (re)demande les
    // questions ici pour couvrir le cas où QuestionSelection a déjà reçu sa
    // réponse avant qu'on soit activé, OU si on rejoint en cours.
    if (phase === RoundPhase.QUESTION_SELECTION && isLeader) {
      schedule(`${mainRoundNumber}:requestQuestions`, 400, () => {
        socket.emit('requestQuestions', { lobbyCode });
      });
      return;
    }

    // ----- SUBSTITUTE_SELECTION (leader) -----
    if (phase === RoundPhase.SUBSTITUTE_SELECTION && isLeader) {
      const scripted = sc?.scenario.substitute ? rolePlayers[sc.scenario.substitute.role] : undefined;
      const candidate = scripted ?? playersRef.current.find(
        (p) => p.isActive && p.id !== mainPlayerId
      );
      if (!candidate) return;
      schedule(`${mainRoundNumber}:selectSubstitute`, 600, () => {
        socket.emit('selectSubstitute', {
          lobbyCode,
          substitutePlayerId: candidate.id,
        });
      });
      return;
    }

    // ----- ANSWERING (non-leader) -----
    if (phase === RoundPhase.ANSWERING && !isLeader) {
      if (round.answers && round.answers[mainPlayerId]) {
        firedRef.current.add(`${mainRoundNumber}:submitAnswer`);
        return;
      }
      schedule(`${mainRoundNumber}:submitAnswer`, 500 + Math.random() * 600, () => {
        socket.emit('submitAnswer', {
          lobbyCode,
          playerId: mainPlayerId,
          answer: (sc && myRole >= 0 ? sc.scenario.answers[myRole] : undefined) ?? randomAnswer(),
        });
      });
      return;
    }

    // ----- SUBSTITUTE_ANSWERING (substitute) -----
    if (phase === RoundPhase.SUBSTITUTE_ANSWERING && isSubstitute) {
      schedule(`${mainRoundNumber}:submitSubstituteAnswer`, 500 + Math.random() * 600, () => {
        socket.emit('submitSubstituteAnswer', {
          lobbyCode,
          answer: sc?.scenario.substitute?.answer ?? randomAnswer(),
        });
      });
      return;
    }

    // ----- GUESSING (leader) -----
    // Le listener long-lived déclenche submitGuesses ; on (re)demande le
    // shuffle pour amorcer la réponse.
    if (phase === RoundPhase.GUESSING && isLeader) {
      schedule(`${mainRoundNumber}:requestShuffled`, 400, () => {
        socket.emit('requestShuffledAnswers', { lobbyCode });
      });
      return;
    }

    // ----- REVEAL (leader) -----
    // Boucle de reveal séquentiel + nextRound. PAS de cleanup `cancelled` :
    // un re-render ne doit pas tuer la séquence. firedRef garantit qu'on
    // ne relance pas la boucle deux fois pour le même round.
    if (phase === RoundPhase.REVEAL && isLeader) {
      const key = `${mainRoundNumber}:reveal`;
      if (firedRef.current.has(key)) return;
      firedRef.current.add(key);

      // En mode "Devine ma réponse", le pool de devinette inclut la réponse du substitut
      // (clé = id du pilier), absente de round.answers : on l'ajoute pour ne pas s'arrêter
      // une réponse trop tôt (même formule que playerStats.computeTeamPct).
      const totalAnswers =
        Object.keys(round.answers ?? {}).length +
        (round.guessMyAnswerMode && round.substituteAnswer ? 1 : 0);
      // Tour de table (ordre fixé par le serveur), comme un pilier humain ; sinon dans
      // l'ordre des réponses (serveur antérieur). Les « Personne » sont révélés d'office.
      const order = revealOrderRef.current.length
        ? [...revealOrderRef.current]
        : Array.from({ length: totalAnswers }, (_, i) => i);
      const already = new Set(round.revealedIndices ?? []);
      let pos = 0;
      let decisions = 0;
      // Scénario : rythme humain (chaque overlay « qui a écrit ? » se joue en entier).
      const step = sc ? SCENARIO_REVEAL_STEP_MS : 900;

      const revealNext = () => {
        if (!botOn()) return;
        // Re-lire l'état courant : si le round a changé entre-temps, stop.
        const g = gameRef.current;
        if (!g?.currentRound || g.currentRound.roundNumber !== round.roundNumber) return;
        if (g.currentRound.phase !== RoundPhase.REVEAL) return;
        const now = currentScenario();

        // Similarité en attente : arrêt du scénario ici, ou décision (script, sinon au
        // hasard) après un temps pour voir la popup et les écrans allumés. Sans
        // décision, la carte suivante l'abandonnerait d'office.
        const pending = g.currentRound.pendingSimilarityIndex;
        if (pending != null) {
          if (now?.armed && now.stop === 'similarity') {
            handOverRef.current(now.stop);
            return;
          }
          const scripted = now?.scenario.similarityDecisions?.[decisions];
          decisions++;
          const confirm = now ? (scripted ?? 'confirm') === 'confirm' : Math.random() < 0.5;
          setTimeout(() => {
            if (!botOn()) return;
            socket.emit(confirm ? 'confirmSimilarity' : 'dismissSimilarity', { lobbyCode, answerIndex: pending });
            setTimeout(revealNext, now ? step : 1500);
          }, now ? SCENARIO_DECISION_DELAY_MS : 0);
          return;
        }

        const live = new Set(g.currentRound.revealedIndices ?? []);
        while (pos < order.length && (already.has(order[pos]) || live.has(order[pos]))) pos++;
        if (pos >= order.length) {
          if (now?.armed && now.stop === 'roundEnd') {
            handOverRef.current(now.stop);
            return;
          }
          setTimeout(() => {
            if (!botOn()) return;
            const gg = gameRef.current;
            if (!gg?.currentRound || gg.currentRound.roundNumber !== round.roundNumber) return;
            socket.emit('nextRound', { lobbyCode });
          }, 800);
          return;
        }
        const idx = order[pos++];
        // À distance, les spectateurs suivent le curseur du pilier.
        if (g.lobby?.gameMode === 'remote') socket.emit('advanceRevealCursor', { lobbyCode, nextIndex: idx });
        socket.emit('revealAnswer', { lobbyCode, answerIndex: idx });
        already.add(idx);
        setTimeout(revealNext, step);
      };

      setTimeout(revealNext, sc ? 1500 : 900);
    }
    // NB: pas de `players` ici - on lit playersRef pour éviter qu'un update
    // serveur (très fréquent) ne re-déclenche l'effect en milieu de phase.
  }, [mainRoundNumber, mainPhase, mainLeaderId, mainSubstituteId, mainPlayerId, lobbyCode, botWakeTick]);
}
