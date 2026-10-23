import { useState } from 'react';
import { DecksPanel } from './Decks';
import { ContentPanel } from './Content';

type CatalogueView = 'decks' | 'content';

const VIEWS: { id: CatalogueView; label: string; hint: string }[] = [
  { id: 'decks', label: 'Decks', hint: 'thèmes, sujets et questions' },
  { id: 'content', label: 'Contenu', hint: 'paliers, succès, avatars, légal…' },
];

// Decks + Contenu du site fusionnés : même famille (données fixes du jeu), un seul onglet.
export const CataloguePanel = ({ active }: { active: boolean }) => {
  const [view, setView] = useState<CatalogueView>('decks');

  return (
    <div className="space-y-5">
      <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-black/30 border border-white/[0.06]">
        {VIEWS.map((v) => {
          const selected = view === v.id;
          return (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              title={v.hint}
              className={`cursor-pointer px-3.5 py-1.5 rounded-md font-mono text-[11px] font-bold uppercase tracking-[0.12em] transition-colors ${selected
                ? 'bg-amber-400/15 text-amber-200'
                : 'text-white/45 hover:text-white/80'
                }`}
            >
              {v.label}
            </button>
          );
        })}
      </div>

      {view === 'decks' && <DecksPanel active={active} />}
      {view === 'content' && <ContentPanel />}
    </div>
  );
};
