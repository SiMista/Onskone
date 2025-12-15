import { useState } from 'react';
import { getAvatarUrl } from '../constants/game';

interface AvatarProps {
  avatarId: number;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-13 h-13 text-sm',
  lg: 'w-16 h-16 text-2xl',
  xl: 'w-20 h-20 text-3xl',
};

const Avatar = ({ avatarId, name = '', size = 'md', className = '' }: AvatarProps) => {
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
  const avatarUrl = getAvatarUrl(avatarId);

  return (
    <div
      className={`rounded-full bg-white border-1 border-black flex items-center justify-center overflow-hidden shadow-md ${sizeClass} ${className}`}
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
};

export default Avatar;
