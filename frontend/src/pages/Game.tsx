import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import socket from '../utils/socket';
import QuestionSelection from '../components/QuestionSelection';
import AnswerPhase from '../components/AnswerPhase';
import GuessingPhase from '../components/GuessingPhase';
import RevealPhase from '../components/RevealPhase';
import Leaderboard from '../components/Leaderboard';
import RoundHistory from '../components/RoundHistory';

// Types
enum RoundPhase {
  QUESTION_SELECTION = 'QUESTION_SELECTION',
  ANSWERING = 'ANSWERING',
  GUESSING = 'GUESSING',
  REVEAL = 'REVEAL'
}

interface Player {
  id: string;
  name: string;
  socketId: string;
  isHost: boolean;
  score: number;
}

interface Round {
  roundNumber: number;
  leader: Player;
  phase: RoundPhase;
  selectedQuestion: string | null;
}

interface Game {
  currentRound: Round | null;
  status: string;
  rounds: any[];
}

interface LeaderboardEntry {
  player: Player;
  score: number;
}

const GamePage: React.FC = () => {
  const { lobbyCode } = useParams<{ lobbyCode: string }>();
  const navigate = useNavigate();

  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [isLeader, setIsLeader] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    // Récupérer le joueur actuel depuis le localStorage
    const storedPlayer = localStorage.getItem('currentPlayer');
    if (storedPlayer) {
      const player = JSON.parse(storedPlayer);
      setCurrentPlayer(player);
    }

    // Demander l'état actuel du jeu au serveur
    socket.emit('getGameState', { lobbyCode });

    // Socket listeners
    socket.on('gameState', (data: { game: Game; players: Player[]; leaderboard: LeaderboardEntry[] }) => {
      console.log('Game state received:', data);
      setGame(data.game);
      setPlayers(data.players);
      setLeaderboard(data.leaderboard);
    });

    socket.on('gameStarted', (data: { game: Game }) => {
      console.log('Game started:', data);
      setGame(data.game);
    });

    socket.on('questionSelected', (data: { question: string; phase: RoundPhase; auto?: boolean }) => {
      console.log('Question selected:', data);
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
      console.log('All answers submitted:', data);
      setGame(prev => prev ? {
        ...prev,
        currentRound: prev.currentRound ? {
          ...prev.currentRound,
          phase: data.phase
        } : null
      } : null);
    });

    socket.on('revealResults', (data: { phase: RoundPhase; results: any[]; scores: Record<string, number>; leaderboard: LeaderboardEntry[] }) => {
      console.log('Reveal results:', data);
      setGame(prev => prev ? {
        ...prev,
        currentRound: prev.currentRound ? {
          ...prev.currentRound,
          phase: data.phase
        } : null
      } : null);

      // Mettre à jour le leaderboard
      if (data.leaderboard) {
        setLeaderboard(data.leaderboard);
      }
    });

    socket.on('roundStarted', (data: { round: Round }) => {
      console.log('Round started:', data);
      setGame(prev => {
        if (prev) {
          return {
            ...prev,
            currentRound: data.round,
            rounds: [...(prev.rounds || []), data.round]
          };
        } else {
          // Si game n'existe pas encore, on le crée avec le minimum requis
          return {
            currentRound: data.round,
            status: 'IN_PROGRESS',
            rounds: [data.round]
          };
        }
      });
    });

    socket.on('gameEnded', (data: { leaderboard: LeaderboardEntry[]; rounds: any[] }) => {
      console.log('Game ended, navigating to endgame');
      navigate(`/endgame/${lobbyCode}`);
    });

    socket.on('updatePlayersList', (data: { players: Player[] }) => {
      setPlayers(data.players);
    });

    socket.on('error', (data: { message: string }) => {
      setError(data.message);
      setTimeout(() => setError(null), 5000);
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
    };
  }, [navigate, lobbyCode]);

  useEffect(() => {
    // Vérifier si le joueur actuel est le chef
    if (game?.currentRound && currentPlayer) {
      setIsLeader(game.currentRound.leader.id === currentPlayer.id);
    }
  }, [game, currentPlayer]);

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
            totalPlayers={players.length}
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
          />
        );

      default:
        return <div className="text-white">Phase inconnue</div>;
    }
  };

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white/20 backdrop-blur-md rounded-lg p-4 mb-4">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-white">Onskone</h1>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowHistory(true)}
                className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-white font-semibold
                  transition-all flex items-center gap-2"
              >
                <span>📜</span>
                <span>Historique</span>
              </button>
              <div className="text-white text-right">
                <p className="text-sm">Lobby: {lobbyCode}</p>
                <p className="text-sm">
                  Round {game?.currentRound?.roundNumber || 0} • 👑 {game?.currentRound?.leader.name || '...'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-500 text-white p-4 rounded-lg mb-4">
            {error}
          </div>
        )}

        {/* Main layout avec sidebar */}
        <div className="grid grid-cols-4 gap-4">
          {/* Main game area (3 colonnes) */}
          <div className="col-span-3 bg-white/10 backdrop-blur-md rounded-lg p-6 min-h-[700px]">
            {renderPhase()}
          </div>

          {/* Sidebar droite - Leaderboard (1 colonne) */}
          <div className="col-span-1">
            <Leaderboard
              entries={leaderboard}
              currentPlayerId={currentPlayer?.id}
              leaderName={game?.currentRound?.leader.name}
            />
          </div>
        </div>

        {/* Round History Modal */}
        <RoundHistory
          rounds={game?.rounds || []}
          players={players}
          isOpen={showHistory}
          onClose={() => setShowHistory(false)}
        />

        {/* Debug info */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 bg-black/50 text-white p-4 rounded-lg text-xs">
            <p>Phase: {game?.currentRound?.phase || 'N/A'}</p>
            <p>Leader: {isLeader ? 'Oui' : 'Non'}</p>
            <p>Players: {players.length}</p>
            <p>Leaderboard entries: {leaderboard.length}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GamePage;
