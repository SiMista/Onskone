import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../utils/socket';
import { useReconnectOnVisible, useSocketEvent } from './index';
import { getCurrentPlayerFromStorage, getReconnectToken, clearLastGame } from '../utils/playerHelpers';
import {
  IPlayer, IRound, IGame, RoundPhase, GameStatus, RevealResult, GameCard, ReconnectionData, GAME_CONSTANTS,
  gameFingerprint, SYNC_CHECK_INTERVAL_MS, SYNC_ACK_TIMEOUT_MS,
} from '@onskone/shared';
import type { ErrorCode } from '@onskone/shared';
import { useToast } from '../components/Toast';
import { useLocale } from '../i18n';
import { mergeGameState, deltaMatchesCurrentRound, isFinished, LOADING_SLOW_MS, RESYNC_MIN_GAP_MS } from '../utils/gameSync';
import { reportClientLog } from '../utils/clientLog';

/**
 * Ordre canonique des phases, pour écarter un `gameState` périmé (cf. mergeGameState).
 * SUBSTITUTE_* sont intercalées : elles n'existent qu'en mode « Devine ma réponse »,
 * et leur absence d'un round ne fausse pas la comparaison.
 */
const PHASE_ORDER: RoundPhase[] = [
  RoundPhase.QUESTION_SELECTION,
  RoundPhase.SUBSTITUTE_SELECTION,
  RoundPhase.ANSWERING,
  RoundPhase.SUBSTITUTE_ANSWERING,
  RoundPhase.GUESSING,
  RoundPhase.REVEAL,
];

/** Relances d'une resync refusée avant tout état : délais croissants, puis on abandonne. */
const RESYNC_RETRY_DELAYS = [600, 1500, 3000] as const;
const RESYNC_MAX_RETRIES = RESYNC_RETRY_DELAYS.length;

interface UseGameStateResult {
  game: IGame | null;
  players: IPlayer[];
  currentPlayer: IPlayer | null;
  revealResults: RevealResult[];
  reconnectionData: ReconnectionData | null;
  isLeader: boolean;
  /**
   * Incrémenté quand une resynchronisation complète change l'écran à afficher : la
   * page l'inclut dans la clé des composants de phase pour les remonter avec les
   * données de reconnexion à jour (ils ne les lisent qu'au montage).
   */
  syncEpoch: number;
  /** Aucun état reçu depuis LOADING_SLOW_MS : proposer de réessayer / rentrer. */
  loadingSlow: boolean;
  /** Reconnexion forcée + nouvelle demande d'état. */
  retrySync: () => void;
}

/**
 * État de la partie en cours et toute sa synchronisation avec le serveur.
 *
 * Principe : le serveur est la seule source de vérité, et le client CONVERGE vers
 * lui quoi qu'il ait raté (socket tombé, appli en arrière-plan, évènement perdu) :
 *  - état complet (`gameState`) à l'arrivée, à chaque reconnexion et au retour au
 *    premier plan ;
 *  - `syncCheck` périodique avec l'empreinte de l'écran affiché : le serveur renvoie
 *    l'état complet si elle diffère de la sienne ; sans AUCUNE réponse (socket
 *    zombie), reconnexion forcée ;
 *  - chaque delta de phase porte son numéro de manche : un delta d'une autre manche
 *    n'est jamais appliqué (c'était la cause des questions / piliers différents
 *    entre joueurs), il déclenche une resynchronisation.
 */
