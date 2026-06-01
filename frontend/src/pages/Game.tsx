import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import socket from '../utils/socket';
import QuestionSelection from '../components/QuestionSelection';
import AnswerPhase from '../components/AnswerPhase';
import GuessingPhase from '../components/GuessingPhase';
import RevealPhase from '../components/RevealPhase';
import SubstituteSelection from '../components/SubstituteSelection';
import SubstituteAnsweringPhase from '../components/SubstituteAnsweringPhase';
import HourglassTimer from '../components/HourglassTimer';
import Logo from '../components/Logo';
import { STICKER_FILTER } from '../constants/icons';
import { useToast } from '../components/Toast';
import { getPhaseDuration } from '../constants/game';
import { useLeavePrompt, useReconnectOnVisible, useSocketEvent } from '../hooks';
import { getCurrentPlayerFromStorage } from '../utils/playerHelpers';
import { IPlayer, IRound, IGame, RoundPhase, GameStatus, RevealResult, GameCard, ReconnectionData } from '@onskone/shared';
import { isStudioFrame, studioSlotIndex } from '../utils/studioStorage';
import { useStudioBot } from '../hooks/useStudioBot';
import { useLocale } from '../i18n';

const GamePage: React.FC = () => {
  const { lobbyCode } = useParams<{ lobbyCode: string }>();
  const navigate = useNavigate();
  const showToast = useToast();
  const { t, locale } = useLocale();

  // Redirect if no lobby code
  useEffect(() => {
    if (!lobbyCode) {
      navigate('/');
    }
  }, [lobbyCode, navigate]);

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

  // Confirmation avant de quitter pendant une partie en cours
  useLeavePrompt(game?.status === GameStatus.IN_PROGRESS);

  // Studio: bot automation + state postMessage for pilier highlight in the parent.
  useStudioBot({ game, currentPlayer, players, lobbyCode: lobbyCode ?? null });
  useEffect(() => {
    if (!isStudioFrame) return;
    if (typeof window === 'undefined' || window.parent === window) return;
    try {
      window.parent.postMessage({
        type: 'studio:state',
        slot: studioSlotIndex,
        leaderId: game?.currentRound?.leader.id ?? null,
        currentPlayerId: currentPlayer?.id ?? null,
        phase: game?.currentRound?.phase ?? null,
        substitutePlayerId: game?.currentRound?.substitutePlayerId ?? null,
        playerName: currentPlayer?.name ?? null,
      }, '*');
    } catch { /* silent */ }
  }, [
    game?.currentRound?.leader.id,
    game?.currentRound?.phase,
    game?.currentRound?.substitutePlayerId,
    currentPlayer?.id,
    currentPlayer?.name,
  ]);

  // Fonction stable pour récupérer l'état du jeu : utilisée à la connexion initiale,
  // sur reconnexion socket, et au retour de l'app au premier plan.
  const fetchGameState = useCallback(() => {
    if (!lobbyCode) return;
    const player = getCurrentPlayerFromStorage();
    if (player?.id) {
      socket.emit('getGameState', { lobbyCode, playerId: player.id });
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

  const handleQuestionSelected = useCallback((data: { question: string; phase: RoundPhase; auto?: boolean; card?: GameCard }) => {
    setGame(prev => prev ? {
      ...prev,
      currentRound: prev.currentRound ? {
        ...prev.currentRound,
        selectedQuestion: data.question,
        phase: data.phase,
        gameCard: data.card ?? prev.currentRound.gameCard
      } : null
    } : null);
  }, []);

  const handleAllAnswersSubmitted = useCallback((data: { phase: RoundPhase; answersCount: number; forced?: boolean }) => {
    setGame(prev => prev ? {
      ...prev,
      currentRound: prev.currentRound ? { ...prev.currentRound, phase: data.phase } : null
    } : null);
  }, []);

  const handleSubstituteSelected = useCallback((data: { substitutePlayerId: string; phase: RoundPhase; auto?: boolean }) => {
    setGame(prev => prev ? {
      ...prev,
      currentRound: prev.currentRound ? {
        ...prev.currentRound,
        substitutePlayerId: data.substitutePlayerId,
        phase: data.phase
      } : null
    } : null);
  }, []);

  const handleSubstituteAnswerSubmitted = useCallback((data: { phase: RoundPhase; forced?: boolean }) => {
    setGame(prev => prev ? {
      ...prev,
      currentRound: prev.currentRound ? { ...prev.currentRound, phase: data.phase } : null
    } : null);
  }, []);

  const handleRevealResults = useCallback((data: { phase: RoundPhase; results: RevealResult[]; scores: Record<string, number> }) => {
    setGame(prev => prev ? {
      ...prev,
      currentRound: prev.currentRound ? { ...prev.currentRound, phase: data.phase } : null
    } : null);
    setRevealResults(data.results);
  }, []);

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

  const handleSocketError = useCallback((data: { message: string }) => {
    showToast(data.message, 'error', 5000);
  }, [showToast]);

  // Si le joueur est kické pendant la partie ou si le lobby ferme : toast + retour home.
  // Sinon il reste bloqué sur l'écran de jeu sans aucun retour visuel.
  const handleKickedFromLobby = useCallback((data?: { hostName?: string }) => {
    const message = data?.hostName
      ? t.lobby.toasts.kicked(data.hostName)
      : t.lobby.toasts.kickedAnon;
    showToast(message, 'error', 4500);
    navigate('/');
  }, [navigate, showToast, t]);

  const handleLobbyClosed = useCallback(() => {
    showToast(t.lobby.toasts.closedInactive, 'error', 4500);
    navigate('/');
  }, [navigate, showToast, t]);

  useSocketEvent('gameState', handleGameState, [handleGameState]);
  useSocketEvent('gameStarted', handleGameStarted, [handleGameStarted]);
  useSocketEvent('questionSelected', handleQuestionSelected, [handleQuestionSelected]);
  useSocketEvent('allAnswersSubmitted', handleAllAnswersSubmitted, [handleAllAnswersSubmitted]);
  useSocketEvent('substituteSelected', handleSubstituteSelected, [handleSubstituteSelected]);
  useSocketEvent('substituteAnswerSubmitted', handleSubstituteAnswerSubmitted, [handleSubstituteAnswerSubmitted]);
  useSocketEvent('revealResults', handleRevealResults, [handleRevealResults]);
  useSocketEvent('roundSkipped', handleRoundSkipped, [handleRoundSkipped]);
  useSocketEvent('roundStarted', handleRoundStarted, [handleRoundStarted]);
  useSocketEvent('gameEnded', handleGameEnded, [handleGameEnded]);
  useSocketEvent('updatePlayersList', handleUpdatePlayersList, [handleUpdatePlayersList]);
  useSocketEvent('error', handleSocketError, [handleSocketError]);
  useSocketEvent('kickedFromLobby', handleKickedFromLobby, [handleKickedFromLobby]);
  useSocketEvent('lobbyClosed', handleLobbyClosed, [handleLobbyClosed]);

  const renderPhase = () => {
    if (!game || !game.currentRound || !currentPlayer) {
      return (
        <div className="flex items-center justify-center h-full">
          <p className="text-xl text-white">{t.game.loading}</p>
        </div>
      );
    }

    const phase = game.currentRound.phase;
    const gameMode = game.lobby.gameMode ?? 'local';
    const timeMultiplier = game.lobby.timeMultiplier ?? 1;
    // Vérifier si c'est le dernier round (tous les joueurs ACTIFS ont été pilier une fois)
    const activePlayers = players.filter(p => p.isActive);
    const isGameOver = game.currentRound.roundNumber >= activePlayers.length;

    switch (phase) {
      case RoundPhase.QUESTION_SELECTION:
        return (
          <QuestionSelection
            key={`question-selection-${game.currentRound.roundNumber}`}
            lobbyCode={lobbyCode!}
            isLeader={isLeader}
            leader={game.currentRound.leader}
            timeMultiplier={timeMultiplier}
          />
        );

      case RoundPhase.SUBSTITUTE_SELECTION:
        return (
          <SubstituteSelection
            key={`substitute-selection-${game.currentRound.roundNumber}`}
            lobbyCode={lobbyCode!}
            isLeader={isLeader}
            leaderId={game.currentRound.leader.id}
            players={players}
            question={game.currentRound.selectedQuestion || ''}
            card={game.currentRound.gameCard}
            timeMultiplier={timeMultiplier}
          />
        );

      case RoundPhase.SUBSTITUTE_ANSWERING:
        return (
          <SubstituteAnsweringPhase
            key={`substitute-answering-${game.currentRound.roundNumber}`}
            lobbyCode={lobbyCode!}
            question={game.currentRound.selectedQuestion || ''}
            card={game.currentRound.gameCard}
            currentPlayerId={currentPlayer.id}
            players={players}
            leaderId={game.currentRound.leader.id}
            substitutePlayerId={game.currentRound.substitutePlayerId}
            gameMode={gameMode}
            timeMultiplier={timeMultiplier}
          />
        );

      case RoundPhase.ANSWERING:
        return (
          <AnswerPhase
            key={`answer-phase-${game.currentRound.roundNumber}`}
            lobbyCode={lobbyCode!}
            question={game.currentRound.selectedQuestion || t.common.loading}
            card={game.currentRound.gameCard}
            isLeader={isLeader}
            currentPlayerId={currentPlayer.id}
            players={players}
            leaderId={game.currentRound.leader.id}
            initialAnsweredPlayerIds={reconnectionData?.answeredPlayerIds}
            initialMyAnswer={reconnectionData?.myAnswer}
            timeMultiplier={timeMultiplier}
          />
        );

      case RoundPhase.GUESSING:
        return (
          <GuessingPhase
            key={`guessing-phase-${game.currentRound.roundNumber}`}
            lobbyCode={lobbyCode!}
            isLeader={isLeader}
            leader={game.currentRound.leader}
            currentPlayerId={currentPlayer.id}
            question={game.currentRound.selectedQuestion || ''}
            card={game.currentRound.gameCard}
            initialGuesses={reconnectionData?.currentGuesses}
            playerCount={players.length}
            roundNumber={game.currentRound.roundNumber}
            gameMode={gameMode}
            timeMultiplier={timeMultiplier}
          />
        );

      case RoundPhase.REVEAL:
        return (
          <RevealPhase
            key={`reveal-phase-${game.currentRound.roundNumber}`}
            lobbyCode={lobbyCode!}
            isLeader={isLeader}
            leader={game.currentRound.leader}
            currentPlayerId={currentPlayer.id}
            isGameOver={isGameOver}
            results={revealResults}
            question={game.currentRound.selectedQuestion || ''}
            card={game.currentRound.gameCard}
            initialRevealedIndices={reconnectionData?.revealedIndices}
            gameMode={gameMode}
          />
        );

      default:
        return <div className="text-red-600 font-bold p-4">Phase inconnue: {String(phase)}</div>;
    }
  };

  return (
    <div className="h-full flex flex-col items-center justify-center overflow-hidden px-2 tablet:px-0 safe-pt relative">
      {/* Logo desktop uniquement - positionné absolu pour ne pas perturber le centrage vertical */}
      <div className="hidden md:flex absolute top-0 left-0 right-0 justify-center pointer-events-none z-0">
        <Logo size="small" />
      </div>
      {/* Main game area - sized to content, centré dans la fenêtre. La carte
          interne a son propre cap dvh pour scroller si la phase dépasse.
          Erreurs et notifs sont remontées via le Toast global (haut centré). */}
      <div
        className="w-full max-w-4xl max-h-full min-h-0 mx-auto px-2 pt-2 tablet:pt-4 flex flex-col safe-pb"
      >
        <div className="min-h-0 max-h-[80dvh] phone-landscape:max-h-none phone-landscape:h-[90dvh] bg-white rounded-xl px-2 py-5 tablet:px-4 tablet:py-7 phone-landscape:!p-2 phone-landscape:tablet:!p-4 flex flex-col overflow-hidden border-[2.5px] border-black stack-shadow texture-paper">
          {/* Game info header : round + host à gauche, sablier à droite */}
          <div className="shrink-0 flex items-center justify-between gap-3 mb-2 tablet:mb-4 pb-2 tablet:pb-3 border-b-[2.5px] border-dashed border-black/30">
            <div className="flex items-center gap-1.5 flex-wrap text-gray-800 text-left">
              <span className="text-xs tablet:text-sm font-display font-bold tracking-wide">
                Round {game?.currentRound?.roundNumber || 0}<span className="text-gray-400">/{players.length}</span>
              </span>
              <span className="text-gray-300">•</span>
              <Icon icon="fluent-emoji-flat:crown" width="1.1em" height="1.1em" aria-hidden style={{ filter: STICKER_FILTER }} />
              <span className="text-xs tablet:text-sm font-display font-semibold tracking-wide truncate max-w-[140px] tablet:max-w-[220px]">
                {game?.currentRound?.leader.name || '...'}
              </span>
            </div>
            {(() => {
              const phase = game?.currentRound?.phase;
              const phaseDuration =
                phase && phase !== RoundPhase.REVEAL
                  ? getPhaseDuration(phase, game?.lobby?.timeMultiplier ?? 1, players.length)
                  : null;
              // Placeholder de la largeur réelle du sablier (size="sm") pour éviter
              // qu'il y ait un grand vide à droite du header en phase REVEAL (sans
              // timer). Sinon en paysage phone la zone faisait 56px alors que le
              // sablier ne fait que 24px → décalage visuel marqué entre phases.
              if (!phase || phaseDuration === null) return <div className="w-[24px] tablet:w-14" aria-hidden />;
              return (
                <HourglassTimer
                  key={`top-timer-${game?.currentRound?.roundNumber}-${phase}`}
                  duration={phaseDuration}
                  phase={phase}
                  lobbyCode={lobbyCode}
                  size="sm"
                />
              );
            })()}
          </div>

          <div
            key={`${game?.currentRound?.roundNumber ?? 0}-${game?.currentRound?.phase ?? 'none'}`}
            className="flex-1 min-h-0 flex flex-col animate-phase-enter"
          >
            {renderPhase()}
          </div>
        </div>
      </div>

    </div>
  );
};

export default GamePage;
