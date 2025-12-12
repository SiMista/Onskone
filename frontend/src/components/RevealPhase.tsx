import React, { useEffect, useState } from 'react';
import socket from '../utils/socket';
import Button from './Button';

interface RevealPhaseProps {
  lobbyCode: string;
  isLeader: boolean;
  leaderName: string;
  isGameOver: boolean;
  results: any[];
  roundScore: number;
  question: string;
}

const RevealPhase: React.FC<RevealPhaseProps> = ({ lobbyCode, isLeader, leaderName, isGameOver, results, roundScore, question }) => {
  const [revealed, setRevealed] = useState(false);
  const [scoreRevealed, setScoreRevealed] = useState(false);

  useEffect(() => {
    // Animation de révélation quand on arrive sur cette phase
    setTimeout(() => setRevealed(true), 500);
    setTimeout(() => setScoreRevealed(true), 800);
  }, []);

  const handleNextRound = () => {
    // Le backend gère la logique isGameOver et envoie gameEnded si nécessaire
    socket.emit('nextRound', { lobbyCode });
  };

  const correctGuesses = results.filter(r => r.correct).length;
  const totalAnswers = results.length;
  const successRate = totalAnswers > 0 ? (correctGuesses / totalAnswers) * 100 : 0;
  const isPerfectScore = successRate === 100 && totalAnswers > 0;
  const isGoodScore = successRate >= 50;

  return (
    <div className="flex flex-col h-full p-6">
      {/* Header - Question et Chef avec Score intégré */}
      <div className="bg-white rounded-lg p-5 mb-4 shadow-[0_2px_10px_rgba(0,0,0,0.4)]">
        <div className="flex justify-between items-start mb-4">
          {/* Question à gauche */}
          <div className="flex-1">
            <p className="text-gray-600 text-xs mb-1 uppercase font-semibold">Question posée :</p>
            <p className="text-gray-900 text-base font-medium">{question}</p>
          </div>

          {/* Chef à droite */}
          <div className="text-right ml-6">
            <p className="text-gray-600 text-xs mb-1 uppercase font-semibold">Chef du round :</p>
            <p className="text-gray-900 text-base font-bold">👑 {leaderName}</p>
          </div>
        </div>

        {/* Score compact intégré au header */}
        <div className={`
          rounded-lg p-4 text-center transition-all duration-500 transform border-[3px] border-black
          ${scoreRevealed ? 'scale-100 opacity-100' : 'scale-90 opacity-0'}
          ${isPerfectScore ? 'bg-[#30c94d]' :
            isGoodScore ? 'bg-[#FFC700]' :
            'bg-[rgb(249,245,242)]'}
        `}>
          <div className="flex items-center justify-center gap-3">
            {isPerfectScore && <span className="text-3xl">🎉</span>}
            <div>
              <p className="text-gray-900 text-sm mb-1 font-semibold">
                {leaderName} a trouvé :
              </p>
              <div className="flex items-baseline gap-2 justify-center">
                <span className="text-4xl font-bold text-black">
                  {correctGuesses} / {totalAnswers}
                </span>
                <span className="text-lg text-gray-900 font-bold">
                  (+{roundScore} pt{roundScore > 1 ? 's' : ''})
                </span>
              </div>
            </div>
            {isPerfectScore && <span className="text-3xl">🎉</span>}
          </div>
        </div>
      </div>

      {/* Résultats détaillés avec en-têtes de colonnes */}
      <div className="flex-1 overflow-auto mb-4">
        {/* En-têtes de colonnes - même grid que les items */}
        <div className="mb-3 px-4">
          <div className="grid grid-cols-[1fr_8rem_8rem_7rem] gap-4 items-center">
            <p className="text-black text-xs font-bold uppercase">Réponse</p>
            <p className="text-black text-xs font-bold uppercase text-center">Écrit par</p>
            <p className="text-black text-xs font-bold uppercase text-center">Chef a dit</p>
            <p className="text-black text-xs font-bold uppercase text-center">Résultat</p>
          </div>
        </div>

        {/* Liste des résultats */}
        <div className="space-y-3 px-4">
          {results.map((result, index) => (
            <div
              key={result.playerId}
              className={`
                rounded-lg p-4 transform transition-all duration-500 border-[3px]
                ${result.correct
                  ? 'bg-[#30c94d] border-black shadow-[0_2px_10px_rgba(0,0,0,0.3)]'
                  : 'bg-[#ff6b6b] border-black shadow-[0_2px_10px_rgba(0,0,0,0.3)]'
                }
                ${revealed ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'}
              `}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <div className="grid grid-cols-[1fr_8rem_8rem_7rem] gap-4 items-center">
                {/* Réponse */}
                <p className="text-black text-lg font-bold break-words">"{result.answer}"</p>

                {/* Auteur */}
                <div className="text-center">
                  <div className="bg-white border-2 border-black text-black px-3 py-1 rounded font-bold text-sm shadow-[0_2px_4px_rgba(0,0,0,0.2)] truncate">
                    {result.playerName}
                  </div>
                </div>

                {/* Chef a dit */}
                <div className="text-center">
                  <div className="bg-white border-2 border-black text-black px-3 py-1 rounded font-bold text-sm shadow-[0_2px_4px_rgba(0,0,0,0.2)] truncate">
                    {result.guessedPlayerName || 'Personne'}
                  </div>
                </div>

                {/* Résultat */}
                <div className="text-center">
                  <div className="text-xl font-bold text-black">
                    {result.correct ? '✅ TROUVÉ' : '❌ RATÉ'}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bouton next round */}
      <div className="flex flex-col items-center gap-3">
        {isLeader ? (
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
