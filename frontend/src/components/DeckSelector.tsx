import { useState, useMemo, useRef, useEffect } from 'react';
import { Icon } from '@iconify/react';
import type { DecksCatalog, SelectedDecks } from '@onskone/shared';
import { getCategoryColor } from '../constants/game';

type Props = {
    catalog: DecksCatalog;
    selected: SelectedDecks;
    readOnly: boolean;
    hostName: string;
    onChange: (next: SelectedDecks) => void;
};

const isThemeSelected = (selected: SelectedDecks, category: string, theme: string): boolean => {
    return selected[category]?.includes(theme) ?? false;
};

const toggleTheme = (selected: SelectedDecks, category: string, theme: string, catalog: DecksCatalog): SelectedDecks => {
    const next: SelectedDecks = {};
    for (const cat of Object.keys(catalog)) {
        next[cat] = [...(selected[cat] || [])];
    }
    const list = next[category] || [];
    next[category] = list.includes(theme) ? list.filter(t => t !== theme) : [...list, theme];
    return next;
};

const setCategory = (selected: SelectedDecks, category: string, all: boolean, catalog: DecksCatalog): SelectedDecks => {
    const next: SelectedDecks = {};
    for (const cat of Object.keys(catalog)) {
        next[cat] = cat === category ? (all ? [...catalog[cat]] : []) : [...(selected[cat] || [])];
    }
    return next;
};

const setAllGlobal = (all: boolean, catalog: DecksCatalog): SelectedDecks => {
    const next: SelectedDecks = {};
    for (const [cat, themes] of Object.entries(catalog)) {
        next[cat] = all ? [...themes] : [];
    }
    return next;
};

const categoryDescriptions: Record<string, string> = {
    ICEBREAKERS: 'Questions simples pour briser la glace',
    FUN: 'Amuse-toi avec tes amis sur des sujets marrants',
    DEEP: 'Plonge dans des discussions plus personnelles',
};

const categoryIcons: Record<string, string> = {
    ICEBREAKERS: 'fluent-emoji-flat:ice',
    FUN: 'fluent-emoji-flat:party-popper',
    DEEP: 'fluent-emoji-flat:fire',
};
const DEFAULT_DECK_ICON = 'fluent-emoji-flat:flower-playing-cards';

const hexToSoftBg = (hex: string): string => {
    return `${hex}1f`;
};

