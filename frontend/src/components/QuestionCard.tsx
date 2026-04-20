import { GameCard } from '@onskone/shared';
import { getCategoryColor } from '../constants/game';

interface QuestionCardProps {
  question: string;
  card?: GameCard;
  variant?: 'full' | 'compact';
  subtitle?: string;
}

const QuestionCard: React.FC<QuestionCardProps> = ({ question, card, variant = 'full', subtitle }) => {
  const color = card ? getCategoryColor(card.category) : '#18bbed';
  const isCompact = variant === 'compact';

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        className={`bg-cream-question border-[3px] md:border-4 rounded-xl relative overflow-hidden shadow-[0_4px_14px_rgba(0,0,0,0.18)] ${
          isCompact ? 'px-3 md:px-4 py-2 md:py-2.5' : 'px-5 md:px-7 py-3 md:py-4'
        }`}
        style={{ borderColor: color }}
      >
        {card && (
          <span
            className={`font-display absolute left-2 ${
              isCompact ? 'top-1.5 md:top-2 text-[9px] md:text-[10px] px-1.5 py-0.5' : 'top-2 md:top-2.5 text-[10px] md:text-xs px-2 py-0.5'
            } font-bold uppercase tracking-[0.08em] rounded-full text-white shadow-[0_2px_0_0_rgba(0,0,0,0.15)]`}
            style={{ backgroundColor: color }}
          >
            {card.category}
          </span>
        )}
        <div className={card ? (isCompact ? 'pt-4 md:pt-5' : 'pt-5 md:pt-6') : ''}>
          {card && isCompact && (
            <>
              {/* Thème seul */}
              <p className="font-display font-semibold text-gray-900 text-center text-xs md:text-sm tracking-tight !mt-0 !mb-1.5 md:!mb-2 leading-tight">
                {card.theme}
              </p>
              {/* Séparateur fin coloré */}
              <div
                className="mx-auto rounded-full !mb-1.5 md:!mb-2"
                style={{ width: 28, height: 2, backgroundColor: color, opacity: 0.35 }}
              />
            </>
          )}
          {card && !isCompact && (
            <>
              {/* Thème : titre */}
              <p className="font-display font-bold text-center !mt-0 !mb-1.5 md:!mb-2 leading-tight tracking-tight text-base md:text-lg">
                {card.theme}
              </p>
              {/* Séparateur fin coloré */}
              <div
                className="mx-auto rounded-full !mb-1.5 md:!mb-2"
                style={{ width: 36, height: 2, backgroundColor: color, opacity: 0.35 }}
              />
              {/* Sujet : eyebrow tracké */}
              <p
                className="text-center !mt-0 uppercase font-semibold tracking-[0.14em] leading-tight text-[10px] md:text-[11px] !mb-2.5 md:!mb-3"
                style={{ color }}
              >
                {card.subject}
              </p>
            </>
          )}
          {/* Question : héros du bloc */}
          <p
            className={`font-display text-center !mt-0 !mb-0 text-gray-900 leading-tight tracking-tight font-bold ${
              isCompact ? 'text-base md:text-lg' : 'text-lg md:text-2xl'
            }`}
          >
            {question}
          </p>
        </div>
      </div>
      {subtitle && (
        <p className="mt-2 md:mt-3 text-sm md:text-base text-gray-600 italic text-center">{subtitle}</p>
      )}
    </div>
  );
};

export default QuestionCard;
