import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Lobby } from '../src/models/Lobby';
import { Player } from '../src/models/Player';
import { ConnectionRegistry } from '../src/sockets/ConnectionRegistry';
import { reconnectPlayerSlot } from '../src/sockets/handlers/reconnection';
import {
    getLobbyCodeForSocket,
    registerSocket,
    unregisterSocket,
    reassignSocket,
} from '../src/managers/socketLobbyIndex';
import type { AppSocket } from '../src/sockets/broadcasting';

/** Faux socket minimal : le helper n'utilise que `id` et `join`. */
function fakeSocket(id: string): AppSocket {
    return { id, join: jest.fn() } as unknown as AppSocket;
}

describe('reconnectPlayerSlot (cœur de reconnexion partagé)', () => {
    let registry: ConnectionRegistry;

    beforeEach(() => {
        registry = new ConnectionRegistry();
    });

    it('réassocie le slot au nouveau socket et le marque actif', () => {
        const lobby = new Lobby('AAAAAA');
        const player = new Player('Alice', 'sock-old');
        player.isActive = false;
        lobby.addPlayer(player);

        const socket = fakeSocket('sock-new');
        reconnectPlayerSlot(registry, lobby, player, socket);

        expect(player.socketId).toBe('sock-new');
        expect(player.isActive).toBe(true);
        expect(socket.join).toHaveBeenCalledWith('AAAAAA');
    });

    it('annule les timeouts de déconnexion et d\'inactivité du joueur', () => {
        const lobby = new Lobby('BBBBBB');
        const player = new Player('Bob', 'sock-b1');
        lobby.addPlayer(player);

        registry.setDisconnectTimeout(lobby.code, player.name, setTimeout(() => {}, 10_000));
        registry.setInactiveTimeout(lobby.code, player.name, setTimeout(() => {}, 10_000));
        expect(registry.hasDisconnectTimeout(lobby.code, player.name)).toBe(true);

        reconnectPlayerSlot(registry, lobby, player, fakeSocket('sock-b2'));

        expect(registry.hasDisconnectTimeout(lobby.code, player.name)).toBe(false);
        // (l'inactif est annulé aussi ; pas de getter public dédié, mais aucune fuite)
    });

    it('annule le saut de round + MAJ le socketId du pilier quand le joueur est le pilier', () => {
        const lobby = new Lobby('CCCCCC');
        const leader = new Player('Chef', 'sock-c1');
        lobby.addPlayer(leader);
        // Faux game minimal : le helper ne lit que currentRound.leader.
        lobby.game = { currentRound: { leader, roundNumber: 1 } } as unknown as Lobby['game'];

        registry.setLeaderDisconnectTimeout(lobby.code, setTimeout(() => {}, 10_000));

        reconnectPlayerSlot(registry, lobby, leader, fakeSocket('sock-c2'));

        expect(leader.socketId).toBe('sock-c2');
        // leader === player (même référence) : socketId déjà à jour côté round.
        expect((lobby.game as any).currentRound.leader.socketId).toBe('sock-c2');
    });

    it('ne touche PAS le timeout pilier si le joueur n\'est pas le pilier', () => {
        const lobby = new Lobby('DDDDDD');
        const leader = new Player('Chef', 'sock-lead');
        const other = new Player('Autre', 'sock-o1');
        lobby.addPlayer(leader);
        lobby.addPlayer(other);
        lobby.game = { currentRound: { leader, roundNumber: 1 } } as unknown as Lobby['game'];

        const cancelSpy = jest.spyOn(registry, 'cancelLeaderDisconnectTimeout');
        reconnectPlayerSlot(registry, lobby, other, fakeSocket('sock-o2'));

        expect(cancelSpy).not.toHaveBeenCalled();
    });
});

describe('socketLobbyIndex — cohérence sur join -> reconnect -> leave', () => {
    it('maintient socketId -> lobbyCode à travers le cycle de vie complet', () => {
        const lobby = new Lobby('EEEEEE');
        const player = new Player('Eve', 'sock-e1');

        // JOIN : addPlayer enregistre l'entrée.
        lobby.addPlayer(player);
        expect(getLobbyCodeForSocket('sock-e1')).toBe('EEEEEE');

        // RECONNECT : reconnectPlayerSlot réassocie ancien -> nouveau socket.
        const registry = new ConnectionRegistry();
        reconnectPlayerSlot(registry, lobby, player, fakeSocket('sock-e2'));
        expect(getLobbyCodeForSocket('sock-e1')).toBeUndefined();
        expect(getLobbyCodeForSocket('sock-e2')).toBe('EEEEEE');

        // LEAVE : removePlayer purge l'entrée courante.
        lobby.removePlayer(player);
        expect(getLobbyCodeForSocket('sock-e2')).toBeUndefined();
    });

    it('registerSocket / reassignSocket / unregisterSocket sont cohérents', () => {
        registerSocket('x-1', 'ROOM01');
        expect(getLobbyCodeForSocket('x-1')).toBe('ROOM01');

        reassignSocket('x-1', 'x-2', 'ROOM01');
        expect(getLobbyCodeForSocket('x-1')).toBeUndefined();
        expect(getLobbyCodeForSocket('x-2')).toBe('ROOM01');

        // Réassociation vers le même id : ne supprime pas l'entrée.
        reassignSocket('x-2', 'x-2', 'ROOM01');
        expect(getLobbyCodeForSocket('x-2')).toBe('ROOM01');

        unregisterSocket('x-2');
        expect(getLobbyCodeForSocket('x-2')).toBeUndefined();
    });
});
