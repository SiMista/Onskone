// __tests__/LobbyManager.test.ts
import { LobbyManager } from "../src/managers/LobbyManager";
import { GameManager } from "../src/managers/GameManager";
import { Player } from "../src/models/Player";
import { Lobby } from "../src/models/Lobby";
import { describe, it, expect, beforeEach } from '@jest/globals';

describe('LobbyManager', () => {
    let gameManager: GameManager;
    let lobbyManager: LobbyManager;

    beforeEach(() => {
        gameManager = new GameManager('./src/data/questions.json');
        lobbyManager = new LobbyManager(gameManager);
    });

    it('should create a lobby successfully and generate well lobbyCode', () => {
        const lobbyCode = lobbyManager.createLobby();
        const lobby = lobbyManager.getLobby(lobbyCode);
        if (lobby) {
            expect(lobby.lobbyCode).toMatch(/^[A-Z0-9]{6}$/);
        } else {
            expect(lobby).toBeDefined();
        }
    });

    it('should return a lobby when getting a lobby', () => {
        const lobbyCode = lobbyManager.createLobby();
        const lobby = lobbyManager.getLobby(lobbyCode);

        expect(lobby).toBeInstanceOf(Lobby);
    });

    it('should add a player to the lobby', () => {
        const player = new Player('John Doe');
        const lobbyCode = lobbyManager.createLobby();
        const lobby = lobbyManager.getLobby(lobbyCode);
        lobbyManager.addPlayerToLobby(lobbyCode, player);

        expect(lobby?.players.length).toBe(1);
        expect(lobby?.players[0].name).toBe('John Doe');
    });

    it('should remove a player from the lobby', () => {
        const player = new Player('John Doe');
        const lobbyCode = lobbyManager.createLobby();
        lobbyManager.addPlayerToLobby(lobbyCode, player);
        lobbyManager.removePlayerFromLobby(lobbyCode, player);
        const lobby = lobbyManager.getLobby(lobbyCode);

        expect(lobby?.players.length).toBe(0);
    });

    it('should start a game if not already started', () => {
        const player1 = new Player('John Doe');
        const player2 = new Player('Mark Henry');
        const player3 = new Player('Cena John');
        const lobbyCode = lobbyManager.createLobby();
        lobbyManager.addPlayerToLobby(lobbyCode, player1);
        lobbyManager.addPlayerToLobby(lobbyCode, player2);
        lobbyManager.addPlayerToLobby(lobbyCode, player3);

        const startResult = lobbyManager.startGame(lobbyCode);
        const lobby = lobbyManager.getLobby(lobbyCode);
        expect(startResult).toBe(true);
        expect(lobby?.gameStarted).toBe(true);
    });

    
    it('should return false if there are not enough players to start the game', () => {
        const player = new Player('John Doe');
        const player2 = new Player('Mark Henry');
        const lobbyCode = lobbyManager.createLobby();
        lobbyManager.addPlayerToLobby(lobbyCode, player);
        const startResult = lobbyManager.startGame(lobbyCode);

        expect(startResult).toBe(false); // Not enough players to start the game
    });

    it('should not start a game if it has already started', () => {
        const player1 = new Player('John Doe');
        const player2 = new Player('Mark Henry');
        const player3 = new Player('Cena John');
        const lobbyCode = lobbyManager.createLobby();
        lobbyManager.addPlayerToLobby(lobbyCode, player1);
        lobbyManager.addPlayerToLobby(lobbyCode, player2);
        lobbyManager.addPlayerToLobby(lobbyCode, player3);
        lobbyManager.startGame(lobbyCode); // First start
        const startResult = lobbyManager.startGame(lobbyCode); // Try to start again

        expect(startResult).toBe(false); // Should not start again
    });

    it('should return false if lobby does not exist when starting the game', () => {
        const startResult = lobbyManager.startGame('NONEXISTENTCODE');
        expect(startResult).toBe(false); // Lobby does not exist
    });
});
