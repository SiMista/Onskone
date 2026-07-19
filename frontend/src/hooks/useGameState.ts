import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../utils/socket';
import { useReconnectOnVisible, useSocketEvent } from './index';
import { getCurrentPlayerFromStorage, getReconnectToken } from '../utils/playerHelpers';
import { IPlayer, IRound, IGame, RoundPhase, GameStatus, RevealResult, GameCard, ReconnectionData } from '@onskone/shared';
import type { ErrorCode } from '@onskone/shared';
import { useToast } from '../components/Toast';
import { useLocale } from '../i18n';

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
    setGame(data.game);
    setPlayers(data.players);
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
  const handleSocketError = useCallback((data: { message: string; code?: ErrorCode }) => {
    showToast(data.message, 'error', 5000);
  }, [showToast]);

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
