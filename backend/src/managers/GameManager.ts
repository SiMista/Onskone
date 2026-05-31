import { randomInt } from 'crypto';
import {Game} from "../models/Game.js";
import {
    DEFAULT_LOCALE,
    SUPPORTED_LOCALES,
} from '@onskone/shared';
import type {
    ILobby,
    GameCard,
    DecksCatalog,
    DecksCatalogWithMeta,
    SelectedDecks,
    Locale,
    ThemeInfo,
} from '@onskone/shared';
import * as fsSync from 'fs';
import * as path from 'path';
import logger from '../utils/logger';

// Forme du JSON produit par build-questions.mjs : { [category]: { [theme]: { description, subjects: [{subject, questions}] } } }
type QuestionsFile = Record<string, Record<string, { description: string; subjects: { subject: string; questions: string[] }[] }>>;

// Forme de themes.json : { [code]: { category, emoji, labels: {fr,en}, descriptions: {fr,en} } }
type ThemesMeta = Record<string, {
    category: string;
    emoji: string;
    labels: Record<Locale, string>;
    descriptions: Record<Locale, string>;
}>;

interface LocalePool {
    pool: GameCard[];
    catalog: DecksCatalog;
    catalogWithMeta: DecksCatalogWithMeta;
    /** Code stable -> nom localisé du thème (pour mapper une sélection vers les cartes du pool). */
    labelByCode: Record<string, string>;
    /** Nom localisé du thème -> code stable (pour mapper une carte vers son code). */
    codeByLabel: Record<string, string>;
}

const empty = (): LocalePool => ({
    pool: [],
    catalog: {},
    catalogWithMeta: {},
    labelByCode: {},
    codeByLabel: {},
});

const pools: Record<Locale, LocalePool> = Object.fromEntries(
    SUPPORTED_LOCALES.map(l => [l, empty()]),
) as Record<Locale, LocalePool>;

/**
 * Charge themes.json - source de vérité pour les métadonnées de thèmes
 * (code stable, emoji, libellés et descriptions par langue).
 */
const loadThemesMeta = (): ThemesMeta => {
    const file = path.join(process.cwd(), 'src/data/themes.json');
    try {
        return JSON.parse(fsSync.readFileSync(file, 'utf-8')) as ThemesMeta;
    } catch (error) {
        logger.error('Failed to load themes.json', { error: String(error) });
        return {};
    }
};

const THEMES_META: ThemesMeta = loadThemesMeta();

const loadOne = (locale: Locale): boolean => {
    const file = path.join(process.cwd(), `src/data/questions_${locale}.json`);
    try {
        const raw = fsSync.readFileSync(file, 'utf-8');
        const data = JSON.parse(raw) as QuestionsFile;
        const p: LocalePool = empty();

        // Construire les index code <-> label pour cette langue.
        for (const [code, meta] of Object.entries(THEMES_META)) {
            const label = meta.labels[locale];
            if (!label) {
                logger.warn('Theme missing label for locale', { code, locale });
                continue;
            }
            p.labelByCode[code] = label;
            p.codeByLabel[label] = code;
        }

        // Construire catalog + catalogWithMeta dans l'ordre de themes.json,
        // groupés par catégorie (ICEBREAKERS / FUN / DEEP - ordre du fichier).
        for (const [code, meta] of Object.entries(THEMES_META)) {
            const cat = meta.category;
            const label = meta.labels[locale];
            if (!label) continue;
            if (!p.catalog[cat]) p.catalog[cat] = [];
            if (!p.catalogWithMeta[cat]) p.catalogWithMeta[cat] = [];
            const info: ThemeInfo = {
                code,
                name: label,
                description: meta.descriptions[locale] ?? '',
                emoji: meta.emoji,
            };
            p.catalog[cat].push(code);
            p.catalogWithMeta[cat].push(info);
        }

        // Construire le pool de cartes depuis questions_<locale>.json.
        // `card.theme` = libellé localisé (utilisé pour l'affichage dans la
        // QuestionCard côté front). Le mapping vers le code stable se fait
        // via `codeByLabel` au moment du filtrage par sélection.
        for (const [category, themes] of Object.entries(data)) {
            for (const [theme, themeData] of Object.entries(themes)) {
                if (!p.codeByLabel[theme]) {
                    logger.warn('Theme in questions JSON not found in themes.json', { locale, category, theme });
                }
                for (const entry of themeData.subjects) {
                    p.pool.push({
                        category,
                        theme,
                        subject: entry.subject,
                        questions: entry.questions,
                    });
                }
            }
        }
        pools[locale] = p;
        logger.info('Game cards loaded', { locale, count: p.pool.length });
        return true;
    } catch (error) {
        logger.error('Error loading game cards', { locale, error: String(error) });
        pools[locale] = empty();
        return false;
    }
};

