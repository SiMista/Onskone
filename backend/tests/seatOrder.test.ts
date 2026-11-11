import { describe, it, expect } from '@jest/globals';
import * as GameManager from '../src/managers/GameManager';
import { TestHelper } from '../src/utils/TestHelper';
import { Player } from '../src/models/Player';
import type { Lobby } from '../src/models/Lobby';

/** Noms des joueurs dans l'ordre des places. */
const seatNames = (lobby: Lobby): string[] =>
    lobby.seatOrder.map(id => lobby.players.find(p => p.id === id)!.name);

const byName = (lobby: Lobby, name: string) => lobby.players.find(p => p.name === name)!;

/** Joue la partie jusqu'au bout et renvoie les piliers, dans l'ordre des manches. */
const playLeaders = (lobby: Lobby): string[] => {
    const game = GameManager.createGame(lobby);
    const leaders: string[] = [];
    while (!game.isGameOver()) {
        game.nextRound();
        leaders.push(game.currentRound!.leader.name);
    }
    return leaders;
};

const HOST = 'Host from TestHelper';

describe('Places à table', () => {
    it("place les joueurs dans l'ordre d'arrivée, un arrivant en dernier", () => {
        const lobby = TestHelper.createLobbyWithPlayers(['A', 'B']);
        lobby.addPlayer(new Player('C', 'socket-C'));
        expect(seatNames(lobby)).toEqual([HOST, 'A', 'B', 'C']);
    });

    it('referme le trou sans mélanger les autres quand un joueur part', () => {
        const lobby = TestHelper.createLobbyWithPlayers(['A', 'B', 'C', 'D']);
        lobby.removePlayer(byName(lobby, 'B'));
        expect(seatNames(lobby)).toEqual([HOST, 'A', 'C', 'D']);
    });

    it('rend sa place à un joueur qui revient (même nom, nouvel id)', () => {
        const lobby = TestHelper.createLobbyWithPlayers(['A', 'B', 'C', 'D']);
        lobby.removePlayer(byName(lobby, 'B'));
        lobby.addPlayer(new Player('C2', 'socket-C2'));
        lobby.addPlayer(new Player('b', 'socket-b2')); // nom insensible à la casse
        expect(seatNames(lobby)).toEqual([HOST, 'A', 'b', 'C', 'D', 'C2']);
    });

    it('le remet avant son voisin de droite si celui de gauche est parti aussi', () => {
        const lobby = TestHelper.createLobbyWithPlayers(['A', 'B', 'C', 'D']);
        lobby.removePlayer(byName(lobby, 'B'));
        lobby.removePlayer(byName(lobby, 'A'));
        lobby.addPlayer(new Player('B', 'socket-B2'));
        expect(seatNames(lobby)).toEqual([HOST, 'B', 'C', 'D']);
        lobby.addPlayer(new Player('A', 'socket-A2'));
        expect(seatNames(lobby)).toEqual([HOST, 'A', 'B', 'C', 'D']);
    });

    it("garde la place à la place n°1 pour celui qui l'occupait", () => {
        const lobby = TestHelper.createLobbyWithPlayers(['A', 'B']);
        lobby.removePlayer(byName(lobby, HOST));
        lobby.addPlayer(new Player(HOST, 'socket-host2'));
        expect(seatNames(lobby)).toEqual([HOST, 'A', 'B']);
    });
});

describe("Places choisies par l'hôte", () => {
    it('applique un nouvel ordre et diffuse les joueurs dans cet ordre', () => {
        const lobby = TestHelper.createLobbyWithPlayers(['A', 'B', 'C']);
        const [host, a, b, c] = lobby.players;
        expect(lobby.setSeatOrder([c.id, host.id, b.id, a.id])).toBe(true);
        expect(seatNames(lobby)).toEqual(['C', HOST, 'B', 'A']);
        expect(lobby.getSeatedPlayers().map(p => p.name)).toEqual(['C', HOST, 'B', 'A']);
    });

    it('ignore les ids inconnus et les doublons, et remet les oubliés en fin', () => {
        const lobby = TestHelper.createLobbyWithPlayers(['A', 'B']);
        const [host, , b] = lobby.players;
        expect(lobby.setSeatOrder([b.id, 'fantome', b.id, host.id])).toBe(true);
        expect(seatNames(lobby)).toEqual(['B', HOST, 'A']);
        expect(lobby.seatOrder).not.toContain('fantome');
    });

    it('refuse une liste mal formée sans toucher aux places', () => {
        const lobby = TestHelper.createLobbyWithPlayers(['A', 'B']);
        const before = [...lobby.seatOrder];
        expect(lobby.setSeatOrder('pas une liste')).toBe(false);
        expect(lobby.setSeatOrder([1, 2, 3])).toBe(false);
        expect(lobby.setSeatOrder(Array.from({ length: 16 }, (_, i) => `id-${i}`))).toBe(false);
        expect(lobby.seatOrder).toEqual(before);
    });
});

describe('Les places ne décident pas des piliers', () => {
    it('chaque pilier possible passe une fois, dans un ordre tiré au hasard', () => {
        const lobby = TestHelper.createLobbyWithPlayers(['A', 'B', 'C']);
        const leaders = playLeaders(lobby);
        expect([...leaders].sort()).toEqual([HOST, 'A', 'B', 'C'].sort());
    });

    it("ne suit pas l'ordre des places : le premier pilier n'est pas toujours la place n°1", () => {
        // 4 joueurs : P(toujours le même premier pilier sur 40 parties) = 4·(1/4)^40, jamais en pratique.
        const firsts = new Set<string>();
        for (let i = 0; i < 40; i++) {
            const lobby = TestHelper.createLobbyWithPlayers(['A', 'B', 'C']);
            firsts.add(playLeaders(lobby)[0]);
        }
        expect(firsts.size).toBeGreaterThan(1);
    });

    it('passe les joueurs exclus du rôle de pilier', () => {
        const lobby = TestHelper.createLobbyWithPlayers(['A', 'B', 'C']);
        lobby.excludedLeaderIds = [byName(lobby, HOST).id, byName(lobby, 'B').id];
        expect([...playLeaders(lobby)].sort()).toEqual(['A', 'C']);
    });

    it("un joueur inactif au lancement ne prend pas de manche s'il revient en cours de partie", () => {
        const lobby = TestHelper.createLobbyWithPlayers(['A', 'B', 'C']);
        const latecomer = byName(lobby, 'A');
        latecomer.isActive = false;
        const game = GameManager.createGame(lobby);
        latecomer.isActive = true;

        const leaders: string[] = [];
        while (!game.isGameOver()) {
            game.nextRound();
            leaders.push(game.currentRound!.leader.name);
        }
        expect([...leaders].sort()).toEqual([HOST, 'B', 'C'].sort());
    });
});
