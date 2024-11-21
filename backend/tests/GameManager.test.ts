import { GameManager } from "../src/managers/GameManager";
import { describe, it, expect, beforeEach } from '@jest/globals';

describe('GameManager', () => {
    let gameManager: GameManager;

    beforeEach(() => {
        gameManager = new GameManager('./src/data/questions.json'); // Assure le chemin correct
    });

    it('should load questions from file into questionsPool', () => {
        const questionsPool = gameManager.getQuestionsPool();
        expect(questionsPool).toBeDefined();
    });

    it('should all category have exactly 3 questions', () => {
        const questionsPool = gameManager.getQuestionsPool();
        Object.keys(questionsPool).forEach((category) => {
            expect(questionsPool[category].length).toBe(3);
        });
    });

    it('should get random category and questions', () => {
        const [category, questions] = gameManager.getRandomCategoryAndQuestions();
        expect(category).toBeDefined();
        expect(questions).toBeDefined();
    });
});
