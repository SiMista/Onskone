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
  // NB: getPhaseDuration ne court-circuite plus rien en mode debug — la durée fait
  // autorité côté serveur, donc un allongement purement client ne ferait qu'afficher
  // un sablier qui ment. Le mode debug passe désormais par la vitesse de jeu du
  // lobby (DEBUG_GAME_SPEED -> updateGameSpeed), appliquée par le serveur.
  // Ces durées sont donc toujours les durées réelles.
  const T = GAME_CONSTANTS.TIMERS;

  it('returns the normal timers by default', () => {
    expect(getPhaseDuration(RoundPhase.QUESTION_SELECTION)).toBe(T.normal.QUESTION_SELECTION);
    expect(getPhaseDuration(RoundPhase.ANSWERING)).toBe(T.normal.ANSWERING);
  });

  it('returns the fixed timers of the fast speed (no multiplier)', () => {
    expect(getPhaseDuration(RoundPhase.QUESTION_SELECTION, 'fast')).toBe(T.fast.QUESTION_SELECTION);
    expect(getPhaseDuration(RoundPhase.ANSWERING, 'fast')).toBe(T.fast.ANSWERING);
  });

  it('never returns less than 1 second', () => {
    expect(getPhaseDuration(RoundPhase.REVEAL)).toBe(1); // base 0 -> floored to 1.
  });

  it('computes GUESSING dynamically: base at 3 players', () => {
    expect(getPhaseDuration(RoundPhase.GUESSING, 'normal', 3)).toBe(T.normal.GUESSING);
  });

  it('adds GUESSING_EXTRA_PER_PLAYER per extra player above 3 for GUESSING', () => {
    expect(getPhaseDuration(RoundPhase.GUESSING, 'normal', 6)).toBe(
      T.normal.GUESSING + 3 * T.normal.GUESSING_EXTRA_PER_PLAYER,
    );
    expect(getPhaseDuration(RoundPhase.GUESSING, 'fast', 6)).toBe(
      T.fast.GUESSING + 3 * T.fast.GUESSING_EXTRA_PER_PLAYER,
    );
  });

  it('does not subtract time for GUESSING below 3 players', () => {
    expect(getPhaseDuration(RoundPhase.GUESSING, 'normal', 1)).toBe(T.normal.GUESSING);
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
