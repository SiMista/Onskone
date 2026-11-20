import { describe, it, expect, afterAll } from '@jest/globals';
import { DRAWING_IDEA_IDS, DRAWING_PORTRAIT_EVERY, DRAWING_PORTRAIT_ID } from '@onskone/shared';
import { DrawingIdeaPicker } from '../src/utils/drawingIdeas';
import { TestHelper } from '../src/utils/TestHelper';
import * as GameManager from '../src/managers/GameManager';
import { stopAllRateLimiters } from '../src/utils/rateLimiter';

const players = ['a', 'b', 'c'];

describe('DrawingIdeaPicker', () => {
    const game = (rounds: number, picker = new DrawingIdeaPicker()) =>
        Array.from({ length: rounds }, (_, i) => picker.pick(i + 1, players, rounds));
    const portraitRounds = (rounds: number) =>
        game(rounds).flatMap((p, i) => (p.id === DRAWING_PORTRAIT_ID ? [i + 1] : []));

    it('exactement un portrait par tranche de DRAWING_PORTRAIT_EVERY manches', () => {
        for (let n = 0; n < 50; n++) {
            const rounds = portraitRounds(12);
            expect(rounds).toHaveLength(12 / DRAWING_PORTRAIT_EVERY);
            rounds.forEach((r, block) => {
                expect(r).toBeGreaterThan(block * DRAWING_PORTRAIT_EVERY);
                expect(r).toBeLessThanOrEqual((block + 1) * DRAWING_PORTRAIT_EVERY);
            });
        }
    });

    it("le portrait n'est pas toujours à la 1re manche", () => {
        const firsts = new Set(Array.from({ length: 200 }, () => portraitRounds(8)[0]));
        expect(firsts.size).toBeGreaterThan(1);
    });

    it('une partie courte a quand même son portrait, dans ses manches', () => {
        for (let n = 0; n < 100; n++) {
            const rounds = portraitRounds(3);
            expect(rounds).toHaveLength(1);
            expect(rounds[0]).toBeLessThanOrEqual(3);
        }
    });

    it('chaque joueur passe en portrait avant que quelqu\'un y repasse', () => {
        const picker = new DrawingIdeaPicker();
        const portraits = Array.from({ length: players.length * DRAWING_PORTRAIT_EVERY }, (_, i) => picker.pick(i + 1, players))
            .filter(p => p.id === DRAWING_PORTRAIT_ID)
            .map(p => p.playerId);
        expect([...portraits].sort()).toEqual(players);
    });

    it('ne dessine jamais un joueur qui n\'est plus là', () => {
        const picker = new DrawingIdeaPicker();
        const total = 2 * DRAWING_PORTRAIT_EVERY;
        // 1re tranche avec a/b/c, puis tout le monde est parti sauf z.
        for (let r = 1; r <= DRAWING_PORTRAIT_EVERY; r++) picker.pick(r, players, total);
        const later = Array.from({ length: DRAWING_PORTRAIT_EVERY }, (_, i) => picker.pick(DRAWING_PORTRAIT_EVERY + 1 + i, ['z'], total))
            .filter(p => p.id === DRAWING_PORTRAIT_ID);
        expect(later.map(p => p.playerId)).toEqual(['z']);
    });

    it('pas de redite tant que toutes les idées simples ne sont pas passées', () => {
        const picker = new DrawingIdeaPicker();
        const simple: string[] = [];
        for (let r = 1; simple.length < DRAWING_IDEA_IDS.length; r++) {
            const p = picker.pick(r, players);
            if (p.id !== DRAWING_PORTRAIT_ID) simple.push(p.id);
        }
        expect(new Set(simple).size).toBe(DRAWING_IDEA_IDS.length);
    });

    it('sans joueur, pas de portrait (idée simple à la place)', () => {
        expect(new DrawingIdeaPicker().pick(1, []).id).not.toBe(DRAWING_PORTRAIT_ID);
    });
});

describe('portrait tiré par Game', () => {
    afterAll(() => stopAllRateLimiters());

    it("ne met jamais en scène un joueur parti en cours de partie", () => {
        let portraits = 0;
        const departedDrawn: string[] = [];
        for (let n = 0; n < 50; n++) {
            const lobby = TestHelper.createLobbyWithPlayers(['Bob', 'Carla', 'Dan', 'Eve']);
            const game = GameManager.createGame(lobby);
            lobby.game = game;
            // Parti pendant la partie : gardé dans le salon, mais inactif.
            const bob = lobby.players.find(p => p.name === 'Bob')!;
            bob.isActive = false;
            while (!game.isGameOver()) {
                game.nextRound();
                const idea = game.currentRound!.drawingIdea;
                if (idea?.id !== DRAWING_PORTRAIT_ID) continue;
                portraits++;
                if (idea.playerId === bob.id) departedDrawn.push(idea.playerId);
            }
        }
        expect(portraits).toBeGreaterThan(0);
        expect(departedDrawn).toEqual([]);
    });
});
