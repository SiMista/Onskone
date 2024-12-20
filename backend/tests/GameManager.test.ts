import { describe, it, expect, beforeEach } from '@jest/globals';
import { GameManager } from "../src/managers/GameManager";
import { TestHelper } from "../src/utils/TestHelper";
import { Game } from "../src/models/Game";
// import { PlayerManager } from "../src/managers/PlayerManager";

describe('GameManager', () => {
    let game: Game;

    // beforeEach(() => {
    //     const lobby = TestHelper.createLobbyWithPlayers(["Player 1", "Player 3"]);
    //     game = GameManager.createGame(lobby);
    // });
    //
    // it('should load questions pool from file', () => {
    //     const questionsPool = game.getQuestionsPool();
    //     expect(questionsPool).toBeDefined();
    //     expect(Object.keys(questionsPool).length).toBeGreaterThan(0);
    // });
    //
    // it('should ensure all categories have exactly 3 questions', () => {
    //     const questionsPool = game.getQuestionsPool();
    //     Object.values(questionsPool).forEach((questions) => {
    //         expect(questions.length).toBe(3);
    //     });
    // });
    //
    // it('should get a valid random category and questions', () => {
    //     const [category, questions] = game.getRandomCategoryAndQuestions();
    //     const questionsPool = game.getQuestionsPool();
    //
    //     expect(category).toBeDefined();
    //     expect(questions).toBeDefined();
    //     expect(Object.keys(questionsPool)).toContain(category);
    //     expect(questionsPool[category]).toEqual(questions);
    // });
    //
    // it('should start the game and set status to inProgress', () => {
    //     expect(game.status).toBe('inProgress');
    // });
    //
    // it('should add a new player to the game', () => {
    //     const newPlayer = PlayerManager.createPlayer("New Player");
    //     game.addPlayer(newPlayer);
    //     console.log(game.players);
    //
    //     expect(game.players).toContainEqual(newPlayer);
    //     expect(game.players.length).toBe(4);
    // });
    //
    // it('should return the game by lobby code', () => {
    //     const retrievedGame = GameManager.getGame(game.lobbyCode);
    //
    //     expect(retrievedGame).toBe(game);
    // });
    //
    // it('should handle case where game is not found', () => {
    //     const retrievedGame = GameManager.getGame("INVALID_CODE");
    //
    //     expect(retrievedGame).toBeUndefined();
    // });
    //
    // it('should advance to the next round and update round number', () => {
    //     const initialRoundNumber = game.currentRound?.roundNumber || 0;
    //     game.nextRound();
    //
    //     expect(game.currentRound?.roundNumber).toBe(initialRoundNumber + 1);
    // });
    //
    // it('should throw an error if game is not in progress when starting next round', () => {
    //     game.endGame();
    //
    //     expect(() => game.nextRound()).toThrow("The game hasn't started or is already finished.");
    // });
    //
    // it('should end the game and update its status', () => {
    //     game.endGame();
    //
    //     expect(game.status).toBe('finished');
    // });
});
