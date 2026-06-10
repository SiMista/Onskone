import { Icon } from '@iconify/react';
import type { AdminDeckSummary } from '@onskone/shared';
import { categoryStyle, type CategoryStyle } from './shared';
import { SubjectCard } from './SubjectCard';

export const DeckRailItem = ({
  deck, palette, selected, onSelect,
}: {
  deck: AdminDeckSummary;
  palette: CategoryStyle;
  selected: boolean;
  onSelect: () => void;
}) => (
  <button
    onClick={onSelect}
    className={`group relative w-full flex items-center gap-2 pl-3 pr-2.5 py-1.5 rounded-md border transition-colors text-left ${selected
      ? `bg-white/[0.08] border-white/15 ring-1 ${palette.ring}`
      : 'bg-transparent border-transparent hover:bg-white/[0.04]'
      }`}
  >
    <span className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full ${palette.strip} ${selected ? '' : 'opacity-60 group-hover:opacity-100'} transition-opacity`} />
    <span className={`text-[12.5px] truncate flex-1 ${selected ? 'text-white' : 'text-white/75 group-hover:text-white/95'}`} title={deck.theme}>
      {deck.theme}
    </span>
    <span className="font-mono text-[11px] tabular-nums text-white/40" title={`${deck.subjectCount} sujet${deck.subjectCount > 1 ? 's' : ''}`}>
      {deck.subjectCount}
    </span>
  </button>
);

export const DeckDetail = ({
  deck, questionsCollapsed, onToggleCollapse,
}: {
  deck: AdminDeckSummary;
  questionsCollapsed: boolean;
  onToggleCollapse: () => void;
}) => {
  const palette = categoryStyle(deck.category);
  return (
    <div className="rounded-xl border border-white/[0.07] bg-gradient-to-b from-white/[0.025] to-transparent overflow-hidden">
      <div className="relative px-5 py-4 border-b border-white/[0.06]">
        <div className="flex items-baseline gap-2.5 flex-wrap">
          <span className={`px-1.5 py-0.5 rounded border font-mono text-[11px] uppercase tracking-wider ${palette.chip}`}>
            {deck.category}
          </span>
          <h2 className="text-[22px] font-semibold tracking-tight text-white leading-none">
            {deck.theme}
          </h2>
          <span className="text-[12px] text-white/55 ml-auto">
            <span className={palette.text}>{deck.subjectCount}</span> sujet{deck.subjectCount > 1 ? 's' : ''}
          </span>
          <button
            onClick={onToggleCollapse}
            className="px-2.5 py-1 rounded-md border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-white/75 hover:text-white text-[12px] transition-colors inline-flex items-center gap-1.5"
            title={questionsCollapsed ? 'Afficher les questions de tous les sujets' : 'Cacher les questions (survoler un sujet pour les voir)'}
          >
            <Icon icon={questionsCollapsed ? 'mdi:eye-outline' : 'mdi:eye-off-outline'} className="w-3.5 h-3.5" />
            {questionsCollapsed ? 'Afficher les questions' : 'Cacher les questions'}
          </button>
        </div>
        <div className={`absolute left-0 right-0 bottom-0 h-px bg-gradient-to-r ${palette.glow}`} />
      </div>

      <div className="p-4">
        {deck.subjects.length === 0 ? (
          <p className="text-center py-10 font-mono text-[11px] uppercase tracking-[0.3em] text-white/25">
            aucun sujet
          </p>
        ) : (
          <div
            className={`grid gap-1.5 ${questionsCollapsed
              ? 'grid-cols-3 md:grid-cols-4 xl:grid-cols-5'
              : 'grid-cols-1 md:grid-cols-2'
              }`}
          >
            {deck.subjects.map((s) => (
              <SubjectCard
                key={s.subject}
                subject={s}
                palette={palette}
                collapsed={questionsCollapsed}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
