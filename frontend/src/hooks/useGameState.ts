import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../utils/socket';
import { useReconnectOnVisible, useSocketEvent } from './index';
import { getCurrentPlayerFromStorage, getReconnectToken } from '../utils/playerHelpers';
import { IPlayer, IRound, IGame, RoundPhase, GameStatus, RevealResult, GameCard, ReconnectionData } from '@onskone/shared';
import type { ErrorCode } from '@onskone/shared';
import { useToast } from '../components/Toast';
import { useLocale } from '../i18n';

/**
 * Ordre canonique des phases, pour comparer la fraîcheur d'un `gameState` reçu.
 * SUBSTITUTE_* sont intercalées : elles n'existent qu'en mode « Devine ma réponse »,
 * et leur absence d'un round ne fausse pas la comparaison (on ne compare que des
 * phases d'un même round).
 */
const PHASE_ORDER: RoundPhase[] = [
  RoundPhase.QUESTION_SELECTION,
  RoundPhase.SUBSTITUTE_SELECTION,
  RoundPhase.ANSWERING,
  RoundPhase.SUBSTITUTE_ANSWERING,
  RoundPhase.GUESSING,
  RoundPhase.REVEAL,
];

/** Relances d'une resync refusée : délais croissants, puis on abandonne. */
const RESYNC_RETRY_DELAYS = [600, 1500, 3000] as const;
const RESYNC_MAX_RETRIES = RESYNC_RETRY_DELAYS.length;

interface UseGameStateResult {
  game: IGame | null;
  players: IPlayer[];
  currentPlayer: IPlayer | null;
  revealResults: RevealResult[];
  reconnectionData: ReconnectionData | null;
  isLeader: boolean;
}

