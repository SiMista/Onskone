import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { TestHelper } from '../src/utils/TestHelper';
import { LobbyManager } from "../src/managers/LobbyManager";
import { Lobby } from "../src/models/Lobby";
import {Player} from "../src/models/Player";
import {GameStatus} from "../src/models/Game";

describe('LobbyManager', () => {
    beforeEach(() => {
        jest.clearAllMocks(); // Nettoyer l'état entre les tests
    });

    it('should create a lobby successfully and generate a valid lobbyCode', () => {
        const hostPlayer = new Player('Host', true);
        const lobbyCode = LobbyManager.create(hostPlayer);

        expect(lobbyCode).toMatch(/^[A-Z0-9]{6}$/);
    });

    it('should throw an error if a non-host player tries to create a lobby', () => {
        const nonHostPlayer = new Player('Non-Host', false);
        expect(() => LobbyManager.create(nonHostPlayer)).toThrowError('Player is not authorized to create a lobby.');
    });

    it('should return a lobby when getting a lobby', () => {
        const hostPlayer = new Player('Host', true);
        const lobbyCode = LobbyManager.create(hostPlayer);
        const lobby = LobbyManager.getLobby(lobbyCode);

        expect(lobby).toBeInstanceOf(Lobby);
        expect(lobby?.code).toBe(lobbyCode);
    });

    it('should add a player to the lobby', () => {
        const lobby = TestHelper.createLobbyWithPlayers();
        const player = new Player('Player 3');
        LobbyManager.addPlayer(lobby, player);

        expect(lobby.players).toContainEqual(player);
        expect(lobby.players.length).toBe(2);
    });

    it('should remove the lobby if the last player leaves', () => {
        const lobby = TestHelper.createLobbyWithPlayers();
        LobbyManager.removePlayer(lobby, lobby.players[0]);

        expect(LobbyManager.getLobby(lobby.code)).toBeUndefined();
    });

    it('should change the host if the current host leaves', () => {
        const lobby = TestHelper.createLobbyWithPlayers(['Player 1', 'Player 2']);
        const originalHost = lobby.players[0];
        LobbyManager.removePlayer(lobby, originalHost);

        expect(lobby.players[0].isHost).toBe(true);
    });

    it('should start a game if there are enough players', () => {
        const lobby = TestHelper.createLobbyWithPlayers(['Player 2', 'Player 3']);
        const startResult = LobbyManager.startGame(lobby);

        expect(startResult).toBe(true);
        expect(lobby.game.status).toBe(GameStatus.IN_PROGRESS);
    });

    it('should return false if there are not enough players to start a game', () => {
        const lobby = TestHelper.createLobbyWithPlayers(['Player 2']);
        const startResult = LobbyManager.startGame(lobby);

        expect(startResult).toBe(false);
    });

    it('should return false if trying to start a game that already started', () => {
        const lobby = TestHelper.createLobbyWithPlayers(['Player 2', 'Player 3']);
        LobbyManager.startGame(lobby); // Start once
        const startResult = LobbyManager.startGame(lobby); // Try to start again

        expect(startResult).toBe(false);
    });
});
