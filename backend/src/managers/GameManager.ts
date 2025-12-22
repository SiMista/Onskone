import { randomInt } from 'crypto';
import {Game} from "../models/Game.js";
import type { ILobby, GameCard } from '@onskone/shared';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import logger from '../utils/logger';

let questionsPool: GameCard[] = [];
let isLoaded = false;

/**
 * Load game cards asynchronously
 */
export const loadGameCards = async (questionsFilePath: string): Promise<void> => {
    try {
        const questions = await fs.readFile(questionsFilePath, 'utf-8');
        questionsPool = JSON.parse(questions) as GameCard[];
        isLoaded = true;
        logger.info('Game cards loaded (async)', { count: questionsPool.length });
    } catch (error) {
        logger.error('Error loading game cards (async)', { error: String(error) });
        // Fallback to sync load if async fails
        loadGameCardsSync(questionsFilePath);
    }
};

/**
 * Load game cards synchronously (fallback/startup)
 */
const loadGameCardsSync = (questionsFilePath: string): void => {
    try {
        const questions = fsSync.readFileSync(questionsFilePath, 'utf-8');
        questionsPool = JSON.parse(questions) as GameCard[];
        isLoaded = true;
        logger.info('Game cards loaded (sync)', { count: questionsPool.length });
    } catch (error) {
        logger.error('Error loading game cards (sync)', { error: String(error) });
        questionsPool = [];
    }
};

// Initial load at startup - use sync to ensure questions are available immediately
const questionsPath = path.join(process.cwd(), 'src/data/questions.json');
loadGameCardsSync(questionsPath);

export const createGame = (lobby: ILobby): Game => {
    if (!isLoaded || questionsPool.length === 0) {
        throw new Error('Game cards not loaded');
    }
    const game = new Game(lobby, questionsPool);
    game.start();
    return game;
};

/**
 * Compare deux GameCards pour vérifier si elles sont identiques
 * (basé sur la catégorie et les questions)
 */
const areCardsEqual = (card1: GameCard, card2: GameCard): boolean => {
    if (card1.category !== card2.category) return false;
    if (card1.questions.length !== card2.questions.length) return false;
    return card1.questions.every((q, i) => q === card2.questions[i]);
};

export const getRandomQuestions = (count: number, excludeCards: GameCard[] = []): GameCard[] => {
    if (questionsPool.length === 0) {
        return [];
    }

    // Filtrer les cartes déjà vues
    let availableCards = questionsPool;
    if (excludeCards.length > 0) {
        availableCards = questionsPool.filter(card =>
            !excludeCards.some(excluded => areCardsEqual(card, excluded))
        );
    }

    // Si toutes les cartes ont été vues, reset et utiliser tout le pool
    if (availableCards.length === 0) {
        availableCards = questionsPool;
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
