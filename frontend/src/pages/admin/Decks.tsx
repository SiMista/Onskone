import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AdminDeckSummary } from '@onskone/shared';
import { useAdminResource } from '../../hooks';
import { fetchAdminDecks } from '../../utils/adminDataApi';
import { EmptyState, KpiCell, LoadingState, PANEL, SearchField, Segmented } from './ui';
import { categoryStyle, deckKey } from './decks/shared';
import { DeckRailItem, DeckDetail } from './decks/DeckDetail';

export const DecksPanel = ({ active }: { active: boolean }) => {
  const { data, isLoading } = useAdminResource<AdminDeckSummary[]>({
    fetcher: fetchAdminDecks,
    active,
  });
  // Référence stable quand `data` ne change pas (sinon `data ?? []` recrée un
  // tableau à chaque render et invalide les useMemo qui en dépendent).
  const decks = useMemo(() => data ?? [], [data]);
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
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCell compact label="Catégories" value={totals.categories} />
        <KpiCell compact label="Thèmes" value={totals.themes} />
        <KpiCell compact label="Sujets" value={totals.subjects} />
        <KpiCell compact label="Questions" value={totals.questions} />
      </div>

      <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-2">
        <SearchField value={search} onChange={setSearch} placeholder="Chercher un sujet ou une question" />

        {categories.length > 0 && (
          <Segmented
            ariaLabel="Filtrer par catégorie"
            value={categoryFilter}
            onChange={setCategoryFilter}
            className="flex-wrap"
            options={[
              { value: '', label: <>Toutes <span className="tabular-nums opacity-70">{decks.length}</span></> },
              ...categories.map((c) => ({
                value: c,
                accent: categoryStyle(c).strip,
                label: <>{c} <span className="tabular-nums opacity-70">{decks.filter((d) => d.category === c).length}</span></>,
              })),
            ]}
          />
        )}
      </div>

      {isLoading && decks.length === 0 ? (
        <LoadingState label="Chargement des decks…" />
      ) : filtered.length === 0 ? (
        decks.length === 0 ? (
          <EmptyState
            icon="mdi:cards-outline"
            title="Aucun deck trouvé"
            hint="Le serveur n'a renvoyé aucun thème : vérifie que les fichiers de questions sont bien présents."
          />
        ) : (
          <EmptyState
            icon="mdi:magnify"
            title="Aucun sujet ni question ne correspond"
            hint="Essaie un autre mot, ou repasse sur « Toutes » les catégories."
          />
        )
      ) : (
        <div className="flex flex-col md:flex-row gap-3">
          <div className="md:hidden space-y-3">
            {grouped.map(([category, items]) => {
              const palette = categoryStyle(category);
              return (
                <div key={category} className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <span className={`text-[12px] font-semibold ${palette.text}`}>
                      {category}
                    </span>
                    <span className="text-[12px] tabular-nums text-white/50">
                      {items.length} thème{items.length > 1 ? 's' : ''}
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
                          type="button"
                          onClick={() => setSelectedKey(k)}
                          aria-pressed={selected}
                          className={`cursor-pointer relative overflow-hidden rounded-lg border text-left transition-colors flex items-center gap-1.5 px-2 py-2 pl-3 min-h-[40px] ${selected
                            ? 'bg-amber-400/10 border-amber-300/40'
                            : 'bg-black/25 border-white/[0.06] active:bg-white/[0.05]'
                            }`}
                        >
                          <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${palette.strip}`} />
                          <span className={`text-[13px] leading-tight truncate flex-1 ${selected ? 'text-white' : 'text-white/80'}`}>
                            {d.theme}
                          </span>
                          <span className="text-[12px] tabular-nums text-white/55 shrink-0" title={`${d.subjectCount} sujet${d.subjectCount > 1 ? 's' : ''}`}>
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
            <div className={`${PANEL} overflow-hidden`}>
              <div className="max-h-[calc(100vh-300px)] overflow-y-auto custom-scroll p-2 space-y-3">
                {grouped.map(([category, items]) => {
                  const palette = categoryStyle(category);
                  return (
                    <div key={category} className="space-y-1">
                      <div className="sticky top-0 z-10 -mx-2 px-3 py-1.5 bg-[#1b202d]/95 backdrop-blur flex items-center gap-2 border-b border-white/[0.06]">
                        <span className={`text-[12px] font-semibold ${palette.text}`}>
                          {category}
                        </span>
                        <span className="ml-auto text-[12px] tabular-nums text-white/50">
                          {items.length} thème{items.length > 1 ? 's' : ''}
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
              <div className={`${PANEL} text-center py-20 px-4 text-[13px] text-white/55`}>
                Choisis un thème dans la liste pour voir ses sujets.
              </div>
            )}
          </section>
        </div>
      )}

    </div>
  );
};