/**
 * État de la partie en cours (game, joueurs, résultats de reveal, données de
 * reconnexion) et toute la synchronisation socket associée : récupération
 * initiale, reconnexion (socket + retour au premier plan), et les ~12 handlers
 * d'évènements serveur qui font avancer la machine à états du round.
 *
 * Extrait de `Game.tsx` en préservant strictement le comportement : mêmes
 * corps de handlers, mêmes tableaux de dépendances, mêmes refs. La vue
 * (`Game.tsx`) ne fait plus que consommer l'état retourné et rendre la phase.
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

  // Réf à jour de la liste de joueurs, lue par les handlers socket pour rester
  // stables (sinon roundStarted se réabonne à chaque updatePlayersList).
  const playersRef = useRef(players);
  playersRef.current = players;

  // Calculer isLeader directement (pas de useEffect) pour éviter les race conditions
  const isLeader = !!(game?.currentRound && currentPlayer && game.currentRound.leader.id === currentPlayer.id);

  // Fonction stable pour récupérer l'état du jeu : utilisée à la connexion initiale,
  // sur reconnexion socket, et au retour de l'app au premier plan.
  const fetchGameState = useCallback(() => {
    if (!lobbyCode) return;
    const player = getCurrentPlayerFromStorage();
    if (player?.id) {
      // Joindre le reconnectToken (secret) : il prouve l'identité lors d'une
      // reconnexion, autorisant la réassociation du socketId sans dépendre de l'UUID
      // public (le serveur retombe sur la garde de liveness si le token manque).
      socket.emit('getGameState', { lobbyCode, playerId: player.id, reconnectToken: getReconnectToken(lobbyCode) });
    }
  }, [lobbyCode]);

  // Écouter les reconnexions socket + visibilitychange
  useReconnectOnVisible(fetchGameState);

  // Récupération initiale : joueur depuis le storage + état du jeu depuis le serveur.
  useEffect(() => {
    const player = getCurrentPlayerFromStorage();
    if (player) setCurrentPlayer(player);
    fetchGameState();
  }, [fetchGameState]);

  // ===== Handlers socket =====
  const handleGameState = useCallback((data: { game: IGame; players: IPlayer[]; reconnectionData?: ReconnectionData }) => {
    // Garde de fraîcheur : un `gameState` est sérialisé au moment de la requête,
    // mais peut arriver APRÈS un event de phase déjà appliqué (questionSelected…).
    // Sans garde, l'écrasement intégral ramenait le client à la phase précédente :
    // le joueur se retrouvait sans question ni zone de saisie, définitivement (aucun
    // event n'étant rediffusé). On ignore donc un état plus ancien que l'actuel.
    setGame(prev => {
      const incoming = data.game;
      const prevRound = prev?.currentRound;
      const nextRound = incoming?.currentRound;
      if (prevRound && nextRound && prevRound.roundNumber === nextRound.roundNumber) {
        const order = PHASE_ORDER.indexOf(nextRound.phase);
        const prevOrder = PHASE_ORDER.indexOf(prevRound.phase);
        if (order !== -1 && prevOrder !== -1 && order < prevOrder) return prev;
      }
      if (prevRound && nextRound && nextRound.roundNumber < prevRound.roundNumber) return prev;
      return incoming;
    });
    setPlayers(data.players);
    resyncRetryRef.current = 0;
    if (data.reconnectionData) {
      setReconnectionData(data.reconnectionData);
      if (data.reconnectionData.revealResults) {
        setRevealResults(data.reconnectionData.revealResults);
      }
    }
  }, []);

  const handleGameStarted = useCallback((data: { game: IGame }) => {
    setGame(data.game);
  }, []);

  // Applique un patch partiel au round courant en factorisant la double garde
  // (game non-null + currentRound non-null) partagée par tous les handlers.
  const patchRound = useCallback((patch: Partial<IRound>) => {
    setGame(prev => prev ? {
      ...prev,
      currentRound: prev.currentRound ? { ...prev.currentRound, ...patch } : null
    } : null);
  }, []);

  const handleQuestionSelected = useCallback((data: { question: string; phase: RoundPhase; auto?: boolean; card?: GameCard }) => {
    // gameCard seulement si fourni (sinon on conserve la carte courante via le spread).
    const patch: Partial<IRound> = { selectedQuestion: data.question, phase: data.phase };
    if (data.card) patch.gameCard = data.card;
    patchRound(patch);
  }, [patchRound]);

  // Met à jour uniquement la phase du round courant (transitions sans autre payload).
  const setPhase = useCallback((phase: RoundPhase) => patchRound({ phase }), [patchRound]);

  const handleAllAnswersSubmitted = useCallback((data: { phase: RoundPhase; answersCount: number; forced?: boolean }) => {
    setPhase(data.phase);
  }, [setPhase]);

  const handleSubstituteSelected = useCallback((data: { substitutePlayerId: string; phase: RoundPhase; auto?: boolean }) => {
    patchRound({ substitutePlayerId: data.substitutePlayerId, phase: data.phase });
  }, [patchRound]);

  const handleSubstituteAnswerSubmitted = useCallback((data: { phase: RoundPhase; forced?: boolean }) => {
    setPhase(data.phase);
  }, [setPhase]);

  const handleRevealResults = useCallback((data: { phase: RoundPhase; results: RevealResult[]; scores: Record<string, number> }) => {
    setPhase(data.phase);
    setRevealResults(data.results);
  }, [setPhase]);

  const handleRoundSkipped = useCallback((data: { skippedLeaderName: string; reason: 'leader_disconnected' }) => {
    showToast(t.game.leaderDisconnected(data.skippedLeaderName), 'warning', 5000);
  }, [showToast, t]);

  const handleRoundStarted = useCallback((data: { round: IRound }) => {
    // Réinitialiser les données de reconnexion pour la nouvelle manche
    setReconnectionData(null);
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
        timeMultiplier: 1,
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
    navigate(`/endgame/${lobbyCode}`);
  }, [navigate, lobbyCode]);

  const handleUpdatePlayersList = useCallback((data: { players: IPlayer[] }) => {
    setPlayers(data.players);
  }, []);

  // `code` reste informatif ici : toutes les erreurs en jeu sont remontées
  // via le même toast ; le routing par code spécifique (kick/fermeture) passe par
  // des events dédiés gérés dans useLobbyExitEvents.
  // Un refus de `getGameState` laissait le client sur l'écran de chargement, sans
  // aucune relance : il fallait quitter et revenir. On réessaie quelques fois, en
  // espaçant — puis, budget épuisé, on AFFICHE l'erreur : un refus définitif
  // (token perdu, non-membre) doit se voir, pas se taire.
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

  const handleSocketError = useCallback((data: { message: string; code?: ErrorCode }) => {
    // Refus de resync pendant le chargement : on relance silencieusement tant
    // qu'il reste du budget (lock de reconnexion tenu, état transitoire). Une fois
    // les relances épuisées, le toast passe : sinon le joueur restait sur
    // « chargement » à vie sans le moindre message.
    const isResyncRefusal = data.code === 'CONFLICT' || data.code === 'FORBIDDEN';
    if (isResyncRefusal && !game && scheduleResync()) return;
    showToast(data.message, 'error', 5000);
  }, [showToast, game, scheduleResync]);

  useSocketEvent('gameState', handleGameState);
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
  };
}
