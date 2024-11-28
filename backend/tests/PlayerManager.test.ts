import { describe, it, expect, beforeEach } from '@jest/globals';
import { PlayerManager } from '../src/managers/PlayerManager';
import { Player } from '../src/models/Player';

describe('PlayerManager', () => {
    beforeEach(() => {
        // Réinitialise les joueurs entre chaque test
        PlayerManager.getPlayers().forEach((player) => PlayerManager.deletePlayer(player.id));
    });

    it('should create a standard player with the correct attributes', () => {
        const playerName = 'John Doe';
        const player = PlayerManager.createPlayer(playerName);

        expect(player).toBeInstanceOf(Player);
        expect(player.name).toBe(playerName);
        expect(player.isHost).toBe(false);
        expect(player.id).toBeDefined();
    });

    it('should create a host player with the correct attributes', () => {
        const hostName = 'Jane Host';
        const hostPlayer = PlayerManager.createHostPlayer(hostName);

        expect(hostPlayer).toBeInstanceOf(Player);
        expect(hostPlayer.name).toBe(hostName);
        expect(hostPlayer.isHost).toBe(true);
        expect(hostPlayer.id).toBeDefined();
    });

    it('should store players in the internal map', () => {
        const player1 = PlayerManager.createPlayer('Player 1');
        const player2 = PlayerManager.createHostPlayer('Host Player');

        const allPlayers = PlayerManager.getPlayers();

        expect(allPlayers.length).toBe(2);
        expect(allPlayers).toContainEqual(player1);
        expect(allPlayers).toContainEqual(player2);
    });

    it('should generate unique IDs for each player', () => {
        const player1 = PlayerManager.createPlayer('Player 1');
        const player2 = PlayerManager.createPlayer('Player 2');

        expect(player1.id).not.toBe(player2.id);
    });

    it('should handle creation of multiple players', () => {
        const playerNames = ['Alice', 'Bob', 'Charlie'];
        const players = playerNames.map((name) => PlayerManager.createPlayer(name));

        expect(players.length).toBe(3);
        players.forEach((player, index) => {
            expect(player.name).toBe(playerNames[index]);
        });
    });

    it('should allow deletion of players', () => {
        const player = PlayerManager.createPlayer('To Be Deleted');
        PlayerManager.deletePlayer(player.id);

        const allPlayers = PlayerManager.getPlayers();
        expect(allPlayers).not.toContainEqual(player);
    });

    it('should retrieve a player by ID', () => {
        const player = PlayerManager.createPlayer('Retriever');
        const fetchedPlayer = PlayerManager.getPlayer(player.id);

        expect(fetchedPlayer).toBe(player);
    });

    it('should return undefined for non-existent player IDs', () => {
        const fetchedPlayer = PlayerManager.getPlayer('NON_EXISTENT_ID');

        expect(fetchedPlayer).toBeUndefined();
    });
});
