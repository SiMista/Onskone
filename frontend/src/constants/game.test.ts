import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GAME_CONSTANTS, RoundPhase } from '@onskone/shared';
import { getPhaseDuration, getCategoryColor, CATEGORY_COLORS } from './game';

describe('getCategoryColor', () => {
  it('maps known categories to their exact hex', () => {
    expect(getCategoryColor('ICEBREAKERS')).toBe(CATEGORY_COLORS.ICEBREAKERS);
    expect(getCategoryColor('FUN')).toBe(CATEGORY_COLORS.FUN);
    expect(getCategoryColor('DEEP')).toBe(CATEGORY_COLORS.DEEP);
  });

  it('falls back to the default grey for unknown categories', () => {
    const fallback = getCategoryColor('__UNKNOWN__');
    expect(fallback).toBe('#9ca3af');
    expect(Object.values(CATEGORY_COLORS)).not.toContain(fallback);
  });

  it('falls back for an empty string', () => {
    expect(getCategoryColor('')).toBe('#9ca3af');
  });
});

describe('getPhaseDuration', () => {
  // NB: DEBUG_MODE is resolved at module load. In `vitest run` there is no
  // `?debug=1` in the jsdom URL and no VITE_DEBUG_MODE, so DEBUG_MODE is false
  // and these durations reflect the real (non-debug) timers.

  it('returns the base timer for a fixed phase at the default multiplier', () => {
    expect(getPhaseDuration(RoundPhase.QUESTION_SELECTION)).toBe(
      GAME_CONSTANTS.TIMERS.QUESTION_SELECTION,
    );
    expect(getPhaseDuration(RoundPhase.ANSWERING)).toBe(GAME_CONSTANTS.TIMERS.ANSWERING);
  });

  it('scales fixed phases by the time multiplier and rounds', () => {
    // Mirror the implementation's exact IEEE-754 rounding rather than hand-math:
    // 45 * 0.7 = 31.4999... -> Math.round -> 31; 45 * 1.3 = 58.5 -> 59.
    expect(getPhaseDuration(RoundPhase.QUESTION_SELECTION, 0.7)).toBe(
      Math.round(GAME_CONSTANTS.TIMERS.QUESTION_SELECTION * 0.7),
    );
    expect(getPhaseDuration(RoundPhase.QUESTION_SELECTION, 1.3)).toBe(
      Math.round(GAME_CONSTANTS.TIMERS.QUESTION_SELECTION * 1.3),
    );
    // Sanity-check the concrete values too.
    expect(getPhaseDuration(RoundPhase.QUESTION_SELECTION, 0.7)).toBe(31);
    expect(getPhaseDuration(RoundPhase.QUESTION_SELECTION, 1.3)).toBe(59);
  });

  it('clamps a NaN multiplier back to the default (no scaling)', () => {
    expect(getPhaseDuration(RoundPhase.ANSWERING, NaN)).toBe(GAME_CONSTANTS.TIMERS.ANSWERING);
  });

  it('clamps an out-of-range multiplier to the allowed levels', () => {
    const levels = GAME_CONSTANTS.TIME_MULTIPLIER_LEVELS;
    const max = levels[levels.length - 1];
    const min = levels[0];
    // 1000 clamps down to the max level (1.3).
    expect(getPhaseDuration(RoundPhase.ANSWERING, 1000)).toBe(
      Math.round(GAME_CONSTANTS.TIMERS.ANSWERING * max),
    );
    // 0 clamps up to the min level (0.7).
    expect(getPhaseDuration(RoundPhase.ANSWERING, 0)).toBe(
      Math.round(GAME_CONSTANTS.TIMERS.ANSWERING * min),
    );
  });

  it('never returns less than 1 second', () => {
    expect(getPhaseDuration(RoundPhase.REVEAL)).toBe(1); // base 0 -> floored to 1.
  });

  it('computes GUESSING dynamically: base at 3 players', () => {
    expect(getPhaseDuration(RoundPhase.GUESSING, 1, 3)).toBe(120);
  });

  it('adds 20s per extra player above 3 for GUESSING', () => {
    // 120 + (6 - 3) * 20 = 180.
    expect(getPhaseDuration(RoundPhase.GUESSING, 1, 6)).toBe(180);
  });

  it('does not subtract time for GUESSING below 3 players', () => {
    expect(getPhaseDuration(RoundPhase.GUESSING, 1, 1)).toBe(120);
  });
});

describe('getServerUrl (via SERVER_URL on fresh module load)', () => {
  // getServerUrl is module-private and computed once into SERVER_URL. We stub the
  // relevant globals and re-import the module so the export reflects each branch.
  const originalLocation = window.location;

  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  function setHostname(hostname: string, origin: string) {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, hostname, origin, search: '' },
    });
  }

  it('prefers VITE_SERVER_URL when defined (native/Capacitor branch)', async () => {
    vi.stubEnv('VITE_SERVER_URL', 'https://api.onskone.example');
    setHostname('whatever', 'https://whatever');
    const mod = await import('./game');
    expect(mod.SERVER_URL).toBe('https://api.onskone.example');
  });

  it('uses the local backend port for a localhost hostname', async () => {
    vi.stubEnv('VITE_SERVER_URL', '');
    setHostname('localhost', 'http://localhost:3000');
    const mod = await import('./game');
    expect(mod.SERVER_URL).toBe('http://localhost:8080');
  });

  it('uses the local backend port for a 192.168.x.x LAN hostname', async () => {
    vi.stubEnv('VITE_SERVER_URL', '');
    setHostname('192.168.1.42', 'http://192.168.1.42:3000');
    const mod = await import('./game');
    expect(mod.SERVER_URL).toBe('http://192.168.1.42:8080');
  });

  it('uses the local backend port for 127.0.0.1', async () => {
    vi.stubEnv('VITE_SERVER_URL', '');
    setHostname('127.0.0.1', 'http://127.0.0.1:3000');
    const mod = await import('./game');
    expect(mod.SERVER_URL).toBe('http://127.0.0.1:8080');
  });

  it('falls back to window.location.origin in production', async () => {
    vi.stubEnv('VITE_SERVER_URL', '');
    setHostname('onskone.com', 'https://onskone.com');
    const mod = await import('./game');
    expect(mod.SERVER_URL).toBe('https://onskone.com');
  });
});
