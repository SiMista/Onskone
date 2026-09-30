import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { RoundPhase } from '@onskone/shared';
import * as GameManager from '../src/managers/GameManager';
import { TestHelper } from '../src/utils/TestHelper';
import { Round } from '../src/models/Round';
import { ConnectionRegistry } from '../src/sockets/ConnectionRegistry';
import {
    armServerTimerForPhase,
    transitionToGuessing,
    finishAnsweringPhase,
} from '../src/sockets/broadcasting';
import { scheduleLeaderSkipTimeout, armLeaderSkipIfDisconnected } from '../src/sockets/handlers/disconnectHandler';
import type { IoServer } from '../src/sockets/handlers/context';

/** Faux io : on ne lit que les events diffusés à la room. */
function fakeIo() {
    const emit = jest.fn();
    const io = { to: jest.fn(() => ({ emit })) } as unknown as IoServer;
    const emitted = (event: string) => emit.mock.calls.filter(([ev]) => ev === event);
    return { io, emit, emitted };
}

/** Lobby enregistré dans LobbyManager (requis par le timeout pilier) + partie lancée. */
function startedGame(guessMyAnswerMode = false) {
    const lobby = TestHelper.createLobbyWithPlayers(['Alice', 'Bob', 'Carla']);
    lobby.guessMyAnswerMode = guessMyAnswerMode;
    const game = GameManager.createGame(lobby);
    lobby.game = game;
    game.nextRound();
    const round = game.currentRound as Round;
    return { lobby, game, round };
}

describe('armServerTimerForPhase', () => {
    beforeEach(() => { jest.useFakeTimers(); });
    afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

    it('arme un timeout serveur pour la phase courante et diffuse timerStarted', () => {
        const { lobby, round } = startedGame();
        const { io, emitted } = fakeIo();

        armServerTimerForPhase(io, lobby.code, lobby, round);

        expect(round.serverTimerHandle).not.toBeNull();
        expect(round.timerPhase).toBe(RoundPhase.QUESTION_SELECTION);
        expect(emitted('timerStarted')).toHaveLength(1);
    });

    it('est idempotent : un timer déjà armé pour la phase est conservé', () => {
        const { lobby, round } = startedGame();
        const { io, emitted } = fakeIo();

        armServerTimerForPhase(io, lobby.code, lobby, round);
        const handle = round.serverTimerHandle;
        const end = round.timerEnd?.getTime();
        jest.advanceTimersByTime(5_000);
        armServerTimerForPhase(io, lobby.code, lobby, round);

        expect(round.serverTimerHandle).toBe(handle);
        expect(round.timerEnd?.getTime()).toBe(end);
        expect(emitted('timerStarted')).toHaveLength(1);
    });

    it("n'arme rien en REVEAL (phase sans timer)", () => {
        const { lobby, round } = startedGame();
        const { io, emitted } = fakeIo();
        round.phase = RoundPhase.REVEAL;

        armServerTimerForPhase(io, lobby.code, lobby, round);

        expect(round.serverTimerHandle).toBeNull();
        expect(emitted('timerStarted')).toHaveLength(0);
    });
});

describe('transitions interactives : le serveur arme lui-même le timer de la nouvelle phase', () => {
    beforeEach(() => { jest.useFakeTimers(); });
    afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

    it('transitionToGuessing arme un timer GUESSING', () => {
        const { lobby, round } = startedGame();
        const { io } = fakeIo();
        round.nextPhase(); // QUESTION_SELECTION -> ANSWERING (Classique)
        for (const p of lobby.players) {
            if (p.id !== round.leader.id) round.answers[p.id] = `réponse ${p.name}`;
        }

        transitionToGuessing(io, lobby.code, lobby, round, false);

        expect(round.phase).toBe(RoundPhase.GUESSING);
        expect(round.serverTimerHandle).not.toBeNull();
        expect(round.timerPhase).toBe(RoundPhase.GUESSING);
    });

    it('finishAnsweringPhase (Devine ma réponse) arme un timer SUBSTITUTE_ANSWERING', () => {
        const { lobby, round } = startedGame(true);
        const { io } = fakeIo();
        round.nextPhase(); // -> SUBSTITUTE_SELECTION
        round.nextPhase(); // -> ANSWERING

        finishAnsweringPhase(io, lobby.code, lobby, round, false);

        expect(round.phase).toBe(RoundPhase.SUBSTITUTE_ANSWERING);
        expect(round.serverTimerHandle).not.toBeNull();
        expect(round.timerPhase).toBe(RoundPhase.SUBSTITUTE_ANSWERING);
    });
});

