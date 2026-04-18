import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import socket from '../utils/socket';
import QuestionSelection from '../components/QuestionSelection';
import AnswerPhase from '../components/AnswerPhase';
import GuessingPhase from '../components/GuessingPhase';
import RevealPhase from '../components/RevealPhase';
import Logo from '../components/Logo';
import { useLeavePrompt } from '../hooks';
import { getCurrentPlayerFromStorage } from '../utils/playerHelpers';
import { IPlayer, IRound, IGame, RoundPhase, GameStatus, RevealResult } from '@onskone/shared';

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
    relancesUsed?: number;
    revealResults?: RevealResult[];
    revealedIndices?: number[];
  } | null>(null);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notificationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref pour tracker si on a déjà un listener once('connect') en attente
  const pendingConnectListenerRef = useRef<boolean>(false);

  // Calculer isLeader directement (pas de useEffect) pour éviter les race conditions
  const isLeader = !!(game?.currentRound && currentPlayer && game.currentRound.leader.id === currentPlayer.id);

  // Confirmation avant de quitter pendant une partie en cours
  useLeavePrompt(undefined, game?.status === GameStatus.IN_PROGRESS);

  useEffect(() => {
    // Récupérer et valider le joueur actuel depuis le localStorage
    let playerId: string | undefined;
    const player = getCurrentPlayerFromStorage();
    if (player) {
      setCurrentPlayer(player);
      playerId = player.id;
    }

    // Fonction pour demander l'état du jeu
    const fetchGameState = () => {
      if (lobbyCode && playerId) {
        socket.emit('getGameState', { lobbyCode: lobbyCode!, playerId });
      }
    };

    // Demander l'état actuel du jeu au serveur (avec playerId pour la reconnexion)
    fetchGameState();

    // Écouter les reconnexions socket (après perte de connexion)
    socket.on('connect', fetchGameState);

    // MOBILE: Écouter quand l'app redevient visible (retour après changement d'app)
    // Sur mobile, le socket peut être "pausé" sans se déconnecter complètement
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (socket.connected) {
          // Socket déjà connecté - resynchroniser immédiatement
          fetchGameState();
        } else if (!pendingConnectListenerRef.current) {
          // Socket déconnecté et pas de listener en attente
          // Évite d'empiler plusieurs listeners si visibility change rapidement
          pendingConnectListenerRef.current = true;
          const onConnect = () => {
            pendingConnectListenerRef.current = false;
            fetchGameState();
          };
          socket.once('connect', onConnect);
          socket.connect();
        }
        // Si pendingConnectListenerRef.current est true, on attend déjà une reconnexion
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Socket listeners
    socket.on('gameState', (data: {
      game: IGame;
      players: IPlayer[];
      reconnectionData?: {
        answeredPlayerIds: string[];
        myAnswer?: string;
        currentGuesses?: Record<string, string>;
        relancesUsed?: number;
        revealResults?: RevealResult[];
        revealedIndices?: number[];
      };
    }) => {
      setGame(data.game);
      setPlayers(data.players);
      if (data.reconnectionData) {
        setReconnectionData(data.reconnectionData);
        // Restaurer les résultats de révélation si présents
        if (data.reconnectionData.revealResults) {
          setRevealResults(data.reconnectionData.revealResults);
        }
      }
    });

    socket.on('gameStarted', (data: { game: IGame }) => {
      setGame(data.game);
    });

    socket.on('questionSelected', (data: { question: string; phase: RoundPhase; auto?: boolean }) => {
      setGame(prev => prev ? {
        ...prev,
        currentRound: prev.currentRound ? {
          ...prev.currentRound,
          selectedQuestion: data.question,
          phase: data.phase
        } : null
      } : null);
    });

    socket.on('allAnswersSubmitted', (data: { phase: RoundPhase; answersCount: number; forced?: boolean }) => {
      setGame(prev => prev ? {
        ...prev,
        currentRound: prev.currentRound ? {
          ...prev.currentRound,
          phase: data.phase
        } : null
      } : null);
    });

    socket.on('revealResults', (data: { phase: RoundPhase; results: RevealResult[]; scores: Record<string, number> }) => {
      setGame(prev => prev ? {
        ...prev,
        currentRound: prev.currentRound ? {
          ...prev.currentRound,
          phase: data.phase
        } : null
      } : null);

      // Stocker les résultats pour RevealPhase
      setRevealResults(data.results);
    });

    socket.on('roundSkipped', (data: { skippedLeaderName: string; reason: string }) => {
      // Afficher une notification que le round a été sauté
      setNotification(`${data.skippedLeaderName} s'est déconnecté - round passé`);
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
      notificationTimeoutRef.current = setTimeout(() => setNotification(null), 5000);
    });

    socket.on('roundStarted', (data: { round: IRound }) => {
      // Réinitialiser les données de reconnexion pour la nouvelle manche
      setReconnectionData(null);
      setGame(prev => {
        if (prev) {
          return {
            ...prev,
            currentRound: data.round,
            rounds: [...(prev.rounds || []), data.round]
          };
        } else {
          // Si game n'existe pas encore, créer un lobby minimal
          const minimalLobby: IGame['lobby'] = {
            code: lobbyCode || '',
            players: players,
            selectedDecks: {}
          };
          return {
            lobby: minimalLobby,
            currentRound: data.round,
            status: GameStatus.IN_PROGRESS,
            rounds: [data.round]
          };
        }
      });
    });

    socket.on('gameEnded', () => {
      navigate(`/endgame/${lobbyCode}`);
    });

    socket.on('updatePlayersList', (data: { players: IPlayer[] }) => {
      setPlayers(data.players);
    });

    socket.on('error', (data: { message: string }) => {
      setError(data.message);
      // Cleanup previous timeout if exists
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
      errorTimeoutRef.current = setTimeout(() => setError(null), 5000);
    });

    return () => {
      // Retirer le listener spécifique au lieu de tous les listeners 'connect'
      socket.off('connect', fetchGameState);
      socket.off('gameState');
      socket.off('gameStarted');
      socket.off('questionSelected');
      socket.off('allAnswersSubmitted');
      socket.off('revealResults');
      socket.off('roundSkipped');
      socket.off('roundStarted');
      socket.off('gameEnded');
      socket.off('updatePlayersList');
      socket.off('error');
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // Reset le flag pour éviter un état incohérent si le composant remount
      pendingConnectListenerRef.current = false;
      // Cleanup timeouts
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, [navigate, lobbyCode]);

  const renderPhase = () => {
    if (!game || !game.currentRound || !currentPlayer) {
      return (
        <div className="flex items-center justify-center h-full">
          <p className="text-xl text-white">Chargement du jeu...</p>
        </div>
      );
    }

    const phase = game.currentRound.phase;
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
            leaderName={game.currentRound.leader.name}
            initialRelancesUsed={reconnectionData?.relancesUsed}
          />
        );

      case RoundPhase.ANSWERING:
        return (
          <AnswerPhase
            key={`answer-phase-${game.currentRound.roundNumber}`}
            lobbyCode={lobbyCode!}
            question={game.currentRound.selectedQuestion || 'Chargement...'}
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
            leaderName={game.currentRound.leader.name}
            question={game.currentRound.selectedQuestion || ''}
            initialGuesses={reconnectionData?.currentGuesses}
            playerCount={players.length}
            roundNumber={game.currentRound.roundNumber}
          />
        );

      case RoundPhase.REVEAL:
        return (
          <RevealPhase
            key={`reveal-phase-${game.currentRound.roundNumber}`}
            lobbyCode={lobbyCode!}
            isLeader={isLeader}
            leaderName={game.currentRound.leader.name}
            isGameOver={isGameOver}
            results={revealResults}
            question={game.currentRound.selectedQuestion || ''}
            initialRevealedIndices={reconnectionData?.revealedIndices}
          />
        );

      default:
        return <div className="text-white">Phase inconnue</div>;
    }
  };

  return (
    <div className="min-h-screen flex flex-col px-2 md:px-0">
      {/* Logo */}
      <div className="flex justify-center py-2 md:py-4">
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
          <div className="bg-amber-500 text-white p-3 md:p-4 rounded-lg mb-3 md:mb-4 text-sm md:text-base text-center">
            ⚠️ {notification}
          </div>
        </div>
      )}

      {/* Main game area - centered */}
      <div className={`flex-1 w-full max-w-4xl mx-auto px-2 pb-7 md:pb-10 flex flex-col md:pt-0 ${
        (game?.currentRound?.phase === RoundPhase.GUESSING ||
         (game?.currentRound?.phase === RoundPhase.QUESTION_SELECTION && isLeader))
          ? 'pt-0'
          : 'pt-[5vh]'
      }`}>
        <div className="bg-white rounded-lg p-2 md:p-4 min-h-[400px] md:min-h-[500px] flex flex-col shadow-[0_2px_10px_rgba(0,0,0,0.3)]">
          {/* Game info header inside main container */}
          <div className="flex justify-center md:justify-between items-center mb-2 md:mb-4 pb-2 md:pb-3 border-b-2 border-gray-200">
            <div className="text-gray-800 text-center md:text-right">
              <p className="text-xs md:text-sm font-display font-semibold tracking-wide">
                Round {game?.currentRound?.roundNumber || 0}/{players.length} • 👑 {game?.currentRound?.leader.name || '...'}
              </p>
            </div>
          </div>

          <div
            key={`${game?.currentRound?.roundNumber ?? 0}-${game?.currentRound?.phase ?? 'none'}`}
            className="flex-1 animate-phase-enter"
          >
            {renderPhase()}
          </div>
        </div>
      </div>

      {/* Debug info
      {process.env.NODE_ENV === 'development' && (
        <div className="w-full max-w-4xl mx-auto px-2 mt-4">
          <div className="bg-black/50 text-white p-4 rounded-lg text-xs">
            <p>Phase: {game?.currentRound?.phase || 'N/A'}</p>
            <p>Leader: {isLeader ? 'Oui' : 'Non'}</p>
            <p>Players: {players.length}</p>
          </div>
        </div>
      )}
        */}
    </div>
  );
};

export default GamePage;
