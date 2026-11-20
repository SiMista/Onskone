import { describe, it, expect, beforeEach } from '@jest/globals';
import { LoginGuard } from '../src/utils/loginGuard';

const MIN = 60 * 1000;

describe('LoginGuard', () => {
    let now: number;
    let guard: LoginGuard;

    beforeEach(() => {
        now = 1_000_000;
        guard = new LoginGuard({
            freeFailures: 3,
            baseLockMs: MIN,
            maxLockMs: 8 * MIN,
            forgetAfterMs: 60 * MIN,
            globalMaxFailures: 50,
            globalWindowMs: 60 * MIN,
            now: () => now,
        });
    });

    const fail = (ip: string, n = 1) => { for (let i = 0; i < n; i++) guard.recordFailure(ip); };

    it('laisse les premiers échecs passer, puis verrouille', () => {
        fail('a', 3);
        expect(guard.check('a').allowed).toBe(true);
        fail('a');
        const c = guard.check('a');
        expect(c.allowed).toBe(false);
        if (!c.allowed) {
            expect(c.reason).toBe('ip');
            expect(c.retryAfterMs).toBe(MIN);
        }
    });

    it('double le verrou à chaque échec, sans dépasser le plafond', () => {
        fail('a', 4); // 1 min
        fail('a');    // 2 min
        let c = guard.check('a');
        expect(!c.allowed && c.retryAfterMs).toBe(2 * MIN);
        fail('a', 10);
        c = guard.check('a');
        expect(!c.allowed && c.retryAfterMs).toBe(8 * MIN);
    });

    it('le verrou expire, et une autre IP n\'est pas touchée', () => {
        fail('a', 4);
        expect(guard.check('b').allowed).toBe(true);
        now += MIN;
        expect(guard.check('a').allowed).toBe(true);
    });

    it('un succès efface l\'ardoise de l\'IP', () => {
        fail('a', 3);
        guard.recordSuccess('a');
        fail('a', 3);
        expect(guard.check('a').allowed).toBe(true);
    });

    it('oublie une IP restée calme assez longtemps', () => {
        fail('a', 3);
        now += 61 * MIN;
        fail('a');
        expect(guard.check('a').allowed).toBe(true);
    });

    it('ferme le login pour tous au-delà du plafond global (attaque distribuée)', () => {
        for (let i = 0; i < 50; i++) fail(`ip${i}`);
        const c = guard.check('innocent');
        expect(c.allowed).toBe(false);
        if (!c.allowed) expect(c.reason).toBe('global');
        now += 60 * MIN + 1;
        expect(guard.check('innocent').allowed).toBe(true);
    });

    it('borne la mémoire des IP suivies', () => {
        const small = new LoginGuard({
            freeFailures: 0, baseLockMs: MIN, maxLockMs: MIN, forgetAfterMs: MIN,
            globalMaxFailures: 1e9, globalWindowMs: MIN, maxTrackedIps: 5, now: () => now,
        });
        for (let i = 0; i < 20; i++) small.recordFailure(`ip${i}`);
        expect((small as unknown as { ips: Map<string, unknown> }).ips.size).toBeLessThanOrEqual(5);
    });
});
