import { describe, it, expect } from '@jest/globals';
import { GameStatus, RoundPhase, gameFingerprint, getSimilarityComparison, formatNoResponse } from '@onskone/shared';
import type { RevealResult } from '@onskone/shared';
import * as GameManager from '../src/managers/GameManager';
import { TestHelper } from '../src/utils/TestHelper';
import { Round } from '../src/models/Round';
import { buildRevealResults, serializeRound } from '../src/sockets/broadcasting';
import { isSimilarityCandidate, onCardRevealed, resolveSimilarity } from '../src/sockets/similarityArbitration';

/** Résultat minimal : `author` a écrit `answer`, le pilier l'a posé devant `holder`. */
function card(author: string, holder: string, answer: string): RevealResult {
    return {
        playerId: author,
        playerName: author,
        answer,
        guessedPlayerId: holder,
        guessedPlayerName: holder || 'Aucun',
        correct: author === holder,
    };
}

describe('getSimilarityComparison (quelle carte comparer, devant qui)', () => {
    // Alice et Bob ont écrit pizza, Charlie hamburger. Le pilier a posé la carte
    // d'Alice devant Bob, celle de Bob devant Charlie, celle de Charlie devant Alice.
    const results = [
        card('alice', 'bob', 'Pizza'),
        card('bob', 'charlie', 'Pizzas'),
        card('charlie', 'alice', 'Hamburger'),
    ];

    it("compare l'écran de Bob à l'écran où le pilier a posé ce que Bob a vraiment écrit (Charlie)", () => {
        expect(getSimilarityComparison(results, 0)).toEqual({
            comparedIndex: 1,
            comparedAnswer: 'Pizzas',
            holderId: 'charlie',
            holderName: 'charlie',
        });
    });

    it('cite le pilier quand il a gardé pour lui la vraie réponse du désigné (Devine ma réponse)', () => {
        const withLeader = [card('alice', 'bob', 'Pizza'), card('bob', 'pilier', 'Pizzas'), card('pilier', 'alice', 'Sushi')];
        expect(getSimilarityComparison(withLeader, 0)).toMatchObject({ comparedIndex: 1, holderId: 'pilier' });
    });

    it("signale une vraie réponse posée devant personne (holderId vide)", () => {
        const unassigned = [card('alice', 'bob', 'Pizza'), card('bob', '', 'Pizzas')];
        expect(getSimilarityComparison(unassigned, 0)).toMatchObject({ comparedIndex: 1, holderId: '' });
    });

    it('rien à comparer : carte bien attribuée, ciblage "Personne", index hors bornes', () => {
        expect(getSimilarityComparison([card('alice', 'alice', 'Pizza')], 0)).toBeNull();
        expect(getSimilarityComparison([card('alice', '', 'Pizza'), card('bob', 'alice', 'Pizza')], 0)).toBeNull();
        expect(getSimilarityComparison(results, 7)).toBeNull();
    });
});

describe('isSimilarityCandidate', () => {
    it('vrai si la carte mal attribuée ressemble à la carte comparée', () => {
        const results = [card('alice', 'bob', 'Pizza'), card('bob', 'charlie', 'Pizzas'), card('charlie', 'alice', 'Hamburger')];
        expect(isSimilarityCandidate(results, 0)).toBe(true);
        // Charlie a reçu « Pizzas » mais avait écrit « Hamburger » : rien à voir.
        expect(isSimilarityCandidate(results, 1)).toBe(false);
    });

    it("faux pour une carte déjà correcte (bien attribuée ou déjà corrigée)", () => {
        expect(isSimilarityCandidate([card('alice', 'alice', 'Pizza'), card('bob', 'bob', 'Pizza')], 0)).toBe(false);
        const corrected = [{ ...card('alice', 'bob', 'Pizza'), correct: true }, card('bob', 'charlie', 'Pizza')];
        expect(isSimilarityCandidate(corrected, 0)).toBe(false);
    });

    it('jamais sur une réponse automatique (joueur qui n’a pas répondu)', () => {
        const auto = formatNoResponse('bob', 'timeout');
        expect(isSimilarityCandidate([card('alice', 'bob', auto), card('bob', 'charlie', auto)], 0)).toBe(false);
    });
});

/** Manche en REVEAL : Alice et Bob ont écrit pizza, Charlie hamburger, cartes tournées d'un cran. */
function revealWithSimilarity() {
    const lobby = TestHelper.createLobbyWithPlayers(['Alice', 'Bob', 'Charlie']);
    const [host, alice, bob, charlie] = lobby.players;
    lobby.excludedLeaderIds = [alice.id, bob.id, charlie.id]; // pilier = l'hôte
    const game = GameManager.createGame(lobby);
    lobby.game = game;
    game.nextRound();
    const round = game.currentRound as Round;
    expect(round.leader.id).toBe(host.id);
    round.addAnswer(alice.id, 'Pizza');
    round.addAnswer(bob.id, 'Pizzas');
    round.addAnswer(charlie.id, 'Hamburger');
    round.submitGuesses({ [alice.id]: bob.id, [bob.id]: charlie.id, [charlie.id]: alice.id });
    round.phase = RoundPhase.REVEAL;
    const results = () => buildRevealResults(lobby, round);
    const indexOf = (authorId: string) => results().findIndex(r => r.playerId === authorId);
    return { lobby, game, round, results, indexOf, host, alice, bob, charlie };
}

