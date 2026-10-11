import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { GameStatus, gameFingerprint, RoundPhase } from '@onskone/shared';
import { TestHelper } from '../src/utils/TestHelper';
import { ConnectionRegistry } from '../src/sockets/ConnectionRegistry';
import { cleanupDisconnectedPlayers } from '../src/sockets/handlers/context';
import {
    isSocketAlive, socketHoldsOtherSlot, listReclaimablePlayers, issueClaimToken, tokenMatches, revokeClaimIfProvenOwner,
} from '../src/sockets/handlers/reconnection';
import { isTimerExpiryPlausible, TIMER_EXPIRY_TOLERANCE_MS } from '../src/utils/timerExpiry';
import type { IoServer } from '../src/sockets/handlers/context';
import type { Lobby } from '../src/models/Lobby';

/**
 * Faux io minimal : la room du salon (sockets présents) et le registre des sockets
 * vivants, qui sont les deux seules choses lues par le nettoyage et la reprise de slot.
 */
function fakeIo(aliveSocketIds: string[], roomSocketIds: string[] = aliveSocketIds) {
    const sockets = new Map(aliveSocketIds.map(id => [id, { id, connected: true }]));
    const rooms = new Map<string, Set<string>>();
    const io = {
        sockets: { sockets, adapter: { rooms } },
        to: jest.fn(() => ({ emit: jest.fn() })),
    } as unknown as IoServer;
    return {
        io,
        setRoom: (lobbyCode: string) => rooms.set(lobbyCode, new Set(roomSocketIds)),
    };
}

const inProgress = (lobby: Lobby) => {
    lobby.game = { status: GameStatus.IN_PROGRESS } as unknown as Lobby['game'];
};

// TestHelper ajoute toujours un hôte ("Host from TestHelper", socket "test-socket-id").
const HOST = 'Host from TestHelper';
const HOST_SOCKET = 'test-socket-id';

describe('cleanupDisconnectedPlayers', () => {
    let registry: ConnectionRegistry;
    beforeEach(() => { registry = new ConnectionRegistry(); });

    it("retire d'un salon EN ATTENTE les joueurs inactifs sans socket ni grâce", () => {
        const lobby = TestHelper.createLobbyWithPlayers(['Bob', 'Carla', 'Dan']);
        const { io, setRoom } = fakeIo([HOST_SOCKET, 'socket-Bob']);
        setRoom(lobby.code);
        lobby.players.find(p => p.name === 'Carla')!.isActive = false;

        cleanupDisconnectedPlayers(io, registry, lobby);

        // Dan n'a plus de socket mais n'est pas encore marqué inactif : conservé.
        expect(lobby.players.map(p => p.name)).toEqual([HOST, 'Bob', 'Dan']);
    });

    it('ne retire JAMAIS personne pendant une partie en cours (scores + retour possible)', () => {
        // Régression : un ami qui revenait par le lien d'invitation effaçait tous les
        // absents de la partie — points perdus, et « La partie a déjà été lancée ».
        const lobby = TestHelper.createLobbyWithPlayers(['Bob', 'Carla', 'Dan']);
        const { io, setRoom } = fakeIo([HOST_SOCKET, 'socket-Bob']);
        setRoom(lobby.code);
        inProgress(lobby);
        lobby.players.forEach(p => { if (p.name !== 'Bob' && p.name !== HOST) p.isActive = false; });

        cleanupDisconnectedPlayers(io, registry, lobby);

        expect(lobby.players.map(p => p.name)).toEqual([HOST, 'Bob', 'Carla', 'Dan']);
    });
});

