import { useState, useMemo } from 'react';
import { BsChevronDown } from 'react-icons/bs';
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
    ICEBREAKERS: 'Pour briser la glace',
    FUN: 'Amuse-toi entre amis',
    DEEP: 'Des conversations profondes',
};

const categoryIcons: Record<string, string> = {
    ICEBREAKERS: '🧊',
    FUN: '🎉',
    DEEP: '🔥',
};

const DeckSelector: React.FC<Props> = ({ catalog, selected, readOnly, hostName, onChange }) => {
    const [openCategory, setOpenCategory] = useState<string | null>(null);
    const categories = useMemo(() => Object.keys(catalog), [catalog]);

    const totalSelected = useMemo(
        () => Object.values(selected).reduce((acc, arr) => acc + arr.length, 0),
        [selected]
    );

    const totalThemes = useMemo(
        () => Object.values(catalog).reduce((acc, arr) => acc + arr.length, 0),
        [catalog]
    );

    if (categories.length === 0) {
        return (
            <div className="text-center text-sm text-gray-500 italic py-2">
                Chargement des paquets…
            </div>
        );
    }

    const toggleExpand = (cat: string) => {
        setOpenCategory(prev => (prev === cat ? null : cat));
    };

    const allChecked = totalSelected === totalThemes && totalThemes > 0;
    const noneChecked = totalSelected === 0;

    const toggleGlobal = () => {
        onChange(setAllGlobal(!allChecked, catalog));
    };

    return (
        <div className="w-full flex flex-col gap-2">
            {/* Barre globale */}
            {readOnly ? (
                <div className="text-xs text-gray-600 italic w-full">
                    Seul <strong className="not-italic">{hostName}</strong> peut choisir les thèmes.
                </div>
            ) : (
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
            )}

            {/* Liste des catégories - vertical sur mobile, horizontal sur PC */}
            <div className="relative flex flex-col md:grid md:grid-cols-3 gap-1.5">
                {categories.map(cat => {
                    const themes = catalog[cat];
                    const selectedInCat = (selected[cat] || []).length;
                    const isOpen = openCategory === cat;
                    const color = getCategoryColor(cat);
                    const catAllChecked = selectedInCat === themes.length && themes.length > 0;
                    const catNoneChecked = selectedInCat === 0;
                    const description = categoryDescriptions[cat] ?? '';

                    return (
                        <div key={cat} className={`border-2 border-black rounded-lg w-full bg-white/80 min-w-0 overflow-hidden shadow-[2px_2px_0_0_rgba(0,0,0,0.15)] transition-transform ${isOpen ? 'md:-translate-y-0.5' : ''}`}>
                            <div
                                className="flex items-center gap-1.5 px-2 py-1.5 cursor-pointer select-none transition-all hover:brightness-[1.05]"
                                style={{ backgroundColor: color }}
                                onClick={() => toggleExpand(cat)}
                            >
                                <BsChevronDown
                                    size={12}
                                    className={`transition-transform duration-300 flex-shrink-0 ${isOpen ? 'rotate-0' : '-rotate-90'}`}
                                />
                                <span className="font-bold text-xs flex-1 truncate text-black">{cat}</span>
                                <span className="text-[10px] font-bold text-black/70 whitespace-nowrap flex-shrink-0 bg-white/60 rounded-full px-1.5 py-0.5">
                                    {selectedInCat}/{themes.length}
                                </span>
                                {!readOnly && (
                                    <label
                                        className="flex items-center cursor-pointer flex-shrink-0"
                                        onClick={e => e.stopPropagation()}
                                    >
                                        <input
                                            type="checkbox"
                                            className="w-3.5 h-3.5 cursor-pointer accent-black"
                                            checked={catAllChecked}
                                            ref={el => { if (el) el.indeterminate = !catAllChecked && !catNoneChecked; }}
                                            onChange={() => onChange(setCategory(selected, cat, !catAllChecked, catalog))}
                                        />
                                    </label>
                                )}
                            </div>
                            {/* Panel mobile uniquement - inline sous la catégorie */}
                            {isOpen && (
                                <div className="md:hidden animate-menu-open bg-white border-t-2 border-black max-h-[40vh] overflow-y-auto">
                                    {description && (
                                        <div className="px-2 py-1.5 text-[11px] italic text-gray-600 border-b border-black/20 flex items-center gap-1.5">
                                            <span aria-hidden>{categoryIcons[cat] ?? '🎴'}</span>
                                            {description}
                                        </div>
                                    )}
                                    <div className="px-2 py-2 flex flex-wrap gap-1.5">
                                        {themes.map(theme => {
                                            const active = isThemeSelected(selected, cat, theme);
                                            const base = 'text-xs px-2.5 py-1 rounded-full border-2 font-bold transition-colors';
                                            const cursor = readOnly ? 'cursor-default' : 'cursor-pointer hover:scale-105';
                                            const inactiveStyle = 'bg-white text-gray-600 border-gray-400';
                                            return (
                                                <button
                                                    key={theme}
                                                    type="button"
                                                    disabled={readOnly}
                                                    className={`${base} ${active ? 'text-black border-black' : inactiveStyle} ${cursor}`}
                                                    style={active ? { backgroundColor: color } : undefined}
                                                    onClick={() => !readOnly && onChange(toggleTheme(selected, cat, theme, catalog))}
                                                >
                                                    {theme}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Panel desktop uniquement - partagé, traverse toute la rangée */}
                {openCategory && (() => {
                    const cat = openCategory;
                    const themes = catalog[cat];
                    if (!themes) return null;
                    const color = getCategoryColor(cat);
                    const description = categoryDescriptions[cat] ?? '';
                    return (
                        <div className="hidden md:block animate-menu-open absolute left-0 right-0 top-full mt-1.5 z-30 border-2 border-black rounded-lg bg-white shadow-[4px_4px_0_0_rgba(0,0,0,0.2)] max-h-[50vh] overflow-y-auto md:col-span-3">
                            {description && (
                                <div className="px-3 py-2 text-xs italic text-gray-600 border-b-2 border-dashed border-black/20 flex items-center gap-2">
                                    <span className="text-lg" aria-hidden>{categoryIcons[cat] ?? '🎴'}</span>
                                    {description}
                                </div>
                            )}
                            <div className="px-2 py-2 flex flex-wrap gap-1.5">
                                {themes.map(theme => {
                                    const active = isThemeSelected(selected, cat, theme);
                                    const base = 'text-xs px-2.5 py-1 rounded-full border-2 font-bold transition-colors';
                                    const cursor = readOnly ? 'cursor-default' : 'cursor-pointer hover:scale-105';
                                    const inactiveStyle = 'bg-white text-gray-600 border-gray-400';
                                    return (
                                        <button
                                            key={theme}
                                            type="button"
                                            disabled={readOnly}
                                            className={`${base} ${active ? 'text-black border-black' : inactiveStyle} ${cursor}`}
                                            style={active ? { backgroundColor: color } : undefined}
                                            onClick={() => !readOnly && onChange(toggleTheme(selected, cat, theme, catalog))}
                                        >
                                            {theme}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })()}
            </div>
        </div>
    );
};

export default DeckSelector;
