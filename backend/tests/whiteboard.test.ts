import { jest, describe, it, expect, afterAll } from '@jest/globals';
import { RoundPhase, WHITEBOARD, GAME_CONSTANTS } from '@onskone/shared';
import { TestHelper } from '../src/utils/TestHelper';
import * as GameManager from '../src/managers/GameManager';
import { Whiteboard, sanitizeWhiteboardPoints } from '../src/models/Whiteboard';
import { Round } from '../src/models/Round';
import { registerWhiteboardHandlers } from '../src/sockets/handlers/whiteboardHandlers';
import { stopAllRateLimiters } from '../src/utils/rateLimiter';
import type { AppSocket, HandlerContext } from '../src/sockets/handlers/context';
import type { Lobby } from '../src/models/Lobby';
import type { Game } from '../src/models/Game';

afterAll(() => stopAllRateLimiters());

/** n points en diagonale, à plat. */
const pts = (n: number, start = 0): number[] => Array.from({ length: n }, (_, i) => [start + i, start + i]).flat();

describe('sanitizeWhiteboardPoints', () => {
    it('accepte des paires d’entiers 0..RESOLUTION', () => {
        expect(sanitizeWhiteboardPoints([0, 0, 1000, 1000])).toEqual([0, 0, 1000, 1000]);
    });

    it('refuse tout le paquet au moindre écart', () => {
        expect(sanitizeWhiteboardPoints('0,0')).toBeNull();
        expect(sanitizeWhiteboardPoints([])).toBeNull();
        expect(sanitizeWhiteboardPoints([1, 2, 3])).toBeNull(); // nombre impair
        expect(sanitizeWhiteboardPoints([1.5, 2])).toBeNull();
        expect(sanitizeWhiteboardPoints([-1, 2])).toBeNull();
        expect(sanitizeWhiteboardPoints([1, 1001])).toBeNull();
        expect(sanitizeWhiteboardPoints([1, '2'])).toBeNull();
        expect(sanitizeWhiteboardPoints(pts(WHITEBOARD.MAX_POINTS_PER_CHUNK + 1))).toBeNull();
    });
});

describe('Whiteboard (traits d’une manche)', () => {
    it('crée le trait puis y ajoute les points, et ne renvoie que les nouveaux', () => {
        const wb = new Whiteboard();
        expect(wb.draw('alice', 3, 'a1', [10, 10])).toEqual({ id: '3.a1', color: 3, points: [10, 10] });
        expect(wb.draw('alice', 3, 'a1', [20, 20, 30, 30])).toEqual({ id: '3.a1', color: 3, points: [20, 20, 30, 30] });
        expect(wb.snapshot()).toEqual([{ id: '3.a1', color: 3, points: [10, 10, 20, 20, 30, 30] }]);
    });

    it('le snapshot ne dit pas qui a dessiné', () => {
        const wb = new Whiteboard();
        wb.draw('alice', 3, 'a1', [10, 10]);
        expect(Object.keys(wb.snapshot()[0]).sort()).toEqual(['color', 'id', 'points']);
    });

    it('tronque un trait à sa limite de points', () => {
        const wb = new Whiteboard();
        const chunk = WHITEBOARD.MAX_POINTS_PER_CHUNK;
        let sent = 0;
        while (sent + chunk <= WHITEBOARD.MAX_POINTS_PER_STROKE) {
            wb.draw('alice', 3, 'a1', pts(chunk));
            sent += chunk;
        }
        const last = wb.draw('alice', 3, 'a1', pts(chunk));
        expect(last?.points.length).toBe((WHITEBOARD.MAX_POINTS_PER_STROKE - sent) * 2);
        expect(wb.draw('alice', 3, 'a1', [1, 1])).toBeNull();
        // Un nouveau trait repart, tant qu'il reste de l'encre au joueur.
        expect(wb.draw('alice', 3, 'a2', [1, 1])).not.toBeNull();
    });

    it("un joueur à court d'encre ne bloque pas les autres, et annuler rend l'encre", () => {
        const wb = new Whiteboard();
        let i = 0;
        while (wb.draw('alice', 3, `s${i}`, pts(WHITEBOARD.MAX_POINTS_PER_CHUNK))) i++;
        expect(wb.pointCount).toBe(WHITEBOARD.MAX_POINTS_PER_PLAYER);
        expect(wb.draw('alice', 3, 'encore', [1, 1])).toBeNull();
        expect(wb.draw('bob', 5, 'b1', [1, 1])).not.toBeNull();

        expect(wb.undo('alice', 3, 's0')).toBe('3.s0');
        expect(wb.draw('alice', 3, 'encore', [1, 1])).not.toBeNull();
    });

    it("un joueur qui tapote (traits d'un point) ne bloque jamais le tableau des autres", () => {
        const wb = new Whiteboard();
        let i = 0;
        while (wb.draw('alice', 3, `t${i}`, [1, 1])) i++;
        expect(i).toBe(WHITEBOARD.MAX_POINTS_PER_PLAYER);
        expect(wb.draw('bob', 5, 'b1', [1, 1])).not.toBeNull();
        // Retrait en plein milieu : l'ordre de création des autres traits est gardé.
        expect(wb.undo('alice', 3, 't1')).toBe('3.t1');
        expect(wb.snapshot().slice(0, 3).map(s => s.id)).toEqual(['3.t0', '3.t2', '3.t3']);
    });

    it("on ne touche pas au trait d'un autre", () => {
        const wb = new Whiteboard();
        wb.draw('alice', 3, 'a1', [10, 10]);
        expect(wb.draw('mallory', 3, 'a1', [20, 20])).toBeNull();
        expect(wb.undo('mallory', 3, 'a1')).toBeNull();
        expect(wb.undo('alice', 3, 'inconnu')).toBeNull();
        expect(wb.snapshot()[0].points).toEqual([10, 10]);
    });

    it('le tableau a une limite globale', () => {
        const wb = new Whiteboard();
        let owner = 0;
        let i = 0;
        while (wb.pointCount < WHITEBOARD.MAX_POINTS_TOTAL) {
            if (!wb.draw(`p${owner}`, owner % WHITEBOARD.COLOR_COUNT, `s${i++}`, pts(WHITEBOARD.MAX_POINTS_PER_CHUNK))) owner++;
        }
        expect(wb.draw('nouveau', 15, 'x', [1, 1])).toBeNull();
    });
});

