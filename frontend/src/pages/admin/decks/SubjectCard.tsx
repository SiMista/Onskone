import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AdminDeckSummary } from '@onskone/shared';
import type { CategoryStyle } from './shared';

export const SubjectCard = ({
  subject, palette, collapsed,
}: {
  subject: AdminDeckSummary['subjects'][number];
  palette: CategoryStyle;
  collapsed: boolean;
}) => {
  const hasQuestions = subject.questions.length > 0;
  const cardRef = useRef<HTMLDivElement>(null);
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
      <div className="relative rounded-lg border border-white/[0.07] bg-black/20 overflow-hidden">
        <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${palette.strip}`} />
        <div className="flex items-center gap-2 px-3 py-2 pl-4 bg-white/[0.015] border-b border-white/[0.05]">
          <span className="text-[13px] text-white/90 font-medium truncate" title={subject.subject}>
            {subject.subject}
          </span>
        </div>
        {!hasQuestions ? (
          <p className="px-3 py-3 text-[11px] text-white/25 italic">aucune question</p>
        ) : (
          <ol className="px-3 py-2.5 space-y-1.5">
            {subject.questions.map((q, i) => (
              <li key={i} className="flex gap-2 text-[12.5px] text-white/80 leading-snug">
                <span className="font-mono text-[11px] tabular-nums text-white/25 mt-0.5 shrink-0 w-5 text-right">
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
      <div
        ref={cardRef}
        onClick={openPreview}
        onPointerEnter={(e) => { if (e.pointerType === 'mouse') openPreview(); }}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse') closePreview(); }}
        onContextMenu={(e) => { e.preventDefault(); }}
        style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
        className={`relative w-full h-full text-left rounded-md border border-white/[0.07] hover:border-white/20 bg-black/20 transition-all overflow-hidden ${hasQuestions ? 'cursor-pointer' : ''}`}
      >
        <span className={`absolute left-0 top-0 bottom-0 w-[2px] ${palette.strip}`} />
        <div className="px-2 py-1.5 pl-2.5 bg-white/[0.015] h-full flex items-center">
          <span className="block text-[12px] text-white/85 leading-snug truncate" title={subject.subject}>
            {subject.subject}
          </span>
        </div>
      </div>

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
            <div className="relative rounded-xl border border-white/20 bg-[#1b1f2a]/98 backdrop-blur-md shadow-[0_24px_60px_-10px_rgba(0,0,0,0.85)] overflow-hidden">
              <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${palette.strip}`} />
              <div className="px-3 py-2 pl-4 border-b border-white/[0.06] flex items-center">
                <span className="text-[12.5px] text-white/90 font-medium truncate">
                  {subject.subject}
                </span>
              </div>
              <ol className="px-3 py-2.5 space-y-1.5 max-h-[55vh] overflow-y-auto custom-scroll">
                {subject.questions.map((q, i) => (
                  <li key={i} className="flex gap-2 text-[12.5px] text-white/85 leading-snug">
                    <span className="font-mono text-[11px] tabular-nums text-white/30 mt-0.5 shrink-0 w-5 text-right">
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
