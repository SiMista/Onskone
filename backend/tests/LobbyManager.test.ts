import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { TestHelper } from '../src/utils/TestHelper';
import * as LobbyManager from "../src/managers/LobbyManager";
import { Lobby } from "../src/models/Lobby";
import { Player } from "../src/models/Player";

describe('LobbyManager', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should create a lobby successfully and generate a valid lobbyCode', () => {
        const lobbyCode = LobbyManager.create();
        expect(lobbyCode).toMatch(/^[A-Z0-9]{6}$/);
    });

    it('should return a lobby when getting a lobby', () => {
        const lobbyCode = LobbyManager.create();
        const lobby = LobbyManager.getLobby(lobbyCode);

        expect(lobby).toBeInstanceOf(Lobby);
        expect(lobby?.code).toBe(lobbyCode);
    });

    it('should add a player to the lobby', () => {
        const lobby = TestHelper.createLobbyWithPlayers();
        const player = new Player('Player 3', 'socket-3');
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
});
