import { Icon } from '@iconify/react';
import type { AdminDeckSummary } from '@onskone/shared';
import { categoryStyle, type CategoryStyle } from './shared';
import { SubjectCard } from './SubjectCard';
import { BADGE, PANEL, btn } from '../ui';

export const DeckRailItem = ({
  deck, palette, selected, onSelect,
}: {
  deck: AdminDeckSummary;
  palette: CategoryStyle;
  selected: boolean;
  onSelect: () => void;
}) => (
  <button
    type="button"
    onClick={onSelect}
    aria-pressed={selected}
    className={`cursor-pointer group relative w-full flex items-center gap-2 pl-3 pr-2.5 py-1.5 rounded-lg border transition-colors text-left ${selected
      ? 'bg-amber-400/10 border-amber-300/40'
      : 'bg-transparent border-transparent hover:bg-white/[0.04]'
      }`}
  >
    <span className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full ${palette.strip} ${selected ? '' : 'opacity-60 group-hover:opacity-100'} transition-opacity`} />
    <span className={`text-[13px] truncate flex-1 ${selected ? 'text-white' : 'text-white/75 group-hover:text-white/95'}`} title={deck.theme}>
      {deck.theme}
    </span>
    <span className="text-[12px] tabular-nums text-white/55" title={`${deck.subjectCount} sujet${deck.subjectCount > 1 ? 's' : ''}`}>
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
    <div className={`${PANEL} overflow-hidden`}>
      <div className="px-5 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className={`${BADGE} ${palette.chip}`}>
            {deck.category}
          </span>
          <h2 className="text-[16px] font-semibold tracking-tight text-white leading-tight">
            {deck.theme}
          </h2>
          <span className="text-[12px] text-white/55 ml-auto">
            <span className={palette.text}>{deck.subjectCount}</span> sujet{deck.subjectCount > 1 ? 's' : ''}
          </span>
          <button
            type="button"
            onClick={onToggleCollapse}
            className={btn('secondary', 'sm')}
            title={questionsCollapsed ? 'Afficher les questions de tous les sujets' : 'Cacher les questions (survole ou touche un sujet pour les voir)'}
          >
            <Icon icon={questionsCollapsed ? 'mdi:eye-outline' : 'mdi:eye-off-outline'} className="w-4 h-4" aria-hidden />
            {questionsCollapsed ? 'Afficher les questions' : 'Cacher les questions'}
          </button>
        </div>
        {deck.description && (
          <p className="mt-2 text-[13px] text-white/60 leading-snug max-w-2xl">{deck.description}</p>
        )}
      </div>

      <div className="p-4">
        {deck.subjects.length === 0 ? (
          <p className="text-center py-10 text-[13px] text-white/50">
            Ce thème n'a encore aucun sujet.
          </p>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
};
