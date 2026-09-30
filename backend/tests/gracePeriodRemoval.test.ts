import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { GAME_CONSTANTS } from '@onskone/shared';
import * as GameManager from '../src/managers/GameManager';
import { TestHelper } from '../src/utils/TestHelper';
import { ConnectionRegistry } from '../src/sockets/ConnectionRegistry';
import { registerDisconnectHandler } from '../src/sockets/handlers/disconnectHandler';
import { createHandlerContext } from '../src/sockets/handlers/context';
import type { IoServer, AppSocket } from '../src/sockets/handlers/context';

const GRACE = GAME_CONSTANTS.RECONNECT_GRACE_PERIOD_MS;

/** Faux io : on ne lit que les events diffusés à la room. */
function fakeIo() {
    const emit = jest.fn();
    const io = { to: jest.fn(() => ({ emit })) } as unknown as IoServer;
    const emitted = (event: string) => emit.mock.calls.filter(([ev]) => ev === event);
    return { io, emitted };
}

/** Faux socket : on ne capture que le handler `disconnect` pour le déclencher à la main. */
function fakeSocket(id: string) {
    let onDisconnect: ((reason: string) => void) | undefined;
    const socket = {
        id,
        on: jest.fn((event: string, cb: (reason: string) => void) => {
            if (event === 'disconnect') onDisconnect = cb;
        }),
    } as unknown as AppSocket;
    return { socket, disconnect: () => onDisconnect?.('transport close') };
}

/**
 * Simule la chute du socket d'un joueur en passant par le VRAI handler `disconnect`
 * (câblage des trois timeouts inclus). Le socketId est celui posé par TestHelper.
 */
function dropPlayer(io: IoServer, registry: ConnectionRegistry, socketId: string): void {
    const { socket, disconnect } = fakeSocket(socketId);
    registerDisconnectHandler(socket, createHandlerContext(io, registry));
    disconnect();
}

describe('période de grâce : suppression du joueur déconnecté', () => {
    let registry: ConnectionRegistry;

    beforeEach(() => { jest.useFakeTimers(); registry = new ConnectionRegistry(); });
    afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

    it("retire le joueur d'un salon en attente à la fin de la grâce, sans attendre le marquage inactif", () => {
        // Régression : avec INACTIVE_DELAY_MS (60 s) > RECONNECT_GRACE_PERIOD_MS (30 s),
        // une suppression conditionnée à `!isActive` ne trouvait jamais personne et le
        // joueur restait fantôme dans le salon (hôte compris → salon bloqué).
        const lobby = TestHelper.createLobbyWithPlayers(['Bob', 'Carla']);
        const { io, emitted } = fakeIo();

        dropPlayer(io, registry, 'socket-Bob');
        jest.advanceTimersByTime(GRACE);

        expect(lobby.players.map(p => p.name)).not.toContain('Bob');
        expect(emitted('updatePlayersList')).toHaveLength(1);
        expect(registry.hasInactiveTimeout(lobby.code, 'Bob')).toBe(false);
    });

    it("réassigne l'hôte si c'est lui qui est parti", () => {
        const lobby = TestHelper.createLobbyWithPlayers(['Bob', 'Carla']);
        const { io } = fakeIo();
        const host = lobby.getHost()!;

        dropPlayer(io, registry, host.socketId);
        jest.advanceTimersByTime(GRACE);

        expect(lobby.players).not.toContain(host);
        expect(lobby.getHost()).toBeDefined();
        expect(lobby.getHost()).not.toBe(host);
    });

    it('conserve le joueur si une partie est en cours (scores du leaderboard)', () => {
        const lobby = TestHelper.createLobbyWithPlayers(['Bob', 'Carla']);
        lobby.game = GameManager.createGame(lobby);
        lobby.game.nextRound();
        const { io } = fakeIo();

        dropPlayer(io, registry, 'socket-Bob');
        jest.advanceTimersByTime(GRACE);

        expect(lobby.players.map(p => p.name)).toContain('Bob');
    });

    it('ne retire pas un joueur revenu entre-temps (socketId remplacé)', () => {
        const lobby = TestHelper.createLobbyWithPlayers(['Bob', 'Carla']);
        const { io } = fakeIo();

        dropPlayer(io, registry, 'socket-Bob');
        // Reconnexion simulée SANS passer par reconnectPlayerSlot (qui annulerait le
        // timeout) : la garde socketId doit suffire à elle seule.
        lobby.players.find(p => p.name === 'Bob')!.socketId = 'socket-Bob-2';
        jest.advanceTimersByTime(GRACE);

        expect(lobby.players.map(p => p.name)).toContain('Bob');
    });
});
