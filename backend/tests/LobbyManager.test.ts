// __tests__/LobbyManager.test.ts
import { LobbyManager } from "../src/managers/LobbyManager";
import { GameManager } from "../src/managers/GameManager";
import { Player } from "../src/models/Player";
import { Lobby } from "../src/models/Lobby";

// Mocking generateLobbyCode function
jest.mock('../src/utils/helpers', () => ({
    generateLobbyCode: jest.fn(() => 'TESTCODE123')
}));

describe('LobbyManager', () => {
    let gameManager: GameManager;
    let lobbyManager: LobbyManager;

    beforeEach(() => {
        gameManager = new GameManager();
        lobbyManager = new LobbyManager(gameManager);
    });

    it('should create a lobby successfully', () => {
        lobbyManager.createLobby();
        const lobby = lobbyManager['lobbies'].get('TESTCODE123'); // Accès à la Map privée
        expect(lobby).toBeDefined();
        expect(lobby?.lobbyCode).toBe('TESTCODE123');
    });

    it('should add a player to the lobby', () => {
        const player = new Player('player1', 'Player 1');
        lobbyManager.createLobby();
        lobbyManager.addPlayerToLobby('TESTCODE123', player);
        
        const lobby = lobbyManager['lobbies'].get('TESTCODE123');
        expect(lobby?.players.length).toBe(1);
        expect(lobby?.players[0].id).toBe('player1');
    });

    it('should remove a player from the lobby', () => {
        const player = new Player('player1', 'Player 1');
        lobbyManager.createLobby();
        lobbyManager.addPlayerToLobby('TESTCODE123', player);
        lobbyManager.removePlayerFromLobby('TESTCODE123', 'player1');
        
        const lobby = lobbyManager['lobbies'].get('TESTCODE123');
        expect(lobby?.players.length).toBe(0);
    });

    it('should start a game if not already started', () => {
        const player = new Player('player1', 'Player 1');
        lobbyManager.createLobby();
        lobbyManager.addPlayerToLobby('TESTCODE123', player);

        const startResult = lobbyManager.startGame('TESTCODE123');
        const lobby = lobbyManager['lobbies'].get('TESTCODE123');
        expect(startResult).toBe(true);
        expect(lobby?.gameStarted).toBe(true);
    });

    it('should not start a game if it has already started', () => {
        const player = new Player('player1', 'Player 1');
        lobbyManager.createLobby();
        lobbyManager.addPlayerToLobby('TESTCODE123', player);
        lobbyManager.startGame('TESTCODE123'); // First start
        const startResult = lobbyManager.startGame('TESTCODE123'); // Try to start again

        expect(startResult).toBe(false); // Should not start again
    });

    it('should return false if lobby does not exist when starting the game', () => {
        const startResult = lobbyManager.startGame('NONEXISTENTCODE');
        expect(startResult).toBe(false); // Lobby does not exist
    });
});
