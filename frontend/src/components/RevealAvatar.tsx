import Avatar from './Avatar';

interface RevealAvatarProps {
  avatarId: number;
  name: string;
  /** true = on affiche l'Avatar réel, false = on affiche le point d'interrogation */
  revealed: boolean;
  /** Taille héritée d'Avatar */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Classe sur le conteneur (par défaut : 16/24 responsive landscape) */
  className?: string;
}

/**
 * Avatar avec animation cross-fade entre un cercle "?" pointillé et le vrai Avatar.
 * Utilisé en phase REVEAL pour masquer puis dévoiler qui a écrit la réponse.
 */
const RevealAvatar: React.FC<RevealAvatarProps> = ({
  avatarId,
  name,
  revealed,
  size = 'lg',
  className = 'relative w-16 h-16 tablet:w-24 tablet:h-24 phone-landscape:w-16 phone-landscape:h-16',
}) => {
  return (
    <div className={className}>
      <div
        className={`absolute inset-0 rounded-full bg-gray-200 border-2 border-dashed border-gray-400 flex items-center justify-center text-gray-500 font-bold text-2xl tablet:text-3xl shadow-md transition-opacity duration-500 phone-landscape:text-lg ${revealed ? 'opacity-0' : 'opacity-100'}`}
      >
        ?
      </div>
      <div className={`absolute inset-0 transition-opacity duration-500 ${revealed ? 'opacity-100' : 'opacity-0'}`}>
        <Avatar avatarId={avatarId} name={name} size={size} className="!w-full !h-full" />
      </div>
    </div>
  );
};

export default RevealAvatar;
