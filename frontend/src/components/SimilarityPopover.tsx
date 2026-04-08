import Button from './Button';

interface SimilarityPopoverProps {
  guessedPlayerName: string;
  isLeader: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}

const SimilarityPopover: React.FC<SimilarityPopoverProps> = ({
  guessedPlayerName,
  isLeader,
  onConfirm,
  onDismiss,
}) => {
  return (
    <div className="flex justify-center mt-1.5 md:mt-2 animate-popover-bounce">
      <div className="relative bg-white rounded-lg border-2 md:border-[3px] border-black shadow-[0_4px_12px_rgba(0,0,0,0.15)] px-3 py-2 md:py-2.5 w-56 md:w-64">
        {/* Flèche vers le haut */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[8px] border-b-black" />
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-[-5px] w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-white" />

        <p className="text-xs md:text-sm text-gray-800 text-center font-semibold mb-2">
          Cette réponse est similaire à celle de <span className="text-[#1AAFDA]">{guessedPlayerName}</span>, c'est la même ?
        </p>

        {isLeader ? (
          <div className="flex justify-center gap-2">
            <Button
              text="Oui"
              variant="success"
              size="sm"
              onClick={onConfirm}
            />
            <Button
              text="Non"
              variant="secondary"
              size="sm"
              onClick={onDismiss}
            />
          </div>
        ) : (
          <p className="text-[10px] md:text-xs text-gray-400 text-center italic">
            En attente du pilier...
          </p>
        )}
      </div>
    </div>
  );
};

export default SimilarityPopover;