describe('arbitrage serveur (onCardRevealed / resolveSimilarity)', () => {
    it("ouvre l'arbitrage sur la carte candidate, et seulement elle", () => {
        const { round, results, indexOf, alice, charlie } = revealWithSimilarity();
        expect(onCardRevealed(round, results(), indexOf(charlie.id))).toEqual({ dropped: null, opened: false });
        expect(round.pendingSimilarityIndex).toBeNull();
        expect(onCardRevealed(round, results(), indexOf(alice.id))).toEqual({ dropped: null, opened: true });
        expect(round.pendingSimilarityIndex).toBe(indexOf(alice.id));
    });

    it('« Oui » : correction + 1 point, une seule fois même en double clic', () => {
        const { round, results, indexOf, host, alice } = revealWithSimilarity();
        const i = indexOf(alice.id);
        onCardRevealed(round, results(), i);
        const before = round.scores[host.id] ?? 0;

        expect(resolveSimilarity(round, results(), i, true)).toBe('confirmed');
        expect(round.similarityCorrections).toEqual([i]);
        expect(round.pendingSimilarityIndex).toBeNull();
        expect(round.scores[host.id]).toBe(before + 1);

        expect(resolveSimilarity(round, results(), i, true)).toBe('stale');
        expect(round.scores[host.id]).toBe(before + 1);
        expect(results()[i].correct).toBe(true);
    });

    it('« Non » : aucune correction, aucun point', () => {
        const { round, results, indexOf, host, alice } = revealWithSimilarity();
        const i = indexOf(alice.id);
        onCardRevealed(round, results(), i);
        expect(resolveSimilarity(round, results(), i, false)).toBe('dismissed');
        expect(round.similarityCorrections).toEqual([]);
        expect(round.pendingSimilarityIndex).toBeNull();
        expect(round.scores[host.id] ?? 0).toBe(0);
    });

    it("une décision sur une carte qui n'attend rien est sans effet (client désynchronisé)", () => {
        const { round, results, indexOf, alice, bob } = revealWithSimilarity();
        expect(resolveSimilarity(round, results(), indexOf(alice.id), true)).toBe('stale');
        onCardRevealed(round, results(), indexOf(alice.id));
        expect(resolveSimilarity(round, results(), indexOf(bob.id), true)).toBe('stale');
        expect(round.pendingSimilarityIndex).toBe(indexOf(alice.id));
        expect(round.similarityCorrections).toEqual([]);
    });

    it("ne donne jamais de point sur une paire que le serveur ne juge pas similaire", () => {
        const { round, results, indexOf, host, bob } = revealWithSimilarity();
        // Client trafiqué / état forcé : « Pizzas » devant Charlie, qui avait écrit « Hamburger ».
        round.pendingSimilarityIndex = indexOf(bob.id);
        expect(resolveSimilarity(round, results(), indexOf(bob.id), true)).toBe('dismissed');
        expect(round.scores[host.id] ?? 0).toBe(0);
        expect(round.similarityCorrections).toEqual([]);
    });

    it('révéler une autre carte sans trancher vaut « Non » (jamais de table bloquée)', () => {
        const { round, results, indexOf, alice, charlie } = revealWithSimilarity();
        onCardRevealed(round, results(), indexOf(alice.id));
        expect(onCardRevealed(round, results(), indexOf(charlie.id))).toEqual({ dropped: indexOf(alice.id), opened: false });
        expect(round.pendingSimilarityIndex).toBeNull();
        expect(round.similarityCorrections).toEqual([]);
    });
});

describe('diffusion et synchro de l’arbitrage', () => {
    it("n'expose l'attente et les corrections qu'en REVEAL", () => {
        const { round, results, indexOf, alice } = revealWithSimilarity();
        onCardRevealed(round, results(), indexOf(alice.id));
        expect(serializeRound(round)).toMatchObject({ pendingSimilarityIndex: indexOf(alice.id), similarityCorrections: [] });

        round.phase = RoundPhase.GUESSING;
        expect(serializeRound(round)).toMatchObject({ pendingSimilarityIndex: null, similarityCorrections: [] });
    });

    it("l'empreinte suit l'attente et les corrections, et ne change pas sans similarité", () => {
        const base = { status: GameStatus.IN_PROGRESS, currentRound: { roundNumber: 2, phase: RoundPhase.REVEAL, revealedIndices: [0, 1] } };
        const legacy = gameFingerprint(base);
        expect(gameFingerprint({ ...base, currentRound: { ...base.currentRound, pendingSimilarityIndex: null, similarityCorrections: [] } })).toBe(legacy);

        const pending = gameFingerprint({ ...base, currentRound: { ...base.currentRound, pendingSimilarityIndex: 1, similarityCorrections: [] } });
        const corrected = gameFingerprint({ ...base, currentRound: { ...base.currentRound, pendingSimilarityIndex: null, similarityCorrections: [1] } });
        const otherPending = gameFingerprint({ ...base, currentRound: { ...base.currentRound, pendingSimilarityIndex: 0, similarityCorrections: [] } });
        expect(new Set([legacy, pending, corrected, otherPending]).size).toBe(4);
    });
});
