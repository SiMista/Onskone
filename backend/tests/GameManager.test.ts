import { describe, it, expect, beforeEach } from '@jest/globals';
import { TestHelper } from "../src/utils/TestHelper";
import { Game } from "../src/models/Game";
import { Player } from "../src/models/Player";

describe('GameManager', () => {
    let game: Game;

    beforeEach(() => {
        const { gameManager, lobbyManager, playerManager } = TestHelper.createAllManagers();
        const hostPlayer = TestHelper.createHostPlayer(playerManager);
        const lobby = TestHelper.createLobbyWithPlayers(lobbyManager, playerManager, hostPlayer, ["Player 2", "Player 3"]);
        game = TestHelper.startGame(lobbyManager, gameManager, lobby);
    });

    it('should load questions pool from file', () => {
        const questionsPool = game.getQuestionsPool();
        expect(questionsPool).toBeDefined();
    });

    it('should ensure all categories have exactly 3 questions', () => {
        const questionsPool = game.getQuestionsPool();
        Object.values(questionsPool).forEach((questions) => {
            expect((questions as any[]).length).toBe(3);
        });
    });

    it('should get a valid random category and questions', () => {
        const [category, questions] = game.getRandomCategoryAndQuestions();
        const questionsPool = game.getQuestionsPool();
        expect(category).toBeDefined();
        expect(questions).toBeDefined();
        expect(Object.keys(questionsPool)).toContain(category);
        expect(questionsPool[category]).toEqual(questions);
    });

    it('should start the game and set status to inProgress', () => {
        expect(game.status).toBe('inProgress');
    });

    it('should add a new player to the game', () => {
        const newPlayer = new Player("New Player");
        game.addPlayer(newPlayer);
        expect(game.players).toContainEqual(newPlayer);
    });

    it('should return the game by lobby code', () => {
        expect(game.lobbyCode).toBeDefined();
    });

    it('should handle case where game is not found', () => {
        const { gameManager } = TestHelper.createAllManagers();
        expect(gameManager.getGame("INVALID_CODE")).toBeUndefined();
    });

    it('should advance to the next round and update round number', () => {
        const initialRoundNumber = game.currentRound?.roundNumber || 0;
        game.nextRound();
        expect(game.currentRound?.roundNumber).toBe(initialRoundNumber + 1);
    });

    it('should throw an error if game is not in progress when starting next round', () => {
        game.endGame();
        expect(() => game.nextRound()).toThrow("The game hasn't started or is already finished.");
    });
});
