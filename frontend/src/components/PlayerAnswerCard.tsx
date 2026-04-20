interface PlayerAnswerCardProps {
  answer: string;
  isNoResponse?: boolean;
  bgClass?: string;
  pulse?: boolean;
  className?: string;
  heading?: string | null;
  placeholder?: boolean;
}

const PlayerAnswerCard: React.FC<PlayerAnswerCardProps> = ({
  answer,
  isNoResponse = false,
  bgClass = 'bg-cream-answer',
  pulse = false,
  className = '',
  heading = 'Montre ton écran à tout le monde !',
  placeholder = false,
}) => {
  const textClass = placeholder
    ? 'italic text-gray-500 font-normal'
    : isNoResponse
      ? 'italic text-gray-500 font-normal'
      : 'text-black';

  return (
    <>
      {heading && (
        <p className="text-gray-900 text-base md:text-xl font-semibold text-center">
          {heading}
        </p>
      )}
      <div
        className={`
          w-full max-w-md rounded-xl p-6 md:p-8 border-2 md:border-[3px]
          ${placeholder
            ? 'border-dashed border-gray-400 bg-gray-100/70 shadow-none'
            : `border-black shadow-[0_4px_14px_rgba(0,0,0,0.22)] ${bgClass}`
          }
          ${pulse ? 'animate-halo-pulse' : ''}
          ${className}
        `}
      >
        <p className={`${placeholder ? 'text-sm md:text-base' : 'text-lg md:text-2xl'} font-bold text-center break-words ${textClass}`}>
          {answer}
        </p>
      </div>
    </>
  );
};

export default PlayerAnswerCard;