describe('scheduleLeaderSkipTimeout (pilier absent)', () => {
    let registry: ConnectionRegistry;

    beforeEach(() => { jest.useFakeTimers(); registry = new ConnectionRegistry(); });
    afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

    it('ne saute pas en ANSWERING : le timer de phase gère, revérification plus tard', () => {
        const { lobby, game, round } = startedGame();
        const { io, emitted } = fakeIo();
        const leader = round.leader;
        round.phase = RoundPhase.ANSWERING;
        leader.isActive = false;

        scheduleLeaderSkipTimeout(io, registry, lobby.code, leader.id, leader.name);
        jest.advanceTimersByTime(60_000);

        expect(emitted('roundSkipped')).toHaveLength(0);
        expect(game.currentRound).toBe(round);

        // Toujours absent une fois en REVEAL : le saut, re-planifié, finit par partir.
        round.phase = RoundPhase.REVEAL;
        jest.advanceTimersByTime(60_000);
        expect(emitted('roundSkipped')).toHaveLength(1);
    });

    it('saute en REVEAL et arme le timer du nouveau round', () => {
        const { lobby, game, round } = startedGame();
        const { io, emitted } = fakeIo();
        const leader = round.leader;
        round.phase = RoundPhase.REVEAL;
        leader.isActive = false;

        scheduleLeaderSkipTimeout(io, registry, lobby.code, leader.id, leader.name);
        jest.advanceTimersByTime(60_000);

        expect(emitted('roundSkipped')).toHaveLength(1);
        expect(emitted('roundStarted')).toHaveLength(1);
        const next = game.currentRound as Round;
        expect(next).not.toBe(round);
        expect(next.serverTimerHandle).not.toBeNull();
        expect(next.timerPhase).toBe(RoundPhase.QUESTION_SELECTION);
    });

    it("saute même si le pilier n'est pas encore marqué inactif (timeout d'inactivité en attente)", () => {
        // Découplage LEADER_DISCONNECT_DELAY_MS / INACTIVE_DELAY_MS : le socket est mort
        // (timeout d'inactivité armé) mais `isActive` est encore vrai. Sans cette garde,
        // le pilier passait pour « reconnecté » et le saut n'était jamais ré-armé.
        const { lobby, round } = startedGame();
        const { io, emitted } = fakeIo();
        const leader = round.leader;
        round.phase = RoundPhase.REVEAL;
        registry.setInactiveTimeout(lobby.code, leader.name, setTimeout(() => {}, 600_000));

        scheduleLeaderSkipTimeout(io, registry, lobby.code, leader.id, leader.name);
        jest.advanceTimersByTime(60_000);

        expect(leader.isActive).toBe(true);
        expect(emitted('roundSkipped')).toHaveLength(1);
    });

    it('ne saute pas si le pilier est revenu', () => {
        const { lobby, round } = startedGame();
        const { io, emitted } = fakeIo();
        const leader = round.leader;
        round.phase = RoundPhase.REVEAL;

        scheduleLeaderSkipTimeout(io, registry, lobby.code, leader.id, leader.name);
        jest.advanceTimersByTime(60_000);

        expect(emitted('roundSkipped')).toHaveLength(0);
    });
});

describe('armLeaderSkipIfDisconnected (pilier tiré alors que son socket est tombé)', () => {
    let registry: ConnectionRegistry;

    beforeEach(() => { jest.useFakeTimers(); registry = new ConnectionRegistry(); });
    afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

    it("arme le saut quand le pilier a un timeout d'inactivité en attente", () => {
        const { lobby, round } = startedGame();
        const { io, emitted } = fakeIo();
        const leader = round.leader;
        registry.setInactiveTimeout(lobby.code, leader.name, setTimeout(() => {}, 600_000));
        round.phase = RoundPhase.REVEAL;

        armLeaderSkipIfDisconnected(io, registry, lobby.code, round);
        // Jamais revenu, et pas encore marqué inactif : le saut doit partir quand même.
        jest.advanceTimersByTime(60_000);

        expect(emitted('roundSkipped')).toHaveLength(1);
    });

    it('ne fait rien pour un pilier connecté', () => {
        const { lobby, round } = startedGame();
        const { io, emitted } = fakeIo();
        round.phase = RoundPhase.REVEAL;

        armLeaderSkipIfDisconnected(io, registry, lobby.code, round);
        jest.advanceTimersByTime(120_000);

        expect(emitted('roundSkipped')).toHaveLength(0);
    });
});
