import React, { useEffect, useState } from 'react';
import socket from '../utils/socket';
import Button from './Button';
import Avatar from './Avatar';

const NO_RESPONSE_PREFIX = '__NO_RESPONSE__';

// Vérifie si une réponse est une "non-réponse" automatique
const isNoResponse = (text: string): boolean => {
  return text.startsWith(NO_RESPONSE_PREFIX);
};

// Retourne le texte à afficher (sans le préfixe)
const getDisplayText = (text: string): string => {
  if (isNoResponse(text)) {
    return text.substring(NO_RESPONSE_PREFIX.length);
  }
  return text;
};

interface RevealPhaseProps {
  lobbyCode: string;
  isLeader: boolean;
  leaderName: string;
  isGameOver: boolean;
  results: any[];
  roundScore: number;
  question: string;
}

const RevealPhase: React.FC<RevealPhaseProps> = ({ lobbyCode, isLeader, leaderName, isGameOver, results, question }) => {
  // Nombre de réponses révélées (synchronisé via socket)
  const [revealedCount, setRevealedCount] = useState(0);

  useEffect(() => {
    // Écouter les révélations du chef
    socket.on('answerRevealed', (data: { revealedIndex: number }) => {
      setRevealedCount(data.revealedIndex);
    });

    return () => {
      socket.off('answerRevealed');
    };
  }, []);

  const handleRevealNext = () => {
    if (isLeader && revealedCount < results.length) {
      socket.emit('revealNextAnswer', { lobbyCode });
    }
  };

  const handleNextRound = () => {
    socket.emit('nextRound', { lobbyCode });
  };

  const truncateName = (name: string, maxLength: number = 8) => {
    return name.length > maxLength ? name.substring(0, maxLength) + '...' : name;
  };

  const totalAnswers = results.length;
  const allRevealed = revealedCount >= totalAnswers;

  return (
    <div className="flex flex-col h-full p-2 max-w-2xl mx-auto">
      {/* Header - Question */}
      <div className="bg-primary-light rounded-lg px-2 py-2 max-w-2xl text-center">
        <p className="text-sm text-gray-500 mb-2">
          Question posée durant cette manche:
        </p>
        <p className="text-2xl font-semibold text-gray-800">
          {question}
        </p>
      </div>

      {/* Résultats détaillés avec en-têtes de colonnes */}
      <div className="flex-1 overflow-auto mb-4">
        {/* En-têtes de colonnes - inversées : Chef a dit | Écrit par */}
        <div className="mb-3 px-4">
          <div className="grid grid-cols-[1fr_5rem_5rem] gap-4 items-center">
            <p className="text-black text-xs font-bold uppercase">Réponse</p>
            <p className="text-black text-xs font-bold uppercase text-center">Chef a dit</p>
            <p className="text-black text-xs font-bold uppercase text-center">Écrit par</p>
          </div>
        </div>

        {/* Liste des résultats */}
        <div className="space-y-3 px-4">
          {results.map((result, index) => {
            const isRevealed = index < revealedCount;
            const noResponse = isNoResponse(result.answer);

            return (
              <div
                key={result.playerId}
                className={`
                  rounded-lg p-4 transform transition-all duration-500 border-[3px]
                  ${isRevealed
                    ? result.correct
                      ? 'bg-[#30c94d] border-black shadow-[0_2px_10px_rgba(0,0,0,0.3)]'
                      : 'bg-[#ff6b6b] border-black shadow-[0_2px_10px_rgba(0,0,0,0.3)]'
                    : 'bg-white border-gray-300 shadow-[0_2px_10px_rgba(0,0,0,0.1)]'
                  }
                `}
              >
                <div className="grid grid-cols-[1fr_5rem_5rem] gap-4 items-center">
                  {/* Réponse */}
                  <p
                    className={`text-base truncate ${noResponse ? 'italic text-gray-500 font-normal' : 'font-bold'} ${isRevealed && !noResponse ? 'text-black' : noResponse ? '' : 'text-gray-800'}`}
                    title={getDisplayText(result.answer)}
                  >
                    {getDisplayText(result.answer)}
                  </p>

                  {/* Chef a dit (toujours visible) */}
                  <div className="flex flex-col items-center">
                    {result.guessedPlayerName && result.guessedPlayerName !== 'Personne' ? (
                      <>
                        <Avatar avatarId={result.guessedPlayerAvatarId ?? 0} name={result.guessedPlayerName} size="md" />
                        <span className={`text-xs font-semibold mt-1 ${isRevealed ? 'text-black' : 'text-gray-700'}`} title={result.guessedPlayerName}>
                          {truncateName(result.guessedPlayerName)}
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="w-10 h-10 rounded-full bg-gray-300 border-2 border-black flex items-center justify-center text-gray-600 font-bold text-lg shadow-md">
                          ?
                        </div>
                        <span className={`text-xs font-semibold mt-1 ${isRevealed ? 'text-black' : 'text-gray-700'}`}>
                          Aucun
                        </span>
                      </>
                    )}
                  </div>

                  {/* Écrit par (révélé progressivement) */}
                  <div className="flex flex-col items-center">
                    {isRevealed ? (
                      <>
                        <Avatar avatarId={result.playerAvatarId ?? 0} name={result.playerName} size="md" />
                        <span className="text-xs font-semibold text-black mt-1" title={result.playerName}>
                          {truncateName(result.playerName)}
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="w-10 h-10 rounded-full bg-gray-200 border-2 border-dashed border-gray-400 flex items-center justify-center text-gray-500 font-bold text-xl shadow-md">
                          ?
                        </div>
                        <span className="text-xs font-semibold text-gray-500 mt-1">
                          ???
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Boutons */}
      <div className="flex flex-col items-center gap-3">
        {!allRevealed ? (
          isLeader ? (
            <Button
              variant="warning"
              size="xl"
              onClick={handleRevealNext}
            >
              Révéler ({revealedCount + 1}/{totalAnswers})
            </Button>
          ) : (
            <div className="bg-white rounded-lg p-5 shadow-[0_2px_10px_rgba(0,0,0,0.3)] text-center">
              <p className="text-gray-900 text-base font-semibold">
                ⏳ {leaderName} révèle les réponses... ({revealedCount}/{totalAnswers})
              </p>
            </div>
          )
        ) : isLeader ? (
          <>
            <p className="text-lg font-semibold">
              {isGameOver ? '🎉 Partie terminée !' : 'Prêt pour la suite ?'}
            </p>
            <Button
              text={isGameOver ? 'Voir les résultats finaux' : 'Manche suivante'}
              variant='success'
              rotateEffect={true}
              onClick={handleNextRound}
            />
          </>
        ) : (
          <div className="bg-white rounded-lg p-5 shadow-[0_2px_10px_rgba(0,0,0,0.3)] text-center">
            <p className="text-gray-900 text-base font-semibold">
              {isGameOver
                ? '⏳ En attente des résultats finaux...'
                : `⏳ En attente que ${leaderName} lance la manche suivante...`
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RevealPhase;