const DeckSelector: React.FC<Props> = ({ catalog, selected, readOnly, hostName, onChange }) => {
    const carouselRef = useRef<HTMLDivElement>(null);
    const [activeSlide, setActiveSlide] = useState(0);
    const categories = useMemo(() => Object.keys(catalog), [catalog]);

    // Local state to avoid stale prop on rapid clicks
    const [localSelected, setLocalSelected] = useState<SelectedDecks>(selected);
    const localSelectedRef = useRef<SelectedDecks>(localSelected);
    useEffect(() => {
        setLocalSelected(selected);
        localSelectedRef.current = selected;
    }, [selected]);

    const handleThemeToggle = (cat: string, theme: string) => {
        if (readOnly) return;
        const next = toggleTheme(localSelectedRef.current, cat, theme, catalog);
        localSelectedRef.current = next;
        setLocalSelected(next);
        onChange(next);
    };

    // Mobile carousel: track active slide for dots indicator
    useEffect(() => {
        const el = carouselRef.current;
        if (!el) return;
        let raf = 0;
        const handleScroll = () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
                const slideWidth = (el.children[0] as HTMLElement | undefined)?.offsetWidth ?? el.clientWidth;
                if (!slideWidth) return;
                const idx = Math.round(el.scrollLeft / slideWidth);
                setActiveSlide(Math.max(0, Math.min(categories.length - 1, idx)));
            });
        };
        el.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            el.removeEventListener('scroll', handleScroll);
            cancelAnimationFrame(raf);
        };
    }, [categories.length]);

    const goToSlide = (i: number) => {
        const el = carouselRef.current;
        if (!el) return;
        const slideWidth = (el.children[0] as HTMLElement | undefined)?.offsetWidth ?? el.clientWidth;
        el.scrollTo({ left: i * slideWidth, behavior: 'smooth' });
    };

    const totalSelected = useMemo(
        () => Object.values(localSelected).reduce((acc, arr) => acc + arr.length, 0),
        [localSelected]
    );

    const totalThemes = useMemo(
        () => Object.values(catalog).reduce((acc, arr) => acc + arr.length, 0),
        [catalog]
    );

    if (categories.length === 0) {
        return (
            <div className="text-center text-sm text-gray-500 italic py-2">
                Chargement des decks de questions…
            </div>
        );
    }

    const allChecked = totalSelected === totalThemes && totalThemes > 0;
    const noneChecked = totalSelected === 0;

    const toggleGlobal = () => {
        const next = setAllGlobal(!allChecked, catalog);
        localSelectedRef.current = next;
        setLocalSelected(next);
        onChange(next);
    };

    return (
        <div className="w-full flex flex-col gap-2">
            {/* Barre globale */}
            {readOnly ? (
                <div className="text-xs text-gray-600 italic w-full">
                    Seul <strong className="not-italic">{hostName}</strong> peut choisir les thèmes.
                </div>
            ) : (
                <>
                    <div className="text-sm font-display font-bold text-gray-700">
                        Clique sur les thèmes pour les ajouter
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-gray-500">
                            {totalSelected} thème{totalSelected > 1 ? 's' : ''} sélectionné{totalSelected > 1 ? 's' : ''}
                        </span>
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold select-none">
                            <input
                                type="checkbox"
                                className="w-4 h-4 cursor-pointer accent-black"
                                checked={allChecked}
                                ref={el => { if (el) el.indeterminate = !allChecked && !noneChecked; }}
                                onChange={toggleGlobal}
                            />
                            Tout
                        </label>
                    </div>
                </>
            )}

            {/* ---------- Carousel snap horizontal (mobile & desktop) ---------- */}
            <div>
                <div
                    ref={carouselRef}
                    className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth px-[7%] md:px-[15%] pb-1"
                    style={{ scrollbarWidth: 'none' }}
                >
                    {categories.map((cat, i) => {
                        const themes = catalog[cat];
                        const selectedInCat = (localSelected[cat] || []).length;
                        const color = getCategoryColor(cat);
                        const catAllChecked = selectedInCat === themes.length && themes.length > 0;
                        const catNoneChecked = selectedInCat === 0;
                        const description = categoryDescriptions[cat] ?? '';
                        const isActive = i === activeSlide;

                        const handleSlideClick = (e: React.MouseEvent) => {
                            if (!isActive) {
                                e.stopPropagation();
                                goToSlide(i);
                            }
                        };

                        return (
                            <div
                                key={cat}
                                className={`snap-center shrink-0 basis-[86%] md:basis-[70%] lg:basis-[55%] px-1.5 transition-opacity ${isActive ? '' : 'opacity-70 cursor-pointer'}`}
                                onClickCapture={handleSlideClick}
                            >
                                <div className="border-[2.5px] border-black rounded-xl bg-white overflow-hidden stack-shadow-sm">
                                    {/* Header coloré */}
                                    <div
                                        className="flex items-center gap-2 px-3 py-2 border-b-[2.5px] border-black"
                                        style={{ backgroundColor: color }}
                                    >
                                        <Icon icon={categoryIcons[cat] ?? DEFAULT_DECK_ICON} width={22} height={22} aria-hidden className="flex-shrink-0" />
                                        <span className="font-display font-bold text-base tracking-tight flex-1 truncate text-black">{cat}</span>
                                        <span className="font-display text-[11px] font-bold text-black/80 whitespace-nowrap flex-shrink-0 bg-white/80 rounded-full px-2 py-0.5 border border-black/10">
                                            {selectedInCat}/{themes.length}
                                        </span>
                                        {!readOnly && (
                                            <label
                                                className="flex items-center cursor-pointer flex-shrink-0"
                                                onClick={e => e.stopPropagation()}
                                            >
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 cursor-pointer accent-black"
                                                    checked={catAllChecked}
                                                    ref={el => { if (el) el.indeterminate = !catAllChecked && !catNoneChecked; }}
                                                    onChange={() => {
                                                        const next = setCategory(localSelectedRef.current, cat, !catAllChecked, catalog);
                                                        localSelectedRef.current = next;
                                                        setLocalSelected(next);
                                                        onChange(next);
                                                    }}
                                                />
                                            </label>
                                        )}
                                    </div>
                                    {/* Corps : description + pills */}
                                    <div style={{ backgroundColor: hexToSoftBg(color) }}>
                                        {description && (
                                            <div className="px-3 py-1.5 text-[11px] italic text-gray-600 border-b border-black/20">
                                                {description}
                                            </div>
                                        )}
                                        <div className="px-2.5 py-2 flex flex-wrap gap-1.5 max-h-[28vh] overflow-y-auto">
                                            {themes.map(theme => {
                                                const active = isThemeSelected(localSelected, cat, theme);
                                                const base = 'font-display text-xs px-2.5 py-1 rounded-full border-2 font-bold tracking-tight transition-colors';
                                                const cursor = readOnly ? 'cursor-default' : 'cursor-pointer active:scale-95';
                                                const inactiveStyle = 'bg-white text-gray-600 border-gray-400';
                                                return (
                                                    <button
                                                        key={theme}
                                                        type="button"
                                                        disabled={readOnly}
                                                        className={`${base} ${active ? 'text-black border-black' : inactiveStyle} ${cursor}`}
                                                        style={active ? { backgroundColor: color } : undefined}
                                                        onClick={() => handleThemeToggle(cat, theme)}
                                                    >
                                                        {theme}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                {/* Dots indicator */}
                <div className="flex items-center justify-center gap-2 mt-2">
                    {categories.map((cat, i) => {
                        const isActive = i === activeSlide;
                        const color = getCategoryColor(cat);
                        return (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => goToSlide(i)}
                                aria-label={`Aller à ${cat}`}
                                className={`transition-all duration-300 border-2 border-black rounded-full cursor-pointer ${
                                    isActive ? 'w-6 h-2.5' : 'w-2.5 h-2.5'
                                }`}
                                style={{ backgroundColor: isActive ? color : 'white' }}
                            />
                        );
                    })}
                </div>
            </div>

        </div>
    );
};

export default DeckSelector;
