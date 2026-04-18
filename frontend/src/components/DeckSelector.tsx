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
    ICEBREAKERS: 'Briser la glace',
    FUN: 'Amuse-toi entre amis',
    DEEP: 'Pour des conversations profondes',
};

const DeckSelector: React.FC<Props> = ({ catalog, selected, readOnly, hostName, onChange }) => {
    const [openCategory, setOpenCategory] = useState<string | null>(null);
    const categories = useMemo(() => Object.keys(catalog), [catalog]);

    const totalSelected = useMemo(
        () => Object.values(selected).reduce((acc, arr) => acc + arr.length, 0),
        [selected]
    );

    if (categories.length === 0) {
        return (
            <div className="text-center text-sm text-gray-500 italic py-2">
                Chargement des paquets…
            </div>
        );
    }

    if (readOnly) {
        return (
            <div className="text-center text-sm text-gray-600 italic py-3 px-2 border-2 border-black rounded-lg bg-white/80">
                Seul {hostName} peut choisir les thèmes.
                <div className="text-xs text-gray-500 mt-1 not-italic">
                    {totalSelected} thème{totalSelected > 1 ? 's' : ''} sélectionné{totalSelected > 1 ? 's' : ''}
                </div>
            </div>
        );
    }

    const toggleExpand = (cat: string) => {
        setOpenCategory(prev => (prev === cat ? null : cat));
    };

    return (
        <div className="w-full flex flex-col gap-2">
            {/* Barre globale */}
            <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-gray-500">
                    {totalSelected} thème{totalSelected > 1 ? 's' : ''} sélectionné{totalSelected > 1 ? 's' : ''}
                </span>
                <div className="flex gap-1">
                    <button
                        type="button"
                        className="text-xs px-2 py-1 rounded border-2 border-black bg-white hover:bg-gray-100 font-bold"
                        onClick={() => onChange(setAllGlobal(true, catalog))}
                    >
                        Tout
                    </button>
                    <button
                        type="button"
                        className="text-xs px-2 py-1 rounded border-2 border-black bg-white hover:bg-gray-100 font-bold"
                        onClick={() => onChange(setAllGlobal(false, catalog))}
                    >
                        Aucun
                    </button>
                </div>
            </div>

            {/* Liste des catégories */}
            <div className="flex flex-col gap-1.5">
                {categories.map(cat => {
                    const themes = catalog[cat];
                    const selectedInCat = (selected[cat] || []).length;
                    const isOpen = openCategory === cat;
                    const color = getCategoryColor(cat);
                    const description = categoryDescriptions[cat] ?? '';

                    return (
                        <div key={cat} className="border-2 border-black rounded-lg overflow-hidden w-full bg-white/80">
                            {/* Header */}
                            <div
                                className="flex items-center gap-2 px-2 py-1.5 cursor-pointer select-none transition-opacity hover:opacity-90"
                                style={{ backgroundColor: color }}
                                onClick={() => toggleExpand(cat)}
                            >
                                <BsChevronDown
                                    size={14}
                                    className={`transition-transform duration-200 ${isOpen ? 'rotate-0' : '-rotate-90'}`}
                                />
                                <span className="font-bold text-sm flex-1 truncate text-black">{cat}</span>
                                <span className="text-xs text-black/70 whitespace-nowrap">
                                    {selectedInCat}/{themes.length}
                                </span>
                            </div>

                            {isOpen && (
                                <div className="animate-menu-open">
                                    {/* Première ligne : description + boutons à droite */}
                                    <div
                                        className="flex items-center gap-2 px-2 py-1.5 border-y-2 border-black"
                                        style={{ backgroundColor: color }}
                                    >
                                        <span className="text-xs text-black/80 truncate flex-1">
                                            {description}
                                        </span>
                                        <div className="flex gap-1 flex-shrink-0">
                                            <button
                                                type="button"
                                                className="text-[10px] px-1.5 py-0.5 rounded border border-black bg-white hover:bg-gray-100 font-bold"
                                                onClick={() => onChange(setCategory(selected, cat, true, catalog))}
                                            >
                                                Tout
                                            </button>
                                            <button
                                                type="button"
                                                className="text-[10px] px-1.5 py-0.5 rounded border border-black bg-white hover:bg-gray-100 font-bold"
                                                onClick={() => onChange(setCategory(selected, cat, false, catalog))}
                                            >
                                                Aucun
                                            </button>
                                        </div>
                                    </div>

                                    {/* Pills */}
                                    <div className="px-2 py-2 flex flex-wrap gap-1.5">
                                        {themes.map(theme => {
                                            const active = isThemeSelected(selected, cat, theme);
                                            const base = 'text-xs px-2.5 py-1 rounded-full border-2 font-bold transition-colors';
                                            const cursor = 'cursor-pointer hover:scale-105';
                                            const inactiveStyle = 'bg-white text-gray-600 border-gray-400';
                                            return (
                                                <button
                                                    key={theme}
                                                    type="button"
                                                    className={`${base} ${active ? 'text-black border-black' : inactiveStyle} ${cursor}`}
                                                    style={active ? { backgroundColor: color } : undefined}
                                                    onClick={() => onChange(toggleTheme(selected, cat, theme, catalog))}
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
            </div>
        </div>
    );
};

export default DeckSelector;
