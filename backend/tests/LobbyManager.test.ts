import { describe, it, expect, beforeEach } from '@jest/globals';
import { TestHelper } from '../src/utils/TestHelper';
import { LobbyManager } from "../src/managers/LobbyManager";
import { GameManager } from "../src/managers/GameManager";
import { PlayerManager } from "../src/managers/PlayerManager";
import { Player } from "../src/models/Player";
import { Lobby } from "../src/models/Lobby";

describe('LobbyManager', () => {
    let gameManager: GameManager;
    let lobbyManager: LobbyManager;
    let playerManager: PlayerManager;
    let hostPlayer: Player;

    beforeEach(() => {
        const { gameManager: gm, lobbyManager: lm, playerManager: pm } = TestHelper.createAllManagers();
        gameManager = gm;
        lobbyManager = lm;
        playerManager = pm;
        hostPlayer = TestHelper.createHostPlayer(playerManager);
    });

    it('should create a lobby successfully and generate well lobbyCode', () => {
        const lobbyCode = lobbyManager.createLobby(hostPlayer);
        const lobby = lobbyManager.getLobby(lobbyCode);
        if (lobby) {
            expect(lobby.lobbyCode).toMatch(/^[A-Z0-9]{6}$/);
        } else {
            expect(lobby).toBeDefined();
        }
    });

    it('should throw an error if player is not authorized to create a lobby', () => {
        const player = playerManager.createPlayer('John Doe');
        expect(() => lobbyManager.createLobby(player)).toThrowError('Player is not authorized to create a lobby.');
    });

    it('should return a lobby when getting a lobby', () => {
        const lobbyCode = lobbyManager.createLobby(hostPlayer);
        const lobby = lobbyManager.getLobby(lobbyCode);

        expect(lobby).toBeInstanceOf(Lobby);
    });

    it('should add a player to the lobby', () => {
        const lobbyCode = lobbyManager.createLobby(hostPlayer);
        const player = playerManager.createPlayer('John Doe');
        const lobby = lobbyManager.getLobby(lobbyCode);
        lobbyManager.addPlayerToLobby(lobbyCode, player);

        expect(lobby?.players.length).toBe(2);
        expect(lobby?.players).toContainEqual(player);
    });

    it('should remove the lobby, if the last player leaves', () => {
        const lobbyCode = lobbyManager.createLobby(hostPlayer);
        lobbyManager.removePlayerFromLobby(lobbyCode, hostPlayer);

        expect(lobbyManager.getLobby(lobbyCode)).toBeUndefined();
    });
    
    it('should change the host if the host leaves', () => {
        const lobbyCode = lobbyManager.createLobby(hostPlayer);
        const player = playerManager.createPlayer('John Doe');
        const lobby = lobbyManager.getLobby(lobbyCode);
        lobbyManager.addPlayerToLobby(lobbyCode, player);
        lobbyManager.removePlayerFromLobby(lobbyCode, hostPlayer);

        expect(lobby?.players[0].isHost).toBe(true);
    });

    it('should start a game if not already started', () => {
        const lobby = TestHelper.createLobbyWithPlayers(lobbyManager, playerManager, hostPlayer);
        const startResult = lobbyManager.startGame(lobby.lobbyCode);

        expect(startResult).toBe(true);
        expect(lobby.gameStarted).toBe(true);
    });
    
    it('should return false if there are not enough players to start the game', () => {
        const lobby = TestHelper.createLobbyWithPlayers(lobbyManager, playerManager, hostPlayer, ['Player 2']);
        const startResult = lobbyManager.startGame(lobby.lobbyCode);

        expect(startResult).toBe(false); // Not enough players to start the game
    });

    it('should not start a game if it has already started', () => {
        const lobby = TestHelper.createLobbyWithPlayers(lobbyManager, playerManager, hostPlayer);
        lobbyManager.startGame(lobby.lobbyCode);
        const startResult = lobbyManager.startGame(lobby.lobbyCode); // Try to start again

        expect(startResult).toBe(false); // Should not start again
    });

    it('should return false if lobby does not exist when starting the game', () => {
        const startResult = lobbyManager.startGame('NONEXISTENTCODE');
        expect(startResult).toBe(false); // Lobby does not exist
    });
});
