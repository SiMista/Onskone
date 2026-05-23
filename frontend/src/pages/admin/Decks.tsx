import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';
import type { AdminDeckSummary } from '@onskone/shared';
import { useToast } from '../../components/Toast';
import { fetchAdminDecks } from '../../utils/adminDataApi';
import { CLUSTER } from './shared';
import { StatTile } from './Overview';

interface CategoryStyle {
  strip: string;
  chip: string;
  dot: string;
  text: string;
  ring: string;
  glow: string;
}

const CATEGORY_PALETTE: Record<string, CategoryStyle> = {
  ICEBREAKERS: {
    strip: 'bg-sky-400',
    chip: 'bg-sky-500/15 border-sky-400/50 text-sky-100',
    dot: 'bg-sky-400',
    text: 'text-sky-300',
    ring: 'ring-sky-300/40',
    glow: 'from-sky-400 to-transparent',
  },
  FUN: {
    strip: 'bg-amber-400',
    chip: 'bg-amber-400/15 border-amber-300/50 text-amber-100',
    dot: 'bg-amber-400',
    text: 'text-amber-300',
    ring: 'ring-amber-300/40',
    glow: 'from-amber-400 to-transparent',
  },
  DEEP: {
    strip: 'bg-red-400',
    chip: 'bg-red-500/15 border-red-400/50 text-red-100',
    dot: 'bg-red-400',
    text: 'text-red-300',
    ring: 'ring-red-300/40',
    glow: 'from-red-400 to-transparent',
  },
};

const FALLBACK_PALETTE: CategoryStyle = {
  strip: 'bg-white/30',
  chip: 'bg-white/[0.05] border-white/15 text-white/75',
  dot: 'bg-white/50',
  text: 'text-white/75',
  ring: 'ring-white/20',
  glow: 'from-white/40 to-transparent',
};

const categoryStyle = (category: string): CategoryStyle =>
  CATEGORY_PALETTE[category] ?? FALLBACK_PALETTE;

const deckKey = (d: { category: string; theme: string }) => `${d.category}-${d.theme}`;

const SubjectCard = ({
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

const DeckRailItem = ({
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

const DeckDetail = ({
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

export const DecksPanel = ({ active }: { active: boolean }) => {
  const [decks, setDecks] = useState<AdminDeckSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [questionsCollapsed, setQuestionsCollapsed] = useState(true);
  const showToast = useToast();

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchAdminDecks();
      setDecks(data);
      setLoaded(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (active && !loaded) load();
  }, [active, loaded, load]);

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

  const filtered = useMemo<AdminDeckSummary[]>(() => {
    const q = search.trim().toLowerCase();
    const byCategory = decks.filter((d) => !categoryFilter || d.category === categoryFilter);
    if (!q) return byCategory;
    const result: AdminDeckSummary[] = [];
    for (const d of byCategory) {
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
      if (subjects.length > 0) {
        result.push({ ...d, subjects, subjectCount: subjects.length, questionCount });
      }
    }
    return result;
  }, [decks, search, categoryFilter]);

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
