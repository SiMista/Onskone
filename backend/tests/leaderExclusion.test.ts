import { describe, it, expect } from '@jest/globals';
import * as GameManager from '../src/managers/GameManager';
import { TestHelper } from '../src/utils/TestHelper';

describe('Exclusion du rôle de pilier', () => {
    it('ne compte que les piliers possibles comme manches', () => {
        // Host + 4 joueurs = 5 actifs, 2 exclus -> 3 manches.
        const lobby = TestHelper.createLobbyWithPlayers(['A', 'B', 'C', 'D']);
        const [, a, b] = lobby.players;
        lobby.excludedLeaderIds = [a.id, b.id];

        const game = GameManager.createGame(lobby);
        expect(game.getMaxRounds()).toBe(3);
    });

    it('ne tire jamais un joueur exclu comme pilier et finit après la dernière manche', () => {
        const lobby = TestHelper.createLobbyWithPlayers(['A', 'B', 'C', 'D']);
        const excluded = [lobby.players[1].id, lobby.players[3].id];
        lobby.excludedLeaderIds = excluded;

        const game = GameManager.createGame(lobby);
        const leaders: string[] = [];
        while (!game.isGameOver()) {
            game.nextRound();
            leaders.push(game.currentRound!.leader.id);
        }

        expect(leaders).toHaveLength(3);
        expect(new Set(leaders).size).toBe(3);
        for (const id of excluded) expect(leaders).not.toContain(id);
    });

    it('garde une manche par joueur sans exclusion', () => {
        const lobby = TestHelper.createLobbyWithPlayers(['A', 'B']);
        const game = GameManager.createGame(lobby);
        expect(game.getMaxRounds()).toBe(3);
    });

    it("un joueur inactif au lancement qui revient ne vole pas la manche d'un pilier prévu", () => {
        // A, B, C, Host actifs (4 manches), D inactif au lancement puis de retour.
        const lobby = TestHelper.createLobbyWithPlayers(['A', 'B', 'C', 'D']);
        const latecomer = lobby.players[4];
        latecomer.isActive = false;

        const game = GameManager.createGame(lobby);
        expect(game.getMaxRounds()).toBe(4);
        latecomer.isActive = true;

        const leaders: string[] = [];
        while (!game.isGameOver()) {
            game.nextRound();
            leaders.push(game.currentRound!.leader.id);
        }

        expect(leaders).toHaveLength(4);
        expect(leaders).not.toContain(latecomer.id);
    });

    it("purge l'exclusion d'un joueur qui quitte le salon", () => {
        const lobby = TestHelper.createLobbyWithPlayers(['A', 'B']);
        const leaving = lobby.players[1];
        const staying = lobby.players[2];
        lobby.excludedLeaderIds = [leaving.id, staying.id];

        lobby.removePlayer(leaving);

        expect(lobby.excludedLeaderIds).toEqual([staying.id]);
    });
});
