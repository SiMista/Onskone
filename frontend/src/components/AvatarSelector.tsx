import { AVATARS, getAvatarUrl } from '../constants/game';

interface AvatarSelectorProps {
  selectedAvatarId: number;
  onSelect: (avatarId: number) => void;
}

const AvatarSelector = ({ selectedAvatarId, onSelect }: AvatarSelectorProps) => {
  const handlePrevious = () => {
    const newId = selectedAvatarId === 0 ? AVATARS.length - 1 : selectedAvatarId - 1;
    onSelect(newId);
  };

  const handleNext = () => {
    const newId = selectedAvatarId === AVATARS.length - 1 ? 0 : selectedAvatarId + 1;
    onSelect(newId);
  };

  const avatarUrl = getAvatarUrl(selectedAvatarId);

  return (
    <div className="flex items-center justify-center gap-4 mb-4">
      {/* Flèche gauche */}
      <button
        onClick={handlePrevious}
        className="w-10 h-10 rounded-full hover:bg-black/5 cursor-pointer flex items-center justify-center text-black text-4xl font-bold transition-colors"
        type="button"
      >
        ‹
      </button>

      {/* Avatar */}
      <div className="w-40 h-40 rounded-full bg-white border-3 border-primary overflow-hidden shadow-lg">
        <img
          src={avatarUrl}
          alt={`Avatar ${selectedAvatarId + 1}`}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Flèche droite */}
      <button
        onClick={handleNext}
        className="w-10 h-10 rounded-full hover:bg-black/5 cursor-pointer flex items-center justify-center text-black text-4xl font-bold transition-colors"
        type="button"
      >
        ›
      </button>
    </div>
  );
};

export default AvatarSelector;
