import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { GAME_CONSTANTS, GameStatus, RoundPhase } from '@onskone/shared';
import * as GameManager from '../src/managers/GameManager';
import { TestHelper } from '../src/utils/TestHelper';
import { Round } from '../src/models/Round';
import { armRevealBackstop, advanceAfterReveal, endGame } from '../src/sockets/broadcasting';
import type { IoServer } from '../src/sockets/handlers/context';

const BACKSTOP = GAME_CONSTANTS.REVEAL_BACKSTOP_MS;

/**
 * Faux io : les events diffusés à la room + le registre des sockets vivants (le
 * filet regarde si le pilier est encore connecté). Par défaut, personne n'est connecté.
 */
function fakeIo(aliveSocketIds: string[] = []) {
    const emit = jest.fn();
    const sockets = new Map(aliveSocketIds.map(id => [id, { id, connected: true }]));
    const io = { to: jest.fn(() => ({ emit })), sockets: { sockets } } as unknown as IoServer;
    const emitted = (event: string) => emit.mock.calls.filter(([ev]) => ev === event);
    return { io, emitted };
}

/** Partie à 3 joueurs, manche 1 amenée directement en REVEAL. */
function gameInReveal() {
    const lobby = TestHelper.createLobbyWithPlayers(['Ana', 'Bob', 'Cléo']);
    const game = GameManager.createGame(lobby);
    lobby.game = game;
    game.nextRound();
    const round = game.currentRound as Round;
    round.phase = RoundPhase.REVEAL;
    return { lobby, game, round };
}

describe('filet REVEAL (REVEAL_BACKSTOP_MS)', () => {
    beforeEach(() => { jest.useFakeTimers(); });
    afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

    it('sans action du pilier, conclut la manche et démarre la suivante', () => {
        const { lobby, game, round } = gameInReveal();
        const { io, emitted } = fakeIo();

        armRevealBackstop(io, lobby.code, lobby, game, round);
        jest.advanceTimersByTime(BACKSTOP - 1);
        expect(emitted('roundSkipped')).toHaveLength(0);

        jest.advanceTimersByTime(1);
        expect(emitted('roundSkipped')).toEqual([[
            'roundSkipped', { skippedLeaderName: round.leader.name, reason: 'leader_idle' },
        ]]);
        expect(emitted('roundStarted')).toHaveLength(1);
        expect(game.currentRound?.roundNumber).toBe(2);
        expect(game.status).toBe(GameStatus.IN_PROGRESS);
    });

    it("pilier encore connecté : un sursis complet, puis saut quoi qu'il arrive", () => {
        // Table vivante qui débat devant le classement : on ne coupe pas au premier
        // délai. Mais un pilier connecté et absent ne doit pas figer la table pour autant.
        const { lobby, game, round } = gameInReveal();
        const { io, emitted } = fakeIo([round.leader.socketId!]);

        armRevealBackstop(io, lobby.code, lobby, game, round);
        jest.advanceTimersByTime(BACKSTOP);
        expect(emitted('roundSkipped')).toHaveLength(0);
        expect(game.currentRound?.roundNumber).toBe(1);

        jest.advanceTimersByTime(BACKSTOP);
        expect(emitted('roundSkipped')).toHaveLength(1);
        expect(game.currentRound?.roundNumber).toBe(2);
    });

    it("une action du pilier pendant le sursis remet le compteur à zéro", () => {
        const { lobby, game, round } = gameInReveal();
        const { io, emitted } = fakeIo([round.leader.socketId!]);

        armRevealBackstop(io, lobby.code, lobby, game, round);
        jest.advanceTimersByTime(BACKSTOP); // 1er déclenchement : sursis
        armRevealBackstop(io, lobby.code, lobby, game, round); // le pilier révèle une réponse
        jest.advanceTimersByTime(BACKSTOP); // -> de nouveau un sursis, pas un saut
        expect(emitted('roundSkipped')).toHaveLength(0);
        jest.advanceTimersByTime(BACKSTOP);
        expect(emitted('roundSkipped')).toHaveLength(1);
    });

    it('est réarmé à chaque action du pilier (un reveal animé peut durer)', () => {
        const { lobby, game, round } = gameInReveal();
        const { io, emitted } = fakeIo();

        armRevealBackstop(io, lobby.code, lobby, game, round);
        jest.advanceTimersByTime(BACKSTOP - 1000);
        armRevealBackstop(io, lobby.code, lobby, game, round); // le pilier révèle une réponse
        jest.advanceTimersByTime(BACKSTOP - 1000);
        expect(emitted('roundSkipped')).toHaveLength(0);

        jest.advanceTimersByTime(1000);
        expect(emitted('roundSkipped')).toHaveLength(1);
    });

    it('ne fait rien si le pilier a conclu la manche entre-temps', () => {
        const { lobby, game, round } = gameInReveal();
        const { io, emitted } = fakeIo();

        armRevealBackstop(io, lobby.code, lobby, game, round);
        advanceAfterReveal(io, lobby.code, lobby, game); // nextRound du pilier
        expect(game.currentRound?.roundNumber).toBe(2);

        jest.advanceTimersByTime(BACKSTOP);
        expect(emitted('roundSkipped')).toHaveLength(0);
        expect(game.currentRound?.roundNumber).toBe(2);
    });

    it('est désarmé par la fin de partie', () => {
        const { lobby, game, round } = gameInReveal();
        const { io, emitted } = fakeIo();

        armRevealBackstop(io, lobby.code, lobby, game, round);
        endGame(io, lobby.code, lobby, game);
        expect(game.status).toBe(GameStatus.FINISHED);

        jest.advanceTimersByTime(BACKSTOP);
        expect(emitted('roundSkipped')).toHaveLength(0);
        expect(emitted('gameEnded')).toHaveLength(1);
    });

    it('termine la partie si la manche conclue était la dernière', () => {
        const { lobby, game } = gameInReveal();
        const { io, emitted } = fakeIo();
        // Avance jusqu'à la dernière manche (3 joueurs = 3 manches).
        while (!game.isGameOver()) {
            game.nextRound();
        }
        const last = game.currentRound as Round;
        last.phase = RoundPhase.REVEAL;

        armRevealBackstop(io, lobby.code, lobby, game, last);
        jest.advanceTimersByTime(BACKSTOP);

        expect(emitted('roundSkipped')).toHaveLength(1);
        expect(emitted('gameEnded')).toHaveLength(1);
        expect(game.status).toBe(GameStatus.FINISHED);
    });
});