describe('couleur du tableau (Game.getWhiteboardColor)', () => {
    it('une couleur distincte par joueur, fixe pour la partie', () => {
        const names = Array.from({ length: GAME_CONSTANTS.MAX_PLAYERS - 1 }, (_, i) => `J${i}`);
        const lobby = TestHelper.createLobbyWithPlayers(names);
        const game = GameManager.createGame(lobby);
        const colors = lobby.players.map(p => game.getWhiteboardColor(p.id));
        expect(new Set(colors).size).toBe(lobby.players.length);
        colors.forEach(c => expect(c).toBeGreaterThanOrEqual(0));
        colors.forEach(c => expect(c).toBeLessThan(WHITEBOARD.COLOR_COUNT));
        expect(lobby.players.map(p => game.getWhiteboardColor(p.id))).toEqual(colors);
    });

    it('les couleurs franches sortent avant les nuances voisines', () => {
        // + l'hôte du TestHelper = PRIMARY_COLOR_COUNT joueurs.
        const names = Array.from({ length: WHITEBOARD.PRIMARY_COLOR_COUNT - 1 }, (_, i) => `J${i}`);
        const lobby = TestHelper.createLobbyWithPlayers(names);
        expect(lobby.players).toHaveLength(WHITEBOARD.PRIMARY_COLOR_COUNT);
        const game = GameManager.createGame(lobby);
        const colors = lobby.players.map(p => game.getWhiteboardColor(p.id));
        colors.forEach(c => expect(c).toBeLessThan(WHITEBOARD.PRIMARY_COLOR_COUNT));
    });
});

describe('tableau remis à zéro', () => {
    it('vidé en quittant le choix de question, vide à la manche suivante', () => {
        const round = new Round(1, { id: 'l', name: 'L' } as never, { questions: [] } as never);
        round.whiteboard.draw('alice', 3, 'a1', [10, 10]);
        round.nextPhase();
        expect(round.phase).toBe(RoundPhase.ANSWERING);
        expect(round.whiteboard.snapshot()).toEqual([]);
        expect(new Round(2, { id: 'l', name: 'L' } as never, { questions: [] } as never).whiteboard.snapshot()).toEqual([]);
    });
});

// ----- Handlers socket -----------------------------------------------------------

type Handler = (data: unknown) => void;

/** Faux socket : enregistre ses handlers, ses émissions et ses diffusions à la room. */
function fakeSocket(id: string, rooms: string[]) {
    const handlers = new Map<string, Handler>();
    const roomEmit = jest.fn();
    const except = jest.fn();
    const room = { emit: roomEmit, except };
    except.mockReturnValue(room);
    const socket = {
        id,
        rooms: new Set([id, ...rooms]),
        on: (event: string, fn: Handler) => { handlers.set(event, fn); },
        emit: jest.fn(),
        to: jest.fn(() => room),
    };
    registerWhiteboardHandlers(socket as unknown as AppSocket, {} as HandlerContext);
    return { socket, roomEmit, except, send: (event: string, data: unknown) => handlers.get(event)!(data) };
}

function gameInQuestionSelection(): { lobby: Lobby; game: Game; leaderId: string; drawerId: string; drawerSocket: string } {
    const lobby = TestHelper.createLobbyWithPlayers(['Bob', 'Carla']);
    const game = GameManager.createGame(lobby);
    lobby.game = game;
    game.nextRound();
    const leaderId = game.currentRound!.leader.id;
    const drawer = lobby.players.find(p => p.id !== leaderId)!;
    return { lobby, game, leaderId, drawerId: drawer.id, drawerSocket: drawer.socketId };
}

