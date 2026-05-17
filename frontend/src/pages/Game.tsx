import { useCallback, useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import socket from '../utils/socket';
import QuestionSelection from '../components/QuestionSelection';
import AnswerPhase from '../components/AnswerPhase';
import GuessingPhase from '../components/GuessingPhase';
import RevealPhase from '../components/RevealPhase';
import SubstituteSelection from '../components/SubstituteSelection';
import SubstituteAnsweringPhase from '../components/SubstituteAnsweringPhase';
import Logo from '../components/Logo';
import HourglassTimer from '../components/HourglassTimer';
import { GAME_CONFIG } from '../constants/game';
import { useLeavePrompt, useReconnectOnVisible } from '../hooks';
import { getCurrentPlayerFromStorage } from '../utils/playerHelpers';
import { IPlayer, IRound, IGame, RoundPhase, GameStatus, RevealResult, GameCard } from '@onskone/shared';
import { isStudioFrame, studioSlotIndex } from '../utils/studioStorage';
import { useStudioBot } from '../hooks/useStudioBot';

const GamePage: React.FC = () => {
  const { lobbyCode } = useParams<{ lobbyCode: string }>();
  const navigate = useNavigate();

  // Redirect if no lobby code
  useEffect(() => {
    if (!lobbyCode) {
      navigate('/');
    }
  }, [lobbyCode, navigate]);

  const [game, setGame] = useState<IGame | null>(null);
  const [players, setPlayers] = useState<IPlayer[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<IPlayer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [revealResults, setRevealResults] = useState<RevealResult[]>([]);
  const [reconnectionData, setReconnectionData] = useState<{
    answeredPlayerIds: string[];
    myAnswer?: string;
    currentGuesses?: Record<string, string>;
    revealResults?: RevealResult[];
    revealedIndices?: number[];
  } | null>(null);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notificationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Calculer isLeader directement (pas de useEffect) pour éviter les race conditions
  const isLeader = !!(game?.currentRound && currentPlayer && game.currentRound.leader.id === currentPlayer.id);

  // Confirmation avant de quitter pendant une partie en cours
  useLeavePrompt(undefined, game?.status === GameStatus.IN_PROGRESS);

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

  useEffect(() => {
    // Récupérer le joueur courant pour l'état local
    const player = getCurrentPlayerFromStorage();
    if (player) setCurrentPlayer(player);

    // Demander l'état actuel du jeu au serveur
    fetchGameState();

    // ===== Handlers nommés (cleanup ciblé pour ne pas affecter d'autres composants) =====
    const onGameState = (data: {
      game: IGame;
      players: IPlayer[];
      reconnectionData?: {
        answeredPlayerIds: string[];
        myAnswer?: string;
        currentGuesses?: Record<string, string>;
        revealResults?: RevealResult[];
        revealedIndices?: number[];
      };
    }) => {
      setGame(data.game);
      setPlayers(data.players);
      if (data.reconnectionData) {
        setReconnectionData(data.reconnectionData);
        if (data.reconnectionData.revealResults) {
          setRevealResults(data.reconnectionData.revealResults);
        }
      }
    };

    const onGameStarted = (data: { game: IGame }) => {
      setGame(data.game);
    };

    const onQuestionSelected = (data: { question: string; phase: RoundPhase; auto?: boolean; card?: GameCard }) => {
      setGame(prev => prev ? {
        ...prev,
        currentRound: prev.currentRound ? {
          ...prev.currentRound,
          selectedQuestion: data.question,
          phase: data.phase,
          gameCard: data.card ?? prev.currentRound.gameCard
        } : null
      } : null);
    };

    const onAllAnswersSubmitted = (data: { phase: RoundPhase; answersCount: number; forced?: boolean }) => {
      setGame(prev => prev ? {
        ...prev,
        currentRound: prev.currentRound ? {
          ...prev.currentRound,
          phase: data.phase
        } : null
      } : null);
    };

    const onSubstituteSelected = (data: { substitutePlayerId: string; phase: RoundPhase; auto?: boolean }) => {
      setGame(prev => prev ? {
        ...prev,
        currentRound: prev.currentRound ? {
          ...prev.currentRound,
          substitutePlayerId: data.substitutePlayerId,
          phase: data.phase
        } : null
      } : null);
    };

    const onSubstituteAnswerSubmitted = (data: { phase: RoundPhase; forced?: boolean }) => {
      setGame(prev => prev ? {
        ...prev,
        currentRound: prev.currentRound ? {
          ...prev.currentRound,
          phase: data.phase
        } : null
      } : null);
    };

    const onRevealResults = (data: { phase: RoundPhase; results: RevealResult[]; scores: Record<string, number> }) => {
      setGame(prev => prev ? {
        ...prev,
        currentRound: prev.currentRound ? {
          ...prev.currentRound,
          phase: data.phase
        } : null
      } : null);
      setRevealResults(data.results);
    };

    const onRoundSkipped = (data: { skippedLeaderName: string; reason: 'leader_disconnected' }) => {
      setNotification(`${data.skippedLeaderName} s'est déconnecté - round passé`);
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
      notificationTimeoutRef.current = setTimeout(() => setNotification(null), 5000);
    };

    const onRoundStarted = (data: { round: IRound }) => {
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
          players: players,
          selectedDecks: {},
          gameMode: 'local',
          guessMyAnswerMode: false
        };
        return {
          lobby: minimalLobby,
          currentRound: data.round,
          status: GameStatus.IN_PROGRESS,
          rounds: [data.round]
        };
      });
    };

    const onGameEnded = () => {
      navigate(`/endgame/${lobbyCode}`);
    };

    const onUpdatePlayersList = (data: { players: IPlayer[] }) => {
      setPlayers(data.players);
    };

    const onError = (data: { message: string }) => {
      setError(data.message);
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
      errorTimeoutRef.current = setTimeout(() => setError(null), 5000);
    };

    socket.on('gameState', onGameState);
    socket.on('gameStarted', onGameStarted);
    socket.on('questionSelected', onQuestionSelected);
    socket.on('allAnswersSubmitted', onAllAnswersSubmitted);
    socket.on('substituteSelected', onSubstituteSelected);
    socket.on('substituteAnswerSubmitted', onSubstituteAnswerSubmitted);
    socket.on('revealResults', onRevealResults);
    socket.on('roundSkipped', onRoundSkipped);
    socket.on('roundStarted', onRoundStarted);
    socket.on('gameEnded', onGameEnded);
    socket.on('updatePlayersList', onUpdatePlayersList);
    socket.on('error', onError);

    return () => {
      socket.off('gameState', onGameState);
      socket.off('gameStarted', onGameStarted);
      socket.off('questionSelected', onQuestionSelected);
      socket.off('allAnswersSubmitted', onAllAnswersSubmitted);
      socket.off('substituteSelected', onSubstituteSelected);
      socket.off('substituteAnswerSubmitted', onSubstituteAnswerSubmitted);
      socket.off('revealResults', onRevealResults);
      socket.off('roundSkipped', onRoundSkipped);
      socket.off('roundStarted', onRoundStarted);
      socket.off('gameEnded', onGameEnded);
      socket.off('updatePlayersList', onUpdatePlayersList);
      socket.off('error', onError);
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
      if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
    };
  }, [navigate, lobbyCode, fetchGameState]);

  const renderPhase = () => {
    if (!game || !game.currentRound || !currentPlayer) {
      return (
        <div className="flex items-center justify-center h-full">
          <p className="text-xl text-white">Chargement du jeu...</p>
        </div>
      );
    }

    const phase = game.currentRound.phase;
    const gameMode = game.lobby.gameMode ?? 'local';
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
          />
        );

      case RoundPhase.ANSWERING:
        return (
          <AnswerPhase
            key={`answer-phase-${game.currentRound.roundNumber}`}
            lobbyCode={lobbyCode!}
            question={game.currentRound.selectedQuestion || 'Chargement...'}
            card={game.currentRound.gameCard}
            isLeader={isLeader}
            currentPlayerId={currentPlayer.id}
            players={players}
            leaderId={game.currentRound.leader.id}
            initialAnsweredPlayerIds={reconnectionData?.answeredPlayerIds}
            initialMyAnswer={reconnectionData?.myAnswer}
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
    <div className="min-h-screen flex flex-col px-2 md:px-0">
      {/* Logo */}
      <div className="flex justify-center pt-5 md:pt-7 pb-2 md:pb-4">
        <Logo size="small" />
      </div>

      {/* Error message */}
      {error && (
        <div className="w-full max-w-4xl mx-auto px-2">
          <div className="bg-red-500 text-white p-3 md:p-4 rounded-lg mb-3 md:mb-4 text-sm md:text-base">
            {error}
          </div>
        </div>
      )}

      {/* Notification message (round skipped, etc.) */}
      {notification && (
        <div className="w-full max-w-4xl mx-auto px-2">
          <div className="bg-amber-500 text-white p-3 md:p-4 rounded-lg mb-3 md:mb-4 text-sm md:text-base text-center flex items-center justify-center gap-2">
            <Icon icon="fluent-emoji-flat:warning" width="1.2em" height="1.2em" aria-hidden />
            <span>{notification}</span>
          </div>
        </div>
      )}

      {/* Main game area - centered */}
      <div
        className={`flex-1 w-full max-w-4xl mx-auto px-2 pb-7 md:pb-10 flex flex-col md:pt-0 ${
          (game?.currentRound?.phase === RoundPhase.GUESSING ||
           game?.currentRound?.phase === RoundPhase.SUBSTITUTE_SELECTION ||
           game?.currentRound?.phase === RoundPhase.SUBSTITUTE_ANSWERING ||
           (game?.currentRound?.phase === RoundPhase.QUESTION_SELECTION && isLeader))
            ? 'pt-0'
            : 'pt-[5vh]'
        }`}
        style={{ paddingBottom: 'calc(1.75rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="bg-white rounded-xl p-2 md:p-4 min-h-[400px] md:min-h-[500px] flex flex-col border-[2.5px] border-black stack-shadow texture-paper">
          {/* Game info header : round + host à gauche, sablier à droite */}
          <div className="flex items-center justify-between gap-3 mb-2 md:mb-4 pb-2 md:pb-3 border-b-[2.5px] border-dashed border-black/30">
            <div className="flex items-center gap-1.5 flex-wrap text-gray-800 text-left">
              <span className="text-xs md:text-sm font-display font-bold tracking-wide">
                Round {game?.currentRound?.roundNumber || 0}<span className="text-gray-400">/{players.length}</span>
              </span>
              <span className="text-gray-300">•</span>
              <Icon icon="fluent-emoji-flat:crown" width="1.1em" height="1.1em" aria-hidden />
              <span className="text-xs md:text-sm font-display font-semibold tracking-wide truncate max-w-[140px] md:max-w-[220px]">
                {game?.currentRound?.leader.name || '...'}
              </span>
            </div>
            {(() => {
              const phase = game?.currentRound?.phase;
              const phaseDuration =
                phase === RoundPhase.QUESTION_SELECTION ? GAME_CONFIG.TIMERS.QUESTION_SELECTION :
                phase === RoundPhase.SUBSTITUTE_SELECTION ? GAME_CONFIG.TIMERS.SUBSTITUTE_SELECTION :
                phase === RoundPhase.ANSWERING ? GAME_CONFIG.TIMERS.ANSWERING :
                phase === RoundPhase.SUBSTITUTE_ANSWERING ? GAME_CONFIG.TIMERS.SUBSTITUTE_ANSWERING :
                phase === RoundPhase.GUESSING ? GAME_CONFIG.TIMERS.GUESSING :
                null;
              if (!phase || phaseDuration === null) return <div className="w-[56px]" aria-hidden />;
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
            className="flex-1 animate-phase-enter"
          >
            {renderPhase()}
          </div>
        </div>
      </div>

    </div>
  );
};

export default GamePage;
