import { randomInt } from 'crypto';
import {Game} from "../models/Game.js";
import type { ILobby, GameCard, DecksCatalog, SelectedDecks } from '@onskone/shared';
import * as fsSync from 'fs';
import * as path from 'path';
import logger from '../utils/logger';

let questionsPool: GameCard[] = [];
let decksCatalog: DecksCatalog = {};
let isLoaded = false;

/**
 * Load game cards synchronously (fallback/startup)
 */
const loadGameCardsSync = (questionsFilePath: string): void => {
    try {
        const raw = fsSync.readFileSync(questionsFilePath, 'utf-8');
        const data = JSON.parse(raw) as Record<string, Record<string, { subject: string; questions: string[] }[]>>;
        questionsPool = [];
        decksCatalog = {};
        for (const [category, themes] of Object.entries(data)) {
            decksCatalog[category] = [];
            for (const [theme, subjects] of Object.entries(themes)) {
                decksCatalog[category].push(theme);
                for (const entry of subjects) {
                    questionsPool.push({
                        category,
                        theme,
                        subject: entry.subject,
                        questions: entry.questions,
                    });
                }
            }
        }
        isLoaded = true;
        logger.info('Game cards loaded (sync)', { count: questionsPool.length });
    } catch (error) {
        logger.error('Error loading game cards (sync)', { error: String(error) });
        questionsPool = [];
        decksCatalog = {};
    }
};

// Initial load at startup - use sync to ensure questions are available immediately
const questionsPath = path.join(process.cwd(), 'src/data/questions.json');
loadGameCardsSync(questionsPath);

export const getDecksCatalog = (): DecksCatalog => decksCatalog;

export const getDefaultSelectedDecks = (): SelectedDecks => {
    const selected: SelectedDecks = {};
    for (const [category, themes] of Object.entries(decksCatalog)) {
        selected[category] = [...themes];
    }
    return selected;
};

/**
 * Filtre une sélection en supprimant les catégories/thèmes inconnus du catalogue.
 */
export const sanitizeSelectedDecks = (selected: SelectedDecks): SelectedDecks => {
    const clean: SelectedDecks = {};
    for (const [category, themes] of Object.entries(decksCatalog)) {
        const requested = selected[category];
        if (!Array.isArray(requested)) {
            clean[category] = [];
            continue;
        }
        clean[category] = requested.filter(t => themes.includes(t));
    }
    return clean;
};

const filterPoolBySelection = (selected: SelectedDecks): GameCard[] => {
    return questionsPool.filter(card => {
        const themes = selected[card.category];
        return Array.isArray(themes) && themes.includes(card.theme);
    });
};

export const createGame = (lobby: ILobby): Game => {
    if (!isLoaded || questionsPool.length === 0) {
        throw new Error('Game cards not loaded');
    }
    const filtered = filterPoolBySelection(lobby.selectedDecks);
    if (filtered.length === 0) {
        throw new Error('Aucun deck sélectionné');
    }
    const game = new Game(lobby, filtered);
    game.start();
    return game;
};

export const getRandomQuestions = (count: number, excludeCards: GameCard[] = [], pool: GameCard[] = questionsPool): GameCard[] => {
    if (pool.length === 0) {
        return [];
    }

    // Filtrer les cartes déjà vues (Set de signatures pour O(1) lookup)
    let availableCards = pool;
    if (excludeCards.length > 0) {
        const cardSignature = (c: GameCard) => `${c.theme}|${c.subject}|${c.questions.join('§')}`;
        const excludedSignatures = new Set(excludeCards.map(cardSignature));
        availableCards = pool.filter(card => !excludedSignatures.has(cardSignature(card)));
    }

    // Si toutes les cartes ont été vues, reset et utiliser tout le pool
    if (availableCards.length === 0) {
        availableCards = pool;
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
 * Check if questions are loaded
 */
export const isQuestionsLoaded = (): boolean => {
    return isLoaded && questionsPool.length > 0;
};

/**
 * Get the number of available questions
 */
export const getQuestionsCount = (): number => {
    return questionsPool.length;
};