describe('handlers du tableau blanc', () => {
    it("envoie le tableau et la couleur au joueur qui le demande", () => {
        const { lobby, game, drawerId, drawerSocket } = gameInQuestionSelection();
        const { socket, send } = fakeSocket(drawerSocket, [lobby.code]);
        send('getWhiteboard', { lobbyCode: lobby.code, playerId: drawerId });
        expect(socket.emit).toHaveBeenCalledWith('whiteboardState', {
            roundNumber: 1,
            myColor: game.getWhiteboardColor(drawerId),
            strokes: [],
        });
    });

    it('diffuse un trait aux AUTRES (pas d’écho ni pilier), puis son annulation', () => {
        const { lobby, game, leaderId, drawerId, drawerSocket } = gameInQuestionSelection();
        const { socket, roomEmit, except, send } = fakeSocket(drawerSocket, [lobby.code]);
        const color = game.getWhiteboardColor(drawerId);

        send('whiteboardDraw', { lobbyCode: lobby.code, playerId: drawerId, roundNumber: 1, strokeId: 'abc', points: [5, 6] });
        expect(socket.to).toHaveBeenCalledWith(lobby.code);
        expect(except).toHaveBeenCalledWith(lobby.getPlayer(leaderId)!.socketId);
        expect(roomEmit).toHaveBeenCalledWith('whiteboardStroke', { roundNumber: 1, stroke: { id: `${color}.abc`, color, points: [5, 6] } });
        expect(socket.emit).not.toHaveBeenCalled();

        send('whiteboardUndo', { lobbyCode: lobby.code, playerId: drawerId, roundNumber: 1, strokeIds: ['abc'] });
        expect(roomEmit).toHaveBeenCalledWith('whiteboardStrokeRemoved', { roundNumber: 1, strokeIds: [`${color}.abc`] });
        expect((lobby.game!.currentRound as Round).whiteboard.snapshot()).toEqual([]);
    });

    it('annule un geste entier (plusieurs traits) en un seul envoi, et ignore un geste invalide', () => {
        const { lobby, game, drawerId, drawerSocket } = gameInQuestionSelection();
        const { roomEmit, send } = fakeSocket(drawerSocket, [lobby.code]);
        const color = game.getWhiteboardColor(drawerId);
        const draw = (strokeId: string) =>
            send('whiteboardDraw', { lobbyCode: lobby.code, playerId: drawerId, roundNumber: 1, strokeId, points: [5, 6] });
        draw('g1'); draw('g2'); draw('keep');
        roomEmit.mockClear();

        const undo = (strokeIds: unknown) =>
            send('whiteboardUndo', { lobbyCode: lobby.code, playerId: drawerId, roundNumber: 1, strokeIds });
        undo('g1'); // pas un tableau
        undo([]);
        undo(['g1', 'pas un id !']); // tout ou rien
        undo(Array.from({ length: WHITEBOARD.MAX_STROKES_PER_UNDO + 1 }, (_, i) => `x${i}`));
        expect(roomEmit).not.toHaveBeenCalled();

        undo(['g1', 'g2', 'inconnu']);
        expect(roomEmit).toHaveBeenCalledWith('whiteboardStrokeRemoved', { roundNumber: 1, strokeIds: [`${color}.g1`, `${color}.g2`] });
        expect((lobby.game!.currentRound as Round).whiteboard.snapshot().map(s => s.id)).toEqual([`${color}.keep`]);
    });

    it('ignore EN SILENCE le pilier, un socket usurpateur, une autre manche ou une autre phase', () => {
        const { lobby, leaderId, drawerId, drawerSocket } = gameInQuestionSelection();
        const leader = lobby.getPlayer(leaderId)!;
        const draw = (from: ReturnType<typeof fakeSocket>, playerId: string, extra: object = {}) =>
            from.send('whiteboardDraw', { lobbyCode: lobby.code, playerId, roundNumber: 1, strokeId: 'abc', points: [5, 6], ...extra });

        const asLeader = fakeSocket(leader.socketId, [lobby.code]);
        draw(asLeader, leaderId);
        asLeader.send('getWhiteboard', { lobbyCode: lobby.code, playerId: leaderId });

        const impostor = fakeSocket('autre-socket', [lobby.code]);
        draw(impostor, drawerId);

        const outsider = fakeSocket(drawerSocket, []); // pas dans la room
        draw(outsider, drawerId);

        const drawer = fakeSocket(drawerSocket, [lobby.code]);
        draw(drawer, drawerId, { roundNumber: 2 });
        draw(drawer, drawerId, { strokeId: 'pas un id !' });
        draw(drawer, drawerId, { points: [1, 2, 3] });

        lobby.game!.currentRound!.phase = RoundPhase.ANSWERING;
        draw(drawer, drawerId);
        drawer.send('getWhiteboard', { lobbyCode: lobby.code, playerId: drawerId });

        for (const s of [asLeader, impostor, outsider, drawer]) {
            expect(s.roomEmit).not.toHaveBeenCalled();
            expect(s.socket.emit).not.toHaveBeenCalled(); // ni état, ni erreur
        }
    });
});
