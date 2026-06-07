import { IPlayer } from '@onskone/shared';
import PlayerCard from '../PlayerCard';
import { GAME_CONFIG } from '../../constants/game';
import type { Dictionary } from '../../i18n/dictionary';

interface LobbyPlayersGridProps {
  players: IPlayer[];
  currentPlayer: IPlayer | null;
  /** Ids des joueurs présents au premier render (pas d'animation de "pop" pour eux). */
  initialPlayerIds: Set<string> | null;
  activePlayersCount: number;
  onKick: (playerId: string) => void;
  onPromote: (playerId: string) => void;
  t: Dictionary;
}

/**
 * Grille des joueurs du lobby (mobile : 3/ligne, desktop : 4/ligne, format carré).
 * Affiche un emplacement vide en pointillés tant que le lobby n'est pas plein.
 *
 * Le menu kick/promote n'est exposé qu'à l'hôte et seulement ici (écran lobby,
 * partie non démarrée) — le kick est refusé serveur-side pendant une partie.
 */
const LobbyPlayersGrid = ({
  players,
  currentPlayer,
  initialPlayerIds,
  activePlayersCount,
  onKick,
  onPromote,
  t,
}: LobbyPlayersGridProps) => {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <p className="m-0 font-display font-bold text-sm text-gray-800">{t.lobby.inTheRoom}</p>
        <p className="m-0 text-xs text-gray-400">{t.lobby.connectedCount(activePlayersCount)}</p>
      </div>
      <ul className="list-none w-full m-0 p-0 grid grid-cols-3 md:grid-cols-4 gap-2">
        {players.map((player, index) => (
          <li key={player.id} className={`min-w-0 ${initialPlayerIds?.has(player.id) ? '' : 'animate-player-pop'}`} style={initialPlayerIds?.has(player.id) ? undefined : { animationDelay: `${Math.min(index, 6) * 50}ms` }}>
            <PlayerCard
              id={player.id}
              name={player.name}
              avatarId={player.avatarId}
              isHost={player.isHost}
              isCurrentPlayer={currentPlayer?.id === player.id}
              currentPlayerIsHost={!!currentPlayer?.isHost}
              isActive={player.isActive}
              isFirstPlayer={index < 3}
              variant="square"
              onKick={onKick}
              onPromote={onPromote}
            />
          </li>
        ))}
        {players.length < GAME_CONFIG.MAX_PLAYERS && (
          <li className="min-w-0">
            <div className="relative aspect-square flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-[10px] w-full border-2 border-dashed border-gray-300 bg-gray-50/50">
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-300 text-xl">?</div>
              <span className="text-xs text-gray-400 italic text-center truncate w-full px-1">...</span>
            </div>
          </li>
        )}
      </ul>
    </div>
  );
};

export default LobbyPlayersGrid;
