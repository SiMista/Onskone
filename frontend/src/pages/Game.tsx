import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import socket from '../utils/socket';
import QuestionSelection from '../components/QuestionSelection';
import AnswerPhase from '../components/AnswerPhase';
import GuessingPhase from '../components/GuessingPhase';
import RevealPhase from '../components/RevealPhase';
import Logo from '../components/Logo';
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
  const [revealResults, setRevealResults] = useState<RevealResult[]>([]);
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Calculer isLeader directement (pas de useEffect) pour éviter les race conditions
  const isLeader = !!(game?.currentRound && currentPlayer && game.currentRound.leader.id === currentPlayer.id);

  useEffect(() => {
    // Récupérer le joueur actuel depuis le localStorage
    try {
      const storedPlayer = localStorage.getItem('currentPlayer');
      if (storedPlayer) {
        const player = JSON.parse(storedPlayer);
        setCurrentPlayer(player);
      }
    } catch (error) {
      console.error('Error parsing stored player:', error);
      localStorage.removeItem('currentPlayer');
    }

    // Demander l'état actuel du jeu au serveur
    if (lobbyCode) {
      socket.emit('getGameState', { lobbyCode: lobbyCode! });
    }

    // Socket listeners
    socket.on('gameState', (data: { game: IGame; players: IPlayer[] }) => {
      setGame(data.game);
      setPlayers(data.players);
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

    socket.on('roundStarted', (data: { round: IRound }) => {
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
            players: players
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
      socket.off('gameState');
      socket.off('gameStarted');
      socket.off('questionSelected');
      socket.off('allAnswersSubmitted');
      socket.off('revealResults');
      socket.off('roundStarted');
      socket.off('gameEnded');
      socket.off('updatePlayersList');
      socket.off('error');
      // Cleanup error timeout
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
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
    // Vérifier si c'est le dernier round (tous les joueurs ont été chef une fois)
    const isGameOver = game.currentRound.roundNumber >= players.length;

    switch (phase) {
      case RoundPhase.QUESTION_SELECTION:
        return (
          <QuestionSelection
            lobbyCode={lobbyCode!}
            isLeader={isLeader}
            leaderName={game.currentRound.leader.name}
          />
        );

      case RoundPhase.ANSWERING:
        return (
          <AnswerPhase
            lobbyCode={lobbyCode!}
            question={game.currentRound.selectedQuestion || 'Chargement...'}
            isLeader={isLeader}
            currentPlayerId={currentPlayer.id}
            players={players}
            leaderId={game.currentRound.leader.id}
          />
        );

      case RoundPhase.GUESSING:
        return (
          <GuessingPhase
            lobbyCode={lobbyCode!}
            isLeader={isLeader}
            leaderName={game.currentRound.leader.name}
          />
        );

      case RoundPhase.REVEAL:
        return (
          <RevealPhase
            lobbyCode={lobbyCode!}
            isLeader={isLeader}
            leaderName={game.currentRound.leader.name}
            isGameOver={isGameOver}
            results={revealResults}
            question={game.currentRound.selectedQuestion || ''}
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
              <p className="text-xs md:text-sm font-semibold">
                Round {game?.currentRound?.roundNumber || 0}/{players.length} • 👑 {game?.currentRound?.leader.name || '...'}
              </p>
            </div>
          </div>

          <div className="flex-1">
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
