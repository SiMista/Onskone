import { IPlayer, RevealResult, GameMode } from '@onskone/shared';
import { useRevealCursor } from '../hooks/useRevealCursor';
import RevealPlayerLocalView from './reveal/RevealPlayerLocalView';
import RevealRemoteView from './reveal/RevealRemoteView';
import RevealPilierGuessedView from './reveal/RevealPilierGuessedView';
import RevealPilierLocalView from './reveal/RevealPilierLocalView';

/**
 * Phase REVEAL : dispatcher qui choisit la vue selon (isLeader, gameMode,
 * carte "pilier deviné"). Toute la machine d'état (curseur pilier, révélations,
 * similarité, listeners socket) vit dans `useRevealCursor` ; chaque vue est un
 * sous-composant de `components/reveal/`.
 *
 * Branches (l'ordre est significatif, ne pas réordonner) :
 *  1. non-pilier + local       → RevealPlayerLocalView (carte unique du joueur)
 *  2. remote (tous joueurs)    → RevealRemoteView
 *  3. pilier + carte "deviné"  → RevealPilierGuessedView (mode "Devine ma réponse")
 *  4. sinon (pilier local)     → RevealPilierLocalView
 */
const RevealPhase = ({
  lobbyCode, isLeader, leader, currentPlayerId, isGameOver, results, revealOrder, serverRevealedIndices,
  pendingSimilarityIndex, similarityCorrections, gameMode,
}: {
  lobbyCode: string;
  isLeader: boolean;
  leader: Pick<IPlayer, 'id' | 'name' | 'avatarId' | 'isPremium'>;
  currentPlayerId: string;
  isGameOver: boolean;
  results: RevealResult[];
  /** Ordre du reveal (indices de results, tour de table), fixé par le serveur. */
  revealOrder: readonly number[];
  serverRevealedIndices?: number[];
  /** Similarité en attente d'arbitrage (index de la carte jugée), état serveur. */
  pendingSimilarityIndex: number | null;
  /** Cartes validées « même réponse » par le pilier, état serveur. */
  similarityCorrections: readonly number[];
  gameMode: GameMode;
}) => {
  const leaderId = leader.id;
  const reveal = useRevealCursor({
    results,
    leaderId,
    isLeader,
    gameMode,
    lobbyCode,
    revealOrder,
    serverRevealedIndices,
    pendingSimilarityIndex,
    similarityCorrections,
  });

  // 1) VUE JOUEUR (non-pilier) en mode local - carte unique de la réponse attribuée
  if (!isLeader && gameMode === 'local') {
    return (
      <RevealPlayerLocalView
        reveal={reveal}
        leader={leader}
        currentPlayerId={currentPlayerId}
        isGameOver={isGameOver}
        results={results}
      />
    );
  }

  // 2) VUE REMOTE - une carte à la fois pour tous les joueurs (leader pilote)
  if (gameMode === 'remote') {
    return (
      <RevealRemoteView
        reveal={reveal}
        leader={leader}
        isLeader={isLeader}
        isGameOver={isGameOver}
      />
    );
  }

  // Mode "Devine ma réponse" : carte où le pilier s'est attribué une réponse
  const isPilierGuessedCard =
    !!reveal.currentResult && reveal.currentResult.guessedPlayerId === leaderId;

  // 3) VUE PILIER "deviné" - reproduit la mise en page de la carte des autres
  if (isPilierGuessedCard && reveal.currentResult) {
    return (
      <RevealPilierGuessedView
        reveal={reveal}
        leaderId={leaderId}
        isGameOver={isGameOver}
      />
    );
  }

  // 4) VUE PILIER local - carte avatar + flèche "Suivant" + boutons d'action
  return (
    <RevealPilierLocalView
      reveal={reveal}
      leaderId={leaderId}
      isLeader={isLeader}
      isGameOver={isGameOver}
    />
  );
};

export default RevealPhase;
