import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import type { AdminDeckSummary } from '@onskone/shared';
import { useAdminResource } from '../../hooks';
import { fetchAdminDecks } from '../../utils/adminDataApi';
import { CLUSTER } from './shared';
import { StatTile } from '../../components/admin/StatTile';
import { categoryStyle, deckKey } from './decks/shared';
import { DeckRailItem, DeckDetail } from './decks/DeckDetail';

export const DecksPanel = ({ active }: { active: boolean }) => {
  const { data, isLoading } = useAdminResource<AdminDeckSummary[]>({
    fetcher: fetchAdminDecks,
    active,
  });
  const decks = data ?? [];
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [questionsCollapsed, setQuestionsCollapsed] = useState(true);

  const totals = useMemo(() => {
    const categories = new Set<string>();
    let subjects = 0;
    let questions = 0;
    for (const d of decks) {
      categories.add(d.category);
      subjects += d.subjectCount;
      questions += d.questionCount;
    }
    return {
      categories: categories.size,
      themes: decks.length,
      subjects,
      questions,
    };
  }, [decks]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    decks.forEach((d) => set.add(d.category));
    return Array.from(set).sort();
  }, [decks]);

  const filterDeck = useCallback((d: AdminDeckSummary, q: string): AdminDeckSummary | null => {
    if (!q) return d;
    const subjects: AdminDeckSummary['subjects'] = [];
    let questionCount = 0;
    for (const s of d.subjects) {
      const subjectMatch = s.subject.toLowerCase().includes(q);
      const questions = subjectMatch
        ? s.questions
        : s.questions.filter((qu) => qu.toLowerCase().includes(q));
      if (subjectMatch || questions.length > 0) {
        subjects.push({ ...s, questions });
        questionCount += questions.length;
      }
    }
    if (subjects.length === 0) return null;
    return { ...d, subjects, subjectCount: subjects.length, questionCount };
  }, []);

  const filtered = useMemo<AdminDeckSummary[]>(() => {
    const q = search.trim().toLowerCase();
    const byCategory = decks.filter((d) => !categoryFilter || d.category === categoryFilter);
    if (!q) return byCategory;
    const result: AdminDeckSummary[] = [];
    for (const d of byCategory) {
      const match = filterDeck(d, q);
      if (match) result.push(match);
    }
    return result;
  }, [decks, search, categoryFilter, filterDeck]);

  const grouped = useMemo(() => {
    const map = new Map<string, AdminDeckSummary[]>();
    for (const d of filtered) {
      const arr = map.get(d.category) ?? [];
      arr.push(d);
      map.set(d.category, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  useEffect(() => {
    if (filtered.length === 0) {
      if (selectedKey !== null) setSelectedKey(null);
      return;
    }
    const stillVisible = selectedKey && filtered.some((d) => deckKey(d) === selectedKey);
    if (!stillVisible) {
      setSelectedKey(deckKey(filtered[0]));
    }
  }, [filtered, selectedKey]);

  const selectedDeck = useMemo(
    () => filtered.find((d) => deckKey(d) === selectedKey) ?? null,
    [filtered, selectedKey],
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Catégories" value={totals.categories} accent="amber" />
        <StatTile label="Thèmes" value={totals.themes} accent="sky" />
        <StatTile label="Sujets" value={totals.subjects} accent="violet" />
        <StatTile label="Questions" value={totals.questions} accent="emerald" />
      </div>

      <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-2 md:gap-2.5">
        <div className={`${CLUSTER} w-full md:flex-1 md:min-w-[200px] md:max-w-md`}>
          <Icon icon="mdi:magnify" className="w-4 h-4 text-white/35 ml-0.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="rechercher sujet ou question"
            className="flex-1 min-w-0 bg-transparent border-0 outline-0 text-[12px] text-white/85 placeholder:text-white/25 font-mono"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-white/30 hover:text-white text-[12px] px-1"
            >×</button>
          )}
        </div>

        {categories.length > 0 && (
          <div className={`${CLUSTER} hidden md:flex flex-wrap`}>
            <button
              onClick={() => setCategoryFilter('')}
              className={`px-2 py-0.5 rounded font-mono text-[11px] uppercase tracking-wider transition-colors ${!categoryFilter ? 'bg-white/[0.08] text-white' : 'text-white/45 hover:text-white/80'
                }`}
            >toutes</button>
            {categories.map((c) => {
              const palette = categoryStyle(c);
              const isActive = categoryFilter === c;
              return (
                <button
                  key={c}
                  onClick={() => setCategoryFilter(c)}
                  className={`inline-flex items-center px-2 py-0.5 rounded font-mono text-[11px] uppercase tracking-wider transition-colors ${isActive
                    ? `bg-white/[0.08] ${palette.text}`
                    : `${palette.text} opacity-50 hover:opacity-90`
                    }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {categories.length > 0 && (
        <div className="md:hidden grid grid-cols-4 gap-1.5">
          <button
            onClick={() => setCategoryFilter('')}
            className={`flex flex-col items-center justify-center gap-1 px-1 py-2 rounded-lg border transition-colors ${!categoryFilter
              ? 'bg-white/[0.08] border-white/20 text-white'
              : 'bg-white/[0.02] border-white/[0.07] text-white/55'
              }`}
          >
            <span className="font-mono text-[10px] uppercase tracking-wider">Toutes</span>
            <span className="tabular-nums font-bold text-[13px] leading-none text-white/85">
              {decks.length}
            </span>
          </button>
          {categories.map((c) => {
            const palette = categoryStyle(c);
            const isActive = categoryFilter === c;
            const count = decks.filter((d) => d.category === c).length;
            return (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                className={`relative flex flex-col items-center justify-center gap-1 px-1 py-2 rounded-lg border transition-colors overflow-hidden ${isActive
                  ? `bg-white/[0.08] border-white/20`
                  : 'bg-white/[0.02] border-white/[0.07]'
                  }`}
              >
                <span className={`absolute top-0 left-0 right-0 h-[3px] ${palette.strip} ${isActive ? '' : 'opacity-50'}`} />
                <span className={`font-mono text-[10px] uppercase tracking-wider ${isActive ? palette.text : 'text-white/55'}`}>
                  {c}
                </span>
                <span className={`tabular-nums font-bold text-[13px] leading-none ${isActive ? 'text-white' : 'text-white/65'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {isLoading && decks.length === 0 ? (
        <div className="text-center py-20 font-mono text-[11px] uppercase tracking-[0.3em] text-white/30">
          chargement…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 font-mono text-[11px] uppercase tracking-[0.3em] text-white/30">
          {decks.length === 0 ? 'aucun deck' : 'aucun résultat'}
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-3">
          <div className="md:hidden space-y-3">
            {grouped.map(([category, items]) => {
              const palette = categoryStyle(category);
              return (
                <div key={category} className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <span className={`font-mono text-[10px] uppercase tracking-[0.22em] font-bold ${palette.text}`}>
                      {category}
                    </span>
                    <span className="font-mono text-[10px] tabular-nums text-white/30">
                      {items.length}
                    </span>
                    <span className="flex-1 h-px bg-white/[0.05]" />
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {items.map((d) => {
                      const k = deckKey(d);
                      const selected = k === selectedKey;
                      return (
                        <button
                          key={k}
                          onClick={() => setSelectedKey(k)}
                          className={`relative overflow-hidden rounded-md border text-left transition-colors flex items-center gap-1.5 px-2 py-1.5 pl-2.5 ${selected
                            ? `bg-white/[0.08] border-white/15 ring-1 ${palette.ring}`
                            : 'bg-white/[0.02] border-white/[0.07] active:bg-white/[0.05]'
                            }`}
                        >
                          <span className={`absolute left-0 top-0 bottom-0 w-[2px] ${palette.strip}`} />
                          <span className={`text-[12px] leading-tight truncate flex-1 ${selected ? 'text-white' : 'text-white/80'}`}>
                            {d.theme}
                          </span>
                          <span className="font-mono text-[10px] tabular-nums text-white/45 shrink-0">
                            {d.subjectCount}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <aside className="hidden md:block md:w-72 shrink-0">
            <div className="rounded-xl border border-white/[0.07] bg-gradient-to-b from-white/[0.02] to-transparent overflow-hidden">
              <div className="max-h-[calc(100vh-300px)] overflow-y-auto custom-scroll p-2 space-y-3">
                {grouped.map(([category, items]) => {
                  const palette = categoryStyle(category);
                  return (
                    <div key={category} className="space-y-1">
                      <div className="sticky top-0 z-10 -mx-2 px-3 py-1.5 bg-[#161a24]/95 backdrop-blur flex items-center gap-2 border-b border-white/[0.05]">
                        <span className={`font-mono text-[11px] uppercase tracking-[0.22em] font-bold ${palette.text}`}>
                          {category}
                        </span>
                        <span className="ml-auto font-mono text-[11px] tabular-nums text-white/30">
                          {items.length}
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        {items.map((d) => {
                          const k = deckKey(d);
                          return (
                            <DeckRailItem
                              key={k}
                              deck={d}
                              palette={palette}
                              selected={k === selectedKey}
                              onSelect={() => setSelectedKey(k)}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>

          <section className="flex-1 min-w-0">
            {selectedDeck ? (
              <DeckDetail
                deck={selectedDeck}
                questionsCollapsed={questionsCollapsed && !search.trim()}
                onToggleCollapse={() => setQuestionsCollapsed((v) => !v)}
              />
            ) : (
              <div className="rounded-xl border border-white/[0.07] bg-gradient-to-b from-white/[0.02] to-transparent text-center py-20 font-mono text-[11px] uppercase tracking-[0.3em] text-white/30">
                sélectionne un thème
              </div>
            )}
          </section>
        </div>
      )}

    </div>
  );
};