for (const l of SUPPORTED_LOCALES) loadOne(l);

const isLoaded = (locale: Locale) => pools[locale].pool.length > 0;
const lobbyLocale = (lobby: ILobby): Locale => (SUPPORTED_LOCALES as readonly string[]).includes(lobby.locale) ? lobby.locale : DEFAULT_LOCALE;

export const getDecksCatalog = (locale: Locale = DEFAULT_LOCALE): DecksCatalog => pools[locale].catalog;
export const getDecksCatalogWithMeta = (locale: Locale = DEFAULT_LOCALE): DecksCatalogWithMeta => pools[locale].catalogWithMeta;

export const getDefaultSelectedDecks = (locale: Locale = DEFAULT_LOCALE): SelectedDecks => {
    const selected: SelectedDecks = {};
    for (const [category, codes] of Object.entries(pools[locale].catalog)) {
        selected[category] = [...codes];
    }
    return selected;
};

/**
 * Filtre une sélection en supprimant les catégories/codes inconnus du catalogue.
 * Travaille en codes stables (indépendants de la langue).
 */
export const sanitizeSelectedDecks = (selected: SelectedDecks, locale: Locale = DEFAULT_LOCALE): SelectedDecks => {
    const clean: SelectedDecks = {};
    for (const [category, codes] of Object.entries(pools[locale].catalog)) {
        const requested = selected[category];
        if (!Array.isArray(requested)) {
            clean[category] = [];
            continue;
        }
        clean[category] = requested.filter(c => codes.includes(c));
    }
    return clean;
};

/**
 * Filtre le pool de cartes en gardant uniquement celles dont le thème
 * correspond à un code stable sélectionné. Le mapping label -> code se fait
 * via l'index de la langue du lobby.
 */
const filterPoolBySelection = (pool: GameCard[], selected: SelectedDecks, locale: Locale): GameCard[] => {
    const codeByLabel = pools[locale].codeByLabel;
    return pool.filter(card => {
        const code = codeByLabel[card.theme];
        if (!code) return false;
        const codes = selected[card.category];
        return Array.isArray(codes) && codes.includes(code);
    });
};

export const createGame = (lobby: ILobby): Game => {
    const locale = lobbyLocale(lobby);
    const { pool } = pools[locale];
    if (!isLoaded(locale) || pool.length === 0) {
        throw new Error('Game cards not loaded');
    }
    const filtered = filterPoolBySelection(pool, lobby.selectedDecks, locale);
    if (filtered.length === 0) {
        throw new Error('Aucun deck sélectionné');
    }
    const game = new Game(lobby, filtered);
    game.start();
    return game;
};

export const getRandomQuestions = (
    count: number,
    excludeCards: GameCard[] = [],
    pool?: GameCard[],
    locale: Locale = DEFAULT_LOCALE,
): GameCard[] => {
    const sourcePool = pool ?? pools[locale].pool;
    if (sourcePool.length === 0) {
        return [];
    }

    // Filtrer les cartes déjà vues (Set de signatures pour O(1) lookup)
    let availableCards = sourcePool;
    if (excludeCards.length > 0) {
        const cardSignature = (c: GameCard) => `${c.theme}|${c.subject}|${c.questions.join('§')}`;
        const excludedSignatures = new Set(excludeCards.map(cardSignature));
        availableCards = sourcePool.filter(card => !excludedSignatures.has(cardSignature(card)));
    }

    // Si toutes les cartes ont été vues, reset et utiliser tout le pool
    if (availableCards.length === 0) {
        availableCards = sourcePool;
    }

    // Créer une copie pour ne pas modifier le tableau filtré
    const poolCopy = [...availableCards];
    const selectedQuestions: GameCard[] = [];

    // Sélectionner 'count' questions aléatoires
    for (let i = 0; i < Math.min(count, poolCopy.length); i++) {
        const randomIndex = randomInt(0, poolCopy.length);
        selectedQuestions.push(poolCopy[randomIndex]);
        poolCopy.splice(randomIndex, 1); // Éviter les doublons dans la sélection
    }

    return selectedQuestions;
};

/**
 * Check if questions are loaded for at least one locale.
 */
export const isQuestionsLoaded = (): boolean => SUPPORTED_LOCALES.some(isLoaded);

/**
 * Get the number of available questions (all locales combined).
 */
export const getQuestionsCount = (): number =>
    SUPPORTED_LOCALES.reduce((acc, l) => acc + pools[l].pool.length, 0);