export function useGameState(lobbyCode: string | undefined): UseGameStateResult {
  const navigate = useNavigate();
  const showToast = useToast();
  const { t, locale } = useLocale();

  const [game, setGame] = useState<IGame | null>(null);
  const [players, setPlayers] = useState<IPlayer[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<IPlayer | null>(null);
  const [revealResults, setRevealResults] = useState<RevealResult[]>([]);
  const [reconnectionData, setReconnectionData] = useState<ReconnectionData | null>(null);
  const [syncEpoch, setSyncEpoch] = useState(0);
  const [loadingSlow, setLoadingSlow] = useState(false);

  // Réfs à jour lues par les handlers socket et le tick de synchro (stables).
  const gameRef = useRef(game);
  gameRef.current = game;
  const playersRef = useRef(players);
  playersRef.current = players;
  const currentPlayerRef = useRef(currentPlayer);
  currentPlayerRef.current = currentPlayer;

  // Calculer isLeader directement (pas de useEffect) pour éviter les race conditions
  const isLeader = !!(game?.currentRound && currentPlayer && game.currentRound.leader.id === currentPlayer.id);

  // Session perdue (joueur inconnu du téléphone, secret refusé, slot supprimé) :
  // retour à l'accueil AVEC le code, où la popup « tu étais qui ? » permet de
  // reprendre sa place sans rien d'autre.
  const goToReclaim = useCallback(() => {
    clearLastGame(lobbyCode);
    navigate(lobbyCode ? `/?lobbyCode=${encodeURIComponent(lobbyCode)}` : '/', { replace: true });
  }, [navigate, lobbyCode]);

  // Demande d'état complet (reconnexion prouvée par le secret) : utilisée à la
  // connexion initiale, sur reconnexion socket, au retour au premier plan et
  // quand un delta révèle une désynchronisation.
  const fetchGameState = useCallback(() => {
    if (!lobbyCode) return;
    const player = getCurrentPlayerFromStorage();
    if (!player?.id) {
      goToReclaim();
      return;
    }
    socket.emit('getGameState', { lobbyCode, playerId: player.id, reconnectToken: getReconnectToken(lobbyCode) });
  }, [lobbyCode, goToReclaim]);

  // Resynchronisation déclenchée par une incohérence : au plus une par RESYNC_MIN_GAP_MS
  // (une rafale de deltas périmés ne doit pas générer une rafale de demandes).
  const lastResyncAtRef = useRef(0);
  const requestResync = useCallback((why: string) => {
    const now = Date.now();
    if (now - lastResyncAtRef.current < RESYNC_MIN_GAP_MS) return;
    lastResyncAtRef.current = now;
    reportClientLog('gameSync', `Resynchronisation : ${why}`, { lobbyCode, fingerprint: gameFingerprint(gameRef.current) }, 'info');
    fetchGameState();
  }, [fetchGameState, lobbyCode]);

  // Écouter les reconnexions socket + visibilitychange
  useReconnectOnVisible(fetchGameState);

  // Récupération initiale : joueur depuis le storage + état du jeu depuis le serveur.
  useEffect(() => {
    const player = getCurrentPlayerFromStorage();
    if (player) setCurrentPlayer(player);
    fetchGameState();
  }, [fetchGameState]);

  // Reconnexion forcée : socket.io ne détecte un socket zombie qu'au ping timeout ;
  // couper/relancer déclenche `connect`, donc une nouvelle demande d'état.
  const forceReconnect = useCallback(() => {
    socket.disconnect();
    socket.connect();
  }, []);

  const retrySync = useCallback(() => {
    setLoadingSlow(false);
    forceReconnect();
  }, [forceReconnect]);

  // Chargement trop long : proposer réessayer / accueil plutôt qu'un écran figé.
  useEffect(() => {
    if (game) {
      setLoadingSlow(false);
      return;
    }
    const timer = setTimeout(() => setLoadingSlow(true), LOADING_SLOW_MS);
    return () => clearTimeout(timer);
  }, [game]);

  // ===== Boucle de synchronisation =====
  const ackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearAckTimer = useCallback(() => {
    if (ackTimerRef.current) {
      clearTimeout(ackTimerRef.current);
      ackTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!lobbyCode) return;
    const tick = () => {
      const current = gameRef.current;
      const me = currentPlayerRef.current;
      if (!current || !me?.id || !socket.connected) return;
      socket.emit('syncCheck', { lobbyCode, playerId: me.id, fingerprint: gameFingerprint(current) });
      if (ackTimerRef.current) return; // une réponse est déjà attendue
      ackTimerRef.current = setTimeout(() => {
        ackTimerRef.current = null;
        reportClientLog('gameSync', 'Aucune réponse au syncCheck : reconnexion forcée', { lobbyCode }, 'warn');
        forceReconnect();
      }, SYNC_ACK_TIMEOUT_MS);
    };
    const interval = setInterval(tick, SYNC_CHECK_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      clearAckTimer();
    };
  }, [lobbyCode, forceReconnect, clearAckTimer]);

  const handleSyncResult = useCallback((data: { status: 'ok' | 'detached' }) => {
    clearAckTimer();
    // Socket non rattaché au slot (évincé, slot non repris) : reconnexion complète.
    if (data.status === 'detached') requestResync('socket détaché du slot');
  }, [clearAckTimer, requestResync]);

  // ===== Handlers socket =====
  const handleGameState = useCallback((data: { game: IGame; players: IPlayer[]; reconnectionData?: ReconnectionData }) => {
    clearAckTimer();
    resyncRetryRef.current = 0;

    if (isFinished(data.game)) {
      // `gameEnded` raté : la partie est finie, direction l'écran de fin.
      clearLastGame(lobbyCode);
      navigate(`/endgame/${lobbyCode}`);
      return;
    }

    const decision = mergeGameState(gameRef.current, data.game, PHASE_ORDER);
    if (!decision.apply) return;
    setGame(decision.game);
    setPlayers(data.players);
    if (data.reconnectionData) {
      setReconnectionData(data.reconnectionData);
      if (data.reconnectionData.revealResults) {
        setRevealResults(data.reconnectionData.revealResults);
      }
    }
    // L'écran affiché était faux ou incomplet : remonter les composants de phase
    // pour qu'ils relisent les données de reconnexion.
    if (decision.screenChanged && gameRef.current) setSyncEpoch((e) => e + 1);
  }, [clearAckTimer, lobbyCode, navigate]);

  const handleGameStarted = useCallback((data: { game: IGame }) => {
    // Nouvelle partie (ou reprise) : état neuf, rien de l'ancienne manche ne doit rester.
    setGame(data.game);
    setRevealResults([]);
    setReconnectionData(null);
  }, []);

  // Applique un patch partiel au round courant, UNIQUEMENT s'il concerne la manche
  // affichée ; sinon resynchronisation (le client a raté une transition).
  const patchRound = useCallback((roundNumber: number | undefined, patch: Partial<IRound>, event: string) => {
    if (!deltaMatchesCurrentRound(gameRef.current, roundNumber)) {
      requestResync(`${event} pour la manche ${roundNumber ?? '?'} alors que la manche affichée est ${gameRef.current?.currentRound?.roundNumber ?? 'aucune'}`);
      return false;
    }
    setGame(prev => prev ? {
      ...prev,
      currentRound: prev.currentRound ? { ...prev.currentRound, ...patch } : null
    } : null);
    return true;
  }, [requestResync]);

  const handleQuestionSelected = useCallback((data: { question: string; phase: RoundPhase; auto?: boolean; card?: GameCard; roundNumber?: number }) => {
    // gameCard seulement si fourni (sinon on conserve la carte courante via le spread).
    const patch: Partial<IRound> = { selectedQuestion: data.question, phase: data.phase };
    if (data.card) patch.gameCard = data.card;
    patchRound(data.roundNumber, patch, 'questionSelected');
  }, [patchRound]);

  const handleAllAnswersSubmitted = useCallback((data: { phase: RoundPhase; answersCount: number; forced?: boolean; roundNumber?: number }) => {
    patchRound(data.roundNumber, { phase: data.phase }, 'allAnswersSubmitted');
  }, [patchRound]);

  const handleSubstituteSelected = useCallback((data: { substitutePlayerId: string; phase: RoundPhase; auto?: boolean; roundNumber?: number }) => {
    patchRound(data.roundNumber, { substitutePlayerId: data.substitutePlayerId, phase: data.phase }, 'substituteSelected');
  }, [patchRound]);

  const handleSubstituteAnswerSubmitted = useCallback((data: { phase: RoundPhase; forced?: boolean; roundNumber?: number }) => {
    patchRound(data.roundNumber, { phase: data.phase }, 'substituteAnswerSubmitted');
  }, [patchRound]);

  const handleRevealResults = useCallback((data: { phase: RoundPhase; results: RevealResult[]; scores: Record<string, number>; roundNumber?: number }) => {
    if (patchRound(data.roundNumber, { phase: data.phase }, 'revealResults')) {
      setRevealResults(data.results);
    }
  }, [patchRound]);

  // Les réponses révélées font partie de l'empreinte de synchro : les suivre ici
  // garde l'état local égal au serveur (sinon chaque révélation déclenchait une
  // resynchronisation complète chez tout le monde).
  const handleAnswerRevealed = useCallback((data: { revealedIndex: number; revealedIndices: number[]; roundNumber?: number }) => {
    patchRound(data.roundNumber, { revealedIndices: data.revealedIndices }, 'answerRevealed');
  }, [patchRound]);

  const handleRoundSkipped = useCallback((data: { skippedLeaderName: string; reason: 'leader_disconnected' | 'leader_idle' }) => {
    const message = data.reason === 'leader_idle'
      ? t.game.leaderIdle(data.skippedLeaderName)
      : t.game.leaderDisconnected(data.skippedLeaderName);
    showToast(message, 'warning', 5000);
  }, [showToast, t]);

  const handleRoundStarted = useCallback((data: { round: IRound }) => {
    // Nouvelle manche : rien de la précédente ne doit survivre.
    setReconnectionData(null);
    setRevealResults([]);
    setGame(prev => {
      if (prev) {
        // Dédoublonnage : un round peut déjà avoir été ajouté via gameState
        // (race entre reconnexion immédiate et roundStarted).
        const filtered = (prev.rounds || []).filter(r => r.roundNumber !== data.round.roundNumber);
        return {
          ...prev,
          currentRound: data.round,
          rounds: [...filtered, data.round]
        };
      }
      // Si game n'existe pas encore, créer un lobby minimal
      const minimalLobby: IGame['lobby'] = {
        code: lobbyCode || '',
        players: playersRef.current,
        selectedDecks: {},
        gameMode: 'local',
        guessMyAnswerMode: false,
        gameSpeed: GAME_CONSTANTS.GAME_SPEED_DEFAULT,
        excludedLeaderIds: [],
        locale
      };
      return {
        lobby: minimalLobby,
        currentRound: data.round,
        status: GameStatus.IN_PROGRESS,
        rounds: [data.round]
      };
    });
  }, [lobbyCode, locale]);

  const handleGameEnded = useCallback(() => {
    // Partie finie : plus rien à reprendre depuis l'accueil.
    clearLastGame(lobbyCode);
    navigate(`/endgame/${lobbyCode}`);
  }, [navigate, lobbyCode]);

  const handleUpdatePlayersList = useCallback((data: { players: IPlayer[] }) => {
    setPlayers(data.players);
  }, []);

  // Un refus de `getGameState` AVANT tout état est relancé quelques fois (lock
  // transitoire) ; une fois le budget épuisé, c'est une session perdue.
  const resyncRetryRef = useRef(0);
  const resyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** @returns true si une relance a été planifiée (false = budget épuisé). */
  const scheduleResync = useCallback((): boolean => {
    if (resyncRetryRef.current >= RESYNC_MAX_RETRIES) return false;
    const attempt = resyncRetryRef.current++;
    if (resyncTimerRef.current) clearTimeout(resyncTimerRef.current);
    resyncTimerRef.current = setTimeout(fetchGameState, RESYNC_RETRY_DELAYS[attempt]);
    return true;
  }, [fetchGameState]);

  useEffect(() => () => { if (resyncTimerRef.current) clearTimeout(resyncTimerRef.current); }, []);

  const handleSocketError = useCallback((data: { message: string; code?: ErrorCode; sessionLost?: boolean }) => {
    // Une erreur EST une réponse du serveur : le socket n'est pas zombie.
    clearAckTimer();
    const hasState = gameRef.current !== null;
    const isRefusal = data.code === 'CONFLICT' || data.code === 'FORBIDDEN';
    // Salon/partie disparus (redéploiement, salon fermé) : rien à reprendre.
    if (data.sessionLost && data.code === 'NOT_FOUND') {
      showToast(t.game.lobbyGone, 'error', 5000);
      clearLastGame(lobbyCode);
      navigate('/', { replace: true });
      return;
    }
    // Le serveur ne reconnaît plus cette session (secret refusé, slot inconnu) : on
    // n'affiche JAMAIS un état figé sans le dire. Avant tout état, on relance
    // d'abord un peu (lock de reconnexion transitoire).
    if (data.sessionLost || (isRefusal && !hasState)) {
      if (!hasState && scheduleResync()) return;
      showToast(t.game.sessionLost, 'error', 5000);
      goToReclaim();
      return;
    }
    showToast(data.message, 'error', 5000);
    // Salon ou partie introuvable avant tout état : rester sur « chargement » n'a
    // plus de sens (retour via la popup de reprise vers un salon disparu).
    if (!hasState && data.code === 'NOT_FOUND') {
      clearLastGame(lobbyCode);
      navigate('/', { replace: true });
    }
  }, [showToast, scheduleResync, navigate, lobbyCode, goToReclaim, t, clearAckTimer]);

  // Évincé par le serveur : ce joueur a repris son slot depuis un autre appareil /
  // onglet. socket.io ne retente pas (« io server disconnect ») : sans ça, l'écran
  // restait figé en silence. On le dit et on rentre.
  useEffect(() => {
    const onDisconnect = (reason: string) => {
      if (reason !== 'io server disconnect') return;
      showToast(t.game.connectedElsewhere, 'info', 6000);
      navigate('/', { replace: true });
    };
    socket.on('disconnect', onDisconnect);
    return () => { socket.off('disconnect', onDisconnect); };
  }, [showToast, t, navigate]);

  useSocketEvent('gameState', handleGameState);
  useSocketEvent('answerRevealed', handleAnswerRevealed);
  useSocketEvent('syncResult', handleSyncResult);
  useSocketEvent('gameStarted', handleGameStarted);
  useSocketEvent('questionSelected', handleQuestionSelected);
  useSocketEvent('allAnswersSubmitted', handleAllAnswersSubmitted);
  useSocketEvent('substituteSelected', handleSubstituteSelected);
  useSocketEvent('substituteAnswerSubmitted', handleSubstituteAnswerSubmitted);
  useSocketEvent('revealResults', handleRevealResults);
  useSocketEvent('roundSkipped', handleRoundSkipped);
  useSocketEvent('roundStarted', handleRoundStarted);
  useSocketEvent('gameEnded', handleGameEnded);
  useSocketEvent('updatePlayersList', handleUpdatePlayersList);
  useSocketEvent('error', handleSocketError);

  return {
    game,
    players,
    currentPlayer,
    revealResults,
    reconnectionData,
    isLeader,
    syncEpoch,
    loadingSlow,
    retrySync,
  };
}
