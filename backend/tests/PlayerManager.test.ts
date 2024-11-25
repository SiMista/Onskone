import { describe, it, expect, beforeEach } from '@jest/globals';
import { PlayerManager } from '../src/managers/PlayerManager';
import { Player } from '../src/models/Player';

describe('PlayerManager', () => {
    let playerManager: PlayerManager;

    beforeEach(() => {
        playerManager = new PlayerManager();
    });

    it('should create a standard player with the correct attributes', () => {
        const playerName = 'John Doe';
        const player = playerManager.createPlayer(playerName);

        expect(player).toBeInstanceOf(Player);
        expect(player.name).toBe(playerName);
        expect(player.isHost).toBe(false);
        expect(player.id).toBeDefined();
    });

    it('should create a host player with the correct attributes', () => {
        const hostName = 'Jane Host';
        const hostPlayer = playerManager.createHostPlayer(hostName);

        expect(hostPlayer).toBeInstanceOf(Player);
        expect(hostPlayer.name).toBe(hostName);
        expect(hostPlayer.isHost).toBe(true);
        expect(hostPlayer.id).toBeDefined();
    });

    it('should store players in the internal map', () => {
        const player1 = playerManager.createPlayer('Player 1');
        const player2 = playerManager.createHostPlayer('Host Player');

        const players = (playerManager as any).players; // Accès direct à l'attribut privé pour vérification

        expect(players.size).toBe(2);
        expect(players.get(player1.id)).toBe(player1);
        expect(players.get(player2.id)).toBe(player2);
    });

    it('should generate unique IDs for each player', () => {
        const player1 = playerManager.createPlayer('Player 1');
        const player2 = playerManager.createPlayer('Player 2');

        expect(player1.id).not.toBe(player2.id);
    });

    it('should handle creation of multiple players', () => {
        const playerNames = ['Alice', 'Bob', 'Charlie'];
        const players = playerNames.map((name) => playerManager.createPlayer(name));

        expect(players.length).toBe(3);
        players.forEach((player, index) => {
            expect(player.name).toBe(playerNames[index]);
        });
    });
});
