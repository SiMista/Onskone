import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import QuestionSelection from '../components/QuestionSelection';
import AnswerPhase from '../components/AnswerPhase';
import GuessingPhase from '../components/GuessingPhase';
import RevealPhase from '../components/RevealPhase';
import SubstituteSelection from '../components/SubstituteSelection';
import SubstituteAnsweringPhase from '../components/SubstituteAnsweringPhase';
import HourglassTimer from '../components/HourglassTimer';
import ScreenLogo from '../components/ScreenLogo';
import { getPhaseDuration } from '../constants/game';
import { useLeavePrompt } from '../hooks';
import { useGameState } from '../hooks/useGameState';
import { useLobbyExitEvents } from '../hooks/useLobbyExitEvents';
import { RoundPhase, GameStatus } from '@onskone/shared';
import { isStudioFrame, studioSlotIndex } from '../utils/studioStorage';
import { useStudioBot } from '../hooks/useStudioBot';
import { useLocale } from '../i18n';

const GamePage: React.FC = () => {
  const { lobbyCode } = useParams<{ lobbyCode: string }>();
  const navigate = useNavigate();
  const { t } = useLocale();

  // Redirige vers l'accueil si aucun code de lobby
  useEffect(() => {
    if (!lobbyCode) {
      navigate('/');
    }
  }, [lobbyCode, navigate]);

  // État de la partie + toute la synchronisation socket (fetch/reconnexion,
  // handlers d'évènements, dérivé isLeader) — cf. hooks/useGameState.
  const { game, players, currentPlayer, revealResults, reconnectionData, isLeader } = useGameState(lobbyCode);

  // Confirmation avant de quitter pendant une partie en cours
  useLeavePrompt(game?.status === GameStatus.IN_PROGRESS);

  // Studio : automatisation des bots + postMessage d'état pour surligner le pilier dans le parent.
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
      }, '*');
    } catch { /* silent */ }
  }, [
    game?.currentRound?.leader.id,
    game?.currentRound?.phase,
    game?.currentRound?.substitutePlayerId,
    currentPlayer?.id,
  ]);

  // Si le joueur est kické pendant la partie ou si le lobby ferme : toast + retour
  // home (sinon il resterait bloqué sur l'écran de jeu). Logique partagée avec
  // Lobby.
  useLobbyExitEvents(navigate, t);

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
      <ScreenLogo />
      {/* Main game area - sized to content, centré dans la fenêtre. La carte
          interne a son propre cap dvh pour scroller si la phase dépasse.
          Erreurs et notifs sont remontées via le Toast global (haut centré). */}
      <div
        className="w-full max-w-4xl max-h-full min-h-0 mx-auto px-2 pt-2 tablet:pt-4 flex flex-col safe-pb"
      >
        <div className="min-h-0 max-h-[80dvh] phone-landscape:max-h-none phone-landscape:h-[90dvh] bg-white rounded-xl px-2 py-5 tablet:px-4 tablet:py-7 phone-landscape:!p-2 phone-landscape:tablet:!p-4 flex flex-col overflow-hidden card-paper stack-shadow">
          {/* Game info header : round + host à gauche, sablier à droite */}
          <div className="shrink-0 flex items-center justify-between gap-3 mb-2 tablet:mb-4 pb-2 tablet:pb-3 border-b-[2.5px] border-dashed border-black/30">
            <div className="flex items-center gap-1.5 flex-wrap text-gray-800 text-left">
              <span className="text-xs tablet:text-sm font-display font-bold tracking-wide">
                Round {game?.currentRound?.roundNumber || 0}<span className="text-gray-400">/{players.length}</span>
              </span>
              <span className="text-gray-300">•</span>
              <Icon icon="fluent-emoji-flat:crown" width="1.1em" height="1.1em" aria-hidden />
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
