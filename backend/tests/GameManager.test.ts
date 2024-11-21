import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { GameManager } from "../src/managers/GameManager"; 
import { LobbyManager } from "../src/managers/LobbyManager";
import { Game } from "../src/models/Game";
import { Player } from "../src/models/Player";

describe('GameManager', () => {
    let gameManager: GameManager;
    let lobbyManager: LobbyManager;
    let lobbyCode: string;
    let game: Game;

    beforeEach(() => {
        gameManager = new GameManager('./src/data/questions.json'); // Assurez-vous que le chemin est correct
        lobbyManager = new LobbyManager(gameManager);
        lobbyCode = lobbyManager.createLobby();
        const player1 = new Player('John Doe');
        const player2 = new Player('Mark Henry');
        const player3 = new Player('Cena John');
        lobbyManager.addPlayerToLobby(lobbyCode, player1);
        lobbyManager.addPlayerToLobby(lobbyCode, player2);
        lobbyManager.addPlayerToLobby(lobbyCode, player3);
        lobbyManager.startGame(lobbyCode);
        const gameResult = gameManager.getGame(lobbyCode);
        if (!gameResult) {
            throw new Error('Game not found');
        }
        game = gameResult;
    });

    it('should load questions pool from file', () => {
        const questionsPool = game.getQuestionsPool();
        expect(questionsPool).toBeDefined();
    });

    it('should ensure all categories have exactly 3 questions', () => {
        const questionsPool = game.getQuestionsPool();
        Object.keys(questionsPool).forEach((category) => {
            expect(questionsPool[category].length).toBe(3);
        });
    });

    it('should get a valid random category and questions', () => {
        const questionsPool = game.getQuestionsPool();
        const [category, questions] = game.getRandomCategoryAndQuestions();
        expect(category).toBeDefined();
        expect(questions).toBeDefined();
        expect(Object.keys(questionsPool)).toContain(category); // La catégorie doit exister
        expect(questionsPool[category]).toEqual(questions); // Les questions doivent correspondre
    });

    it('should start the game and set status to inProgress', () => {
        expect(game.status).toBe('inProgress');
    });

    it('should add players to the game', () => {
        const player = new Player('John Doe');
        game.addPlayer(player);
        expect(game.players.length).toBe(4);
        expect(game.players[3].name).toBe('John Doe');
    });

    it('should get the game by lobby code', () => {
        const fetchedGame = gameManager.getGame(lobbyCode);
        expect(fetchedGame).toBeDefined();
        expect(fetchedGame?.lobbyCode).toBe(lobbyCode);
    });

    it('should handle case where game is not found', () => {
        const invalidLobbyCode = 'INVALID_CODE';
        const fetchedGame = gameManager.getGame(invalidLobbyCode);
        expect(fetchedGame).toBeUndefined();
    });

    // it('should start next round and update round number', () => {
    //     const initialRound = game.currentRound;
    //     game.nextRound();
    //     expect(game.currentRound).toBeDefined();
    //     expect(game.currentRound?.roundNumber).toBe(initialRound ? initialRound.roundNumber + 1 : 1);
    // });

    // it('should throw an error if game is not in progress when starting next round', () => {
    //     game.endGame();
    //     expect(() => game.nextRound()).toThrow("The game hasn't started or is already finished.");
    // });

    // it('should start next round and update round number', () => {
    //     const initialRound = game.currentRound;
    //     game.nextRound();
    //     expect(game.currentRound).toBeDefined();
    //     expect(game.currentRound?.roundNumber).toBe(initialRound ? initialRound.roundNumber + 1 : 1);
    // });

    // it('should throw an error if game is not in progress when starting next round', () => {
    //     game.endGame();
    //     expect(() => game.nextRound()).toThrow("The game hasn't started or is already finished.");
    // });
});