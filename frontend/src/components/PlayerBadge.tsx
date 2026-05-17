import Avatar from './Avatar';
import { IPlayer } from '@onskone/shared';

interface PlayerBadgeProps {
  player: Pick<IPlayer, 'avatarId' | 'name'> | undefined | null;
  size?: 'sm' | 'md';
  className?: string;
  fallbackName?: string;
}

const MAX_NAME_CHARS = 14;

const PlayerBadge: React.FC<PlayerBadgeProps> = ({
  player,
  size = 'md',
  className = '',
  fallbackName,
}) => {
  const name = player?.name ?? fallbackName ?? '';
  const display =
    name.length > MAX_NAME_CHARS ? name.slice(0, MAX_NAME_CHARS - 1) + '…' : name;
  return (
    <div
      className={`inline-flex flex-col items-center gap-1 min-w-[60px] max-w-[90px] ${className}`}
    >
      <Avatar avatarId={player?.avatarId ?? 0} name={name} size={size} />
      <span className="text-[11px] md:text-xs font-semibold text-gray-800 text-center truncate max-w-full">
        {display}
      </span>
    </div>
  );
};

export default PlayerBadge;