describe('reprise de slot (reclaimPlayer)', () => {
    it("liste les joueurs dont le socket est mort, même pas encore marqués inactifs", () => {
        const lobby = TestHelper.createLobbyWithPlayers(['Bob', 'Carla', 'Dan']);
        const { io } = fakeIo([HOST_SOCKET, 'socket-Bob']);

        expect(isSocketAlive(io, 'socket-Bob')).toBe(true);
        expect(isSocketAlive(io, 'socket-Carla')).toBe(false);
        expect(listReclaimablePlayers(io, lobby).map(p => p.name)).toEqual(['Carla', 'Dan']);
    });

    it("n'expose que l'id, le nom et l'avatar (jamais le secret ni le socket)", () => {
        const lobby = TestHelper.createLobbyWithPlayers(['Bob']);
        const { io } = fakeIo([]);
        const [entry] = listReclaimablePlayers(io, lobby);
        expect(Object.keys(entry).sort()).toEqual(['avatarId', 'id', 'name']);
    });

    it("refuse qu'un socket déjà rattaché à un autre joueur reprenne un second slot", () => {
        const lobby = TestHelper.createLobbyWithPlayers(['Bob', 'Carla']);
        const bob = lobby.players.find(p => p.name === 'Bob')!;
        const carla = lobby.players.find(p => p.name === 'Carla')!;

        // Le socket de Bob vise le slot de Carla : refusé (un socket = un slot).
        expect(socketHoldsOtherSlot(lobby, bob.socketId, carla.id)).toBe(true);
        // Bob reprend SON slot avec son socket courant (idempotent) : autorisé.
        expect(socketHoldsOtherSlot(lobby, bob.socketId, bob.id)).toBe(false);
        // Socket neuf (appli relancée) : ne tient aucun slot, autorisé.
        expect(socketHoldsOtherSlot(lobby, 'socket-neuf', carla.id)).toBe(false);
    });

    it("remet un secret provisoire SANS révoquer le secret d'origine", () => {
        const lobby = TestHelper.createLobbyWithPlayers(['Bob']);
        const bob = lobby.players.find(p => p.name === 'Bob')!;
        const original = bob.reconnectToken;
        const claim = issueClaimToken(bob);

        expect(claim).toMatch(/^[0-9a-f-]{36}$/);
        expect(claim).not.toBe(original);
        expect(bob.reconnectToken).toBe(original);
        expect(tokenMatches(bob, claim)).toBe(true);
        expect(tokenMatches(bob, original)).toBe(true);
        expect(tokenMatches(bob, 'n-importe-quoi')).toBe(false);
        expect(tokenMatches(bob, undefined)).toBe(false);
    });

    it("le propriétaire prouvé (secret d'origine) révoque la reprise ; la reprise ne révoque rien", () => {
        const lobby = TestHelper.createLobbyWithPlayers(['Bob']);
        const bob = lobby.players.find(p => p.name === 'Bob')!;
        const claim = issueClaimToken(bob);

        revokeClaimIfProvenOwner(bob, claim); // reconnexion avec le secret provisoire
        expect(tokenMatches(bob, claim)).toBe(true);

        revokeClaimIfProvenOwner(bob, bob.reconnectToken); // le vrai propriétaire revient
        expect(tokenMatches(bob, claim)).toBe(false);
        expect(tokenMatches(bob, bob.reconnectToken)).toBe(true);
    });
});

describe('timerExpired du pilier', () => {
    const end = new Date('2026-10-10T12:00:00Z');

    it('accepté à l’heure, ou légèrement en avance (latence / horloge)', () => {
        expect(isTimerExpiryPlausible(end, end.getTime())).toBe(true);
        expect(isTimerExpiryPlausible(end, end.getTime() + 5_000)).toBe(true);
        expect(isTimerExpiryPlausible(end, end.getTime() - TIMER_EXPIRY_TOLERANCE_MS)).toBe(true);
    });

    it('refusé nettement en avance : la phase ne se conclut pas avant la fin du temps', () => {
        expect(isTimerExpiryPlausible(end, end.getTime() - TIMER_EXPIRY_TOLERANCE_MS - 1)).toBe(false);
        expect(isTimerExpiryPlausible(end, end.getTime() - 60_000)).toBe(false);
    });

    it('sans timer serveur armé, on fait confiance au pilier', () => {
        expect(isTimerExpiryPlausible(null, 0)).toBe(true);
        expect(isTimerExpiryPlausible(undefined, 0)).toBe(true);
    });
});

describe('gameFingerprint (empreinte de synchronisation)', () => {
    it('identique pour un même écran, différente dès que l’écran change', () => {
        const base = { status: GameStatus.IN_PROGRESS, currentRound: { roundNumber: 2, phase: RoundPhase.REVEAL, revealedIndices: [0, 1] } };
        expect(gameFingerprint(base)).toBe(gameFingerprint({ ...base, currentRound: { ...base.currentRound, revealedIndices: [1, 0] } }));
        expect(gameFingerprint(base)).not.toBe(gameFingerprint({ ...base, currentRound: { ...base.currentRound, revealedIndices: [0] } }));
        expect(gameFingerprint(base)).not.toBe(gameFingerprint({ ...base, currentRound: { ...base.currentRound, phase: RoundPhase.GUESSING } }));
        expect(gameFingerprint(base)).not.toBe(gameFingerprint({ ...base, currentRound: { ...base.currentRound, roundNumber: 3 } }));
        expect(gameFingerprint(base)).not.toBe(gameFingerprint({ ...base, status: GameStatus.FINISHED }));
    });

    it('gère l’absence de manche et de partie', () => {
        expect(gameFingerprint({ status: GameStatus.WAITING, currentRound: null })).toBe('WAITING:-');
        expect(gameFingerprint(null)).toBe('none');
    });
});
