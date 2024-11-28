import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { TestHelper } from '../src/utils/TestHelper';
import { LobbyManager } from "../src/managers/LobbyManager";
import { PlayerManager } from "../src/managers/PlayerManager";
import { Lobby } from "../src/models/Lobby";

describe('LobbyManager', () => {
    beforeEach(() => {
        jest.clearAllMocks(); // Nettoyer l'état entre les tests
    });

    it('should create a lobby successfully and generate a valid lobbyCode', () => {
        const hostPlayer = PlayerManager.createHostPlayer('Host')
        const lobbyCode = LobbyManager.createLobby(hostPlayer);

        expect(lobbyCode).toMatch(/^[A-Z0-9]{6}$/);
    });

    it('should throw an error if a non-host player tries to create a lobby', () => {
        const nonHostPlayer = PlayerManager.createPlayer('NonHost');
        expect(() => LobbyManager.createLobby(nonHostPlayer)).toThrowError('Player is not authorized to create a lobby.');
    });

    it('should return a lobby when getting a lobby', () => {
        const hostPlayer = PlayerManager.createHostPlayer('Host');
        const lobbyCode = LobbyManager.createLobby(hostPlayer);
        const lobby = LobbyManager.getLobby(lobbyCode);

        expect(lobby).toBeInstanceOf(Lobby);
        expect(lobby?.lobbyCode).toBe(lobbyCode);
    });

    it('should add a player to the lobby', () => {
        const lobby = TestHelper.createLobbyWithPlayers();
        const player = PlayerManager.createPlayer('Player 2');
        LobbyManager.addPlayerToLobby(lobby.lobbyCode, player);

        expect(lobby.players).toContainEqual(player);
        expect(lobby.players.length).toBe(2);
    });

    it('should remove the lobby if the last player leaves', () => {
        const lobby = TestHelper.createLobbyWithPlayers();
        LobbyManager.removePlayerFromLobby(lobby.lobbyCode, lobby.players[0]);

        expect(LobbyManager.getLobby(lobby.lobbyCode)).toBeUndefined();
    });

    it('should change the host if the current host leaves', () => {
        const lobby = TestHelper.createLobbyWithPlayers(['Player 1', 'Player 2']);
        const originalHost = lobby.players[0];
        LobbyManager.removePlayerFromLobby(lobby.lobbyCode, originalHost);

        expect(lobby.players[0].isHost).toBe(true);
    });

    it('should start a game if there are enough players', () => {
        const lobby = TestHelper.createLobbyWithPlayers(['Player 2', 'Player 3']);
        const startResult = LobbyManager.startGame(lobby.lobbyCode);

        expect(startResult).toBe(true);
        expect(lobby.gameStarted).toBe(true);
    });

    it('should return false if there are not enough players to start a game', () => {
        const lobby = TestHelper.createLobbyWithPlayers(['Player 2']);
        const startResult = LobbyManager.startGame(lobby.lobbyCode);

        expect(startResult).toBe(false);
    });

    it('should return false if trying to start a game that already started', () => {
        const lobby = TestHelper.createLobbyWithPlayers(['Player 2', 'Player 3']);
        LobbyManager.startGame(lobby.lobbyCode); // Start once
        const startResult = LobbyManager.startGame(lobby.lobbyCode); // Try to start again

        expect(startResult).toBe(false);
    });

    it('should return false if trying to start a game for a non-existent lobby', () => {
        const startResult = LobbyManager.startGame('INVALID_CODE');
        expect(startResult).toBe(false);
    });
});
