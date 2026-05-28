import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import Avatar from './Avatar';

const SOFT_HYPHEN = '­';

// Insère des soft hyphens dans les mots trop longs sans espaces,
// pour que le texte puisse se couper avec un "-" quand l'auto-fit doit
// rétrécir la police. Mots courts inchangés.
const insertSoftHyphens = (text: string, threshold = 12, interval = 6): string => {
  return text
    .split(/(\s+)/)
    .map(chunk => {
      if (/^\s+$/.test(chunk) || chunk.length <= threshold) return chunk;
      let result = '';
      for (let i = 0; i < chunk.length; i += interval) {
        result += chunk.slice(i, i + interval);
        if (i + interval < chunk.length) result += SOFT_HYPHEN;
      }
      return result;
    })
    .join('');
};

interface PlayerAnswerCardProps {
  answer: string;
  isNoResponse?: boolean;
  bgClass?: string;
  pulse?: boolean;
  className?: string;
  heading?: string | null;
  placeholder?: boolean;
  /** Si défini, affiche un état d'attente "En attente que {name} t'attribue une réponse…"
   *  avec avatar inline et police modérée, à la place du texte auto-fit. */
  waitingFor?: { name: string; avatarId: number };
}

const FIT_MAX = 128;
const FIT_MIN = 14;

const PlayerAnswerCard: React.FC<PlayerAnswerCardProps> = ({
  answer,
  isNoResponse = false,
  bgClass = 'bg-cream-answer',
  pulse = false,
  className = '',
  heading = null,
  placeholder = false,
  waitingFor,
}) => {
  const textClass = placeholder
    ? 'italic text-gray-500 font-normal'
    : isNoResponse
      ? 'italic text-gray-500 font-normal'
      : 'text-black';

  const fitBoxRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const [fontSize, setFontSize] = useState<number>(FIT_MAX);

  const displayedAnswer = useMemo(
    () => (placeholder ? answer : insertSoftHyphens(answer)),
    [answer, placeholder]
  );

  useLayoutEffect(() => {
    if (placeholder || waitingFor) return;
    const fit = () => {
      const box = fitBoxRef.current;
      const txt = textRef.current;
      if (!box || !txt) return;
      const w = box.clientWidth;
      const h = box.clientHeight;
      if (w === 0 || h === 0) return;

      let lo = FIT_MIN;
      let hi = FIT_MAX;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        txt.style.fontSize = `${mid}px`;
        const fits = txt.scrollWidth <= w && txt.scrollHeight <= h;
        if (fits) lo = mid;
        else hi = mid - 1;
      }
      txt.style.fontSize = `${lo}px`;
      setFontSize(lo);
    };

    fit();
    const ro = new ResizeObserver(fit);
    if (fitBoxRef.current) ro.observe(fitBoxRef.current);
    return () => ro.disconnect();
  }, [displayedAnswer, placeholder]);

  return (
    <>
      {heading && (
        <p className="text-gray-900 text-base tablet:text-xl font-semibold text-center">
          {heading}
        </p>
      )}
      <div
        className={`
          w-full h-32 tablet:h-48 tablet:landscape:h-56 phone-landscape:h-full
          p-4 tablet:p-6 phone-landscape:p-4
          rounded-xl border flex items-center justify-center
          ${placeholder
            ? 'border-dashed border-gray-400 bg-gray-50 shadow-none'
            : `border-black stack-shadow-sm texture-paper ${bgClass}`
          }
          ${pulse ? 'animate-card-receive' : ''}
          ${className}
        `}
      >
        {placeholder ? (
          <p className={`font-bold text-center break-words text-sm tablet:text-base ${textClass}`}>
            {answer}
          </p>
        ) : waitingFor ? (
          <div className="w-full h-full flex items-center justify-center overflow-hidden px-2">
            <p className="text-gray-700 text-sm tablet:text-base phone-landscape:text-lg font-medium text-center italic leading-snug flex items-center justify-center flex-wrap gap-x-1.5 gap-y-1">
              <span>En attente que</span>
              <span className="inline-flex items-center gap-1.5 not-italic font-semibold text-gray-900">
                <Avatar avatarId={waitingFor.avatarId} name={waitingFor.name} size="sm" />
                <span>{waitingFor.name}</span>
              </span>
              <span>t'attribue une réponse…</span>
            </p>
          </div>
        ) : (
          <div ref={fitBoxRef} className="w-full h-full flex items-center justify-center overflow-hidden">
            <p
              ref={textRef}
              lang="fr"
              className={`font-bold text-center break-words hyphens-manual ${textClass}`}
              style={{ fontSize: `${fontSize}px`, lineHeight: 1.15 }}
            >
              {displayedAnswer}
            </p>
          </div>
        )}
      </div>
    </>
  );
};

export default PlayerAnswerCard;
