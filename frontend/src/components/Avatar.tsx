import { useEffect, useState } from 'react';
import { getAvatarUrl } from '../constants/game';

interface AvatarProps {
  avatarId: number;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  /** Cadre doré brillant autour de l'avatar pour les joueurs premium. */
  premium?: boolean;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-13 h-13 text-sm',
  lg: 'w-16 h-16 text-2xl',
  xl: 'w-20 h-20 text-3xl',
};

const Avatar = ({ avatarId, name = '', size = 'md', className = '', premium = false }: AvatarProps) => {
  const sizeClass = sizeClasses[size];

  // Fallback: initiales si l'image ne charge pas
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .substring(0, 2)
      .toUpperCase() || '?';
  };

  const [imageError, setImageError] = useState(false);
  useEffect(() => { setImageError(false); }, [avatarId]);
  const avatarUrl = getAvatarUrl(avatarId);

  const inner = (
    <div
      className={`rounded-full bg-white border-1 border-black flex items-center justify-center overflow-hidden shadow-md ${sizeClass} ${premium ? '' : className}`}
    >
      {!imageError ? (
        <img
          src={avatarUrl}
          alt={`Avatar ${avatarId}`}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <span className="font-bold text-black">{getInitials(name)}</span>
      )}
    </div>
  );

  if (!premium) return inner;

  // Cadre doré brillant premium : anneau dégradé + halo doux (respecte reduced-motion).
  return (
    <div
      className={`premium-glow rounded-full p-[2.5px] flex items-center justify-center ${className}`}
      style={{ background: 'linear-gradient(135deg, #fff1b8 0%, #ffd24a 45%, #e6a52a 100%)' }}
    >
      {inner}
    </div>
  );
};

export default Avatar;
