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

export const getRandomQuestions = (count: number): GameCard[] => {
    if (questionsPool.length === 0) {
        return [];
    }

    // Créer une copie du pool pour ne pas modifier l'original
    const poolCopy = [...questionsPool];
    const selectedQuestions: GameCard[] = [];

    // Sélectionner 'count' questions aléatoires
    for (let i = 0; i < Math.min(count, poolCopy.length); i++) {
        const randomIndex = Math.floor(Math.random() * poolCopy.length);
        selectedQuestions.push(poolCopy[randomIndex]);
        poolCopy.splice(randomIndex, 1); // Éviter les doublons
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
