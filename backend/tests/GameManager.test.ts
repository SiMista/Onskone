import { describe, it, expect } from '@jest/globals';
import * as GameManager from "../src/managers/GameManager";
import * as QuestionsRepo from "../src/data/questionsRepository";
import { TestHelper } from "../src/utils/TestHelper";

describe('GameManager', () => {
    it('should have questions loaded', () => {
        expect(QuestionsRepo.isQuestionsLoaded()).toBe(true);
    });

    it('should get random questions', () => {
        const questions = QuestionsRepo.getRandomQuestions(3);
        expect(questions.length).toBe(3);
    });

    it('should create a game with a lobby', () => {
        const lobby = TestHelper.createLobbyWithPlayers(['Player 1', 'Player 2']);
        const game = GameManager.createGame(lobby);

        expect(game).toBeDefined();
        expect(game.lobby.code).toBe(lobby.code);
    });
});
