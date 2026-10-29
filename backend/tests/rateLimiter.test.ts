import { describe, it, expect, beforeEach, afterEach, afterAll, jest } from '@jest/globals';
import { RateLimiter, stopAllRateLimiters } from '../src/utils/rateLimiter';

// Le module instancie des limiteurs avec setInterval : on les coupe pour que jest sorte proprement.
afterAll(() => stopAllRateLimiters());

describe('RateLimiter', () => {
    let limiter: RateLimiter;

    beforeEach(() => {
        jest.useFakeTimers();
        limiter = new RateLimiter({ windowMs: 1000, maxRequests: 3 });
    });

    afterEach(() => {
        limiter.stop();
        jest.useRealTimers();
    });

    it('laisse passer jusqu\'à la limite puis bloque', () => {
        expect(limiter.isAllowed('a')).toBe(true);
        expect(limiter.isAllowed('a')).toBe(true);
        expect(limiter.isAllowed('a')).toBe(true);
        expect(limiter.isAllowed('a')).toBe(false);
    });

    it('isole les clés entre elles', () => {
        for (let i = 0; i < 3; i++) limiter.isAllowed('a');
        expect(limiter.isAllowed('a')).toBe(false);
        expect(limiter.isAllowed('b')).toBe(true);
    });

    it('repart à zéro une fois la fenêtre écoulée', () => {
        for (let i = 0; i < 3; i++) limiter.isAllowed('a');
        expect(limiter.isAllowed('a')).toBe(false);
        jest.advanceTimersByTime(1001);
        expect(limiter.isAllowed('a')).toBe(true);
    });

    it('multi-clés : bloque si UNE clé est saturée (anti-contournement par reconnexion)', () => {
        for (let i = 0; i < 3; i++) limiter.isAllowed('player-1');
        // Nouveau socket (clé neuve) mais même joueur : refusé.
        expect(limiter.isAllowedMultiple(['socket-2', 'player-1'])).toBe(false);
    });

    it('multi-clés : un refus ne consomme pas le budget des autres clés', () => {
        for (let i = 0; i < 3; i++) limiter.isAllowed('player-1');
        limiter.isAllowedMultiple(['socket-2', 'player-1']); // refusé
        // socket-2 n'a rien consommé : il a toujours ses 3 appels.
        expect(limiter.isAllowed('socket-2')).toBe(true);
        expect(limiter.isAllowed('socket-2')).toBe(true);
        expect(limiter.isAllowed('socket-2')).toBe(true);
    });

    it('stop() vide l\'état', () => {
        for (let i = 0; i < 3; i++) limiter.isAllowed('a');
        limiter.stop();
        expect(limiter.isAllowed('a')).toBe(true);
    });
});
