import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AdminDeckSummary } from '@onskone/shared';
import type { CategoryStyle } from './shared';
import { FLOATING } from '../ui';

export const SubjectCard = ({
  subject, palette, collapsed,
}: {
  subject: AdminDeckSummary['subjects'][number];
  palette: CategoryStyle;
  collapsed: boolean;
}) => {
  const hasQuestions = subject.questions.length > 0;
  const cardRef = useRef<HTMLButtonElement>(null);
  const [preview, setPreview] = useState<{ top: number; left: number; placement: 'top' | 'bottom' } | null>(null);

  const openPreview = useCallback(() => {
    if (!cardRef.current || !hasQuestions) return;
    const rect = cardRef.current.getBoundingClientRect();
    const placement: 'top' | 'bottom' = rect.top > window.innerHeight * 0.45 ? 'top' : 'bottom';
    setPreview({
      top: placement === 'top' ? rect.top - 8 : rect.bottom + 8,
      left: rect.left + rect.width / 2,
      placement,
    });
  }, [hasQuestions]);

  const closePreview = useCallback(() => setPreview(null), []);

  if (!collapsed) {
    return (
      <div className="relative rounded-lg border border-white/[0.06] bg-black/25 overflow-hidden">
        <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${palette.strip}`} />
        <div className="flex items-center gap-2 px-3 py-2 pl-4 border-b border-white/[0.06]">
          <span className="text-[13px] text-white/90 font-medium truncate" title={subject.subject}>
            {subject.subject}
          </span>
        </div>
        {!hasQuestions ? (
          <p className="px-3 py-3 text-[12px] text-white/50 italic">Aucune question</p>
        ) : (
          <ol className="px-3 py-2.5 space-y-1.5">
            {subject.questions.map((q, i) => (
              <li key={i} className="flex gap-2 text-[13px] text-white/80 leading-snug">
                <span className="text-[12px] tabular-nums text-white/50 shrink-0 w-5 text-right">
                  {i + 1}.
                </span>
                <span className="whitespace-pre-wrap break-words">{q}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        ref={cardRef}
        type="button"
        onClick={openPreview}
        onBlur={closePreview}
        onPointerEnter={(e) => { if (e.pointerType === 'mouse') openPreview(); }}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse') closePreview(); }}
        onContextMenu={(e) => { e.preventDefault(); }}
        aria-expanded={hasQuestions ? !!preview : undefined}
        title={hasQuestions ? `${subject.subject} : ${subject.questions.length} question${subject.questions.length > 1 ? 's' : ''}` : `${subject.subject} : aucune question`}
        style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
        className={`relative block w-full h-full min-h-[40px] text-left rounded-lg border border-white/[0.06] hover:border-white/20 bg-black/25 transition-colors overflow-hidden ${hasQuestions ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${palette.strip}`} />
        <span className="px-2 py-1.5 pl-3 h-full flex items-center">
          <span className="block text-[13px] text-white/85 leading-snug truncate">
            {subject.subject}
          </span>
        </span>
      </button>

      {preview && hasQuestions && createPortal(
        <>
          <div
            className="fixed inset-0 z-40 md:hidden"
            onClick={closePreview}
            onTouchMove={closePreview}
          />
          <div
            className="fixed z-50 animate-fade-in pointer-events-none"
            style={(() => {
              const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;
              const baseTransform = preview.placement === 'top' ? 'translateY(-100%)' : 'translateY(0)';
              if (isDesktop) {
                const width = Math.min(440, window.innerWidth * 0.9);
                const left = Math.min(
                  Math.max(12, preview.left - width / 2),
                  window.innerWidth - 12 - width,
                );
                return { top: preview.top, left, width, transform: baseTransform };
              }
              return { top: preview.top, left: 12, right: 12, transform: baseTransform };
            })()}
          >
            <div className={`relative ${FLOATING} overflow-hidden`}>
              <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${palette.strip}`} />
              <div className="px-3 py-2 pl-4 border-b border-white/[0.06] flex items-center">
                <span className="text-[13px] text-white/90 font-medium truncate">
                  {subject.subject}
                </span>
              </div>
              <ol className="px-3 py-2.5 space-y-1.5 max-h-[55vh] overflow-y-auto custom-scroll">
                {subject.questions.map((q, i) => (
                  <li key={i} className="flex gap-2 text-[13px] text-white/85 leading-snug">
                    <span className="text-[12px] tabular-nums text-white/50 shrink-0 w-5 text-right">
                      {i + 1}.
                    </span>
                    <span className="whitespace-pre-wrap break-words">{q}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  );
};
