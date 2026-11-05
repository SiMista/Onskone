import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { GameStatus } from '@onskone/shared';
import { TestHelper } from '../src/utils/TestHelper';
import { ConnectionRegistry } from '../src/sockets/ConnectionRegistry';
import { cleanupDisconnectedPlayers } from '../src/sockets/handlers/context';
import { findNameSlot } from '../src/sockets/handlers/reconnection';
import type { IoServer } from '../src/sockets/handlers/context';
import type { Lobby } from '../src/models/Lobby';

/** Faux io : la room du salon = sockets encore présents (cf. reconnectionFlow.test). */
function fakeIo(roomSocketIds: string[]) {
    const rooms = new Map<string, Set<string>>();
    const io = {
        sockets: { sockets: new Map(), adapter: { rooms } },
        to: jest.fn(() => ({ emit: jest.fn() })),
    } as unknown as IoServer;
    return { io, setRoom: (code: string) => rooms.set(code, new Set(roomSocketIds)) };
}

const HOST_SOCKET = 'test-socket-id';

/**
 * Séquence de checkPlayerName / joinLobby : on juge la propriété du pseudo, on
 * nettoie (en épargnant le slot du propriétaire prouvé), puis on regarde si le
 * pseudo est encore pris par quelqu'un d'autre.
 */
function nameTakenAfterCleanup(io: IoServer, registry: ConnectionRegistry, lobby: Lobby, name: string, socketId: string, token?: string) {
    const { slot, isOwner } = findNameSlot(lobby, name, socketId, token);
    cleanupDisconnectedPlayers(io, registry, lobby, isOwner ? slot?.name : undefined);
    const after = findNameSlot(lobby, name, socketId, token);
    return { taken: !!after.slot && !isOwner, slot: after.slot };
}

describe('pseudo « déjà pris » par un fantôme (retour dans un salon après en être parti)', () => {
    let registry: ConnectionRegistry;
    beforeEach(() => { registry = new ConnectionRegistry(); });

    it("purge le fantôme (inactif, socket hors room, grâce expirée) : le pseudo est libre", () => {
        // Régression : Bob parti sans leaveLobby aboutie restait dans lobby.players ;
        // checkPlayerName répondait « pseudo pris » alors que l'hôte ne le voyait plus.
        const lobby = TestHelper.createLobbyWithPlayers(['Bob']);
        const { io, setRoom } = fakeIo([HOST_SOCKET]);
        setRoom(lobby.code);
        lobby.players.find(p => p.name === 'Bob')!.isActive = false;

        const res = nameTakenAfterCleanup(io, registry, lobby, 'bob', 'new-socket');

        expect(res.taken).toBe(false);
        expect(lobby.players.map(p => p.name)).not.toContain('Bob');
    });

    it("le propriétaire prouvé (token) garde son slot et n'est pas vu comme « pris »", () => {
        const lobby = TestHelper.createLobbyWithPlayers(['Bob']);
        const { io, setRoom } = fakeIo([HOST_SOCKET]);
        setRoom(lobby.code);
        const bob = lobby.players.find(p => p.name === 'Bob')!;
        bob.isActive = false;

        const res = nameTakenAfterCleanup(io, registry, lobby, 'Bob', 'new-socket', bob.reconnectToken);

        expect(res.taken).toBe(false);
        expect(res.slot).toBe(bob); // même slot : points / statut conservés
    });

    it("un slot dont le socket est VIVANT reste protégé sans son secret (anti-usurpation)", () => {
        const lobby = TestHelper.createLobbyWithPlayers(['Bob']);
        const { io, setRoom } = fakeIo([HOST_SOCKET, 'socket-Bob']);
        setRoom(lobby.code);

        expect(nameTakenAfterCleanup(io, registry, lobby, 'Bob', 'attacker', 'mauvais-token').taken).toBe(true);
        expect(nameTakenAfterCleanup(io, registry, lobby, 'Bob', 'attacker').taken).toBe(true);
    });

    it("un slot en période de grâce n'est pas purgé", () => {
        const lobby = TestHelper.createLobbyWithPlayers(['Bob']);
        const { io, setRoom } = fakeIo([HOST_SOCKET]);
        setRoom(lobby.code);
        lobby.players.find(p => p.name === 'Bob')!.isActive = false;
        registry.setDisconnectTimeout(lobby.code, 'Bob', setTimeout(() => {}, 0));

        expect(nameTakenAfterCleanup(io, registry, lobby, 'Bob', 'new-socket').taken).toBe(true);
        registry.cancelDisconnectTimeout(lobby.code, 'Bob');
    });

    it("jamais de purge pendant une partie en cours", () => {
        const lobby = TestHelper.createLobbyWithPlayers(['Bob']);
        const { io, setRoom } = fakeIo([HOST_SOCKET]);
        setRoom(lobby.code);
        lobby.players.find(p => p.name === 'Bob')!.isActive = false;
        lobby.game = { status: GameStatus.IN_PROGRESS } as unknown as Lobby['game'];

        expect(nameTakenAfterCleanup(io, registry, lobby, 'Bob', 'new-socket').taken).toBe(true);
    });
});

describe('Lobby.hostIsPremium suit l\'hôte courant', () => {
    it('reflète le premium rafraîchi (achat en plein salon) et le transfert d\'hôte', () => {
        // Régression : figé au createLobby, un achat en salon recochait les thèmes
        // premium en « verrouillés » jusqu'à la création d'un nouveau salon.
        const lobby = TestHelper.createLobbyWithPlayers(['Bob']);
        const host = lobby.getHost()!;
        const bob = lobby.players.find(p => p.name === 'Bob')!;
        expect(lobby.hostIsPremium).toBe(false);

        host.isPremium = true; // relu au handshake après l'achat
        expect(lobby.hostIsPremium).toBe(true);

        lobby.setHost(bob); // Bob, non premium, devient hôte
        expect(lobby.hostIsPremium).toBe(false);
    });
});
