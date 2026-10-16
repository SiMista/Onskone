import { describe, it, expect } from 'vitest';
import {
  parseAdMemory,
  launchAdSkipReason,
  canShowEndGameAd,
  EMPTY_AD_MEMORY,
  AD_MEMORY_VERSION,
  RETURN_WINDOW_MS,
  AD_MIN_GAP_MS,
  type AdMemory,
  type LaunchContext,
} from './adPolicy';

const NOW = Date.parse('2026-10-16T20:00:00Z');
const MIN = 60 * 1000;

const memory = (o: Partial<AdMemory> = {}): AdMemory => ({
  ...EMPTY_AD_MEMORY,
  launches: 3,
  // Quittée hier soir : vraie ouverture.
  lastSeenAt: NOW - 20 * 60 * MIN,
  lastAdAt: NOW - 20 * 60 * MIN,
  ...o,
});

const launch = (o: Partial<LaunchContext> = {}): LaunchContext => ({
  now: NOW,
  memory: memory(),
  premium: false,
  hasGameToResume: false,
  ...o,
});

describe('parseAdMemory', () => {
  it('repart de zéro sans rien de stocké', () => {
    expect(parseAdMemory(null)).toEqual(EMPTY_AD_MEMORY);
  });

  it('repart de zéro sur un JSON illisible ou une autre version', () => {
    expect(parseAdMemory('{pas du json')).toEqual(EMPTY_AD_MEMORY);
    expect(parseAdMemory(JSON.stringify({ version: 99, launches: 5 }))).toEqual(EMPTY_AD_MEMORY);
    expect(parseAdMemory('null')).toEqual(EMPTY_AD_MEMORY);
  });

  it('relit une mémoire valide', () => {
    const stored = { version: AD_MEMORY_VERSION, launches: 4, lastSeenAt: NOW, lastAdAt: NOW - MIN };
    expect(parseAdMemory(JSON.stringify(stored))).toEqual(stored);
  });

  it('neutralise les champs corrompus sans jeter le reste', () => {
    const stored = { version: AD_MEMORY_VERSION, launches: -2, lastSeenAt: 'hier', lastAdAt: NOW };
    expect(parseAdMemory(JSON.stringify(stored))).toEqual({
      version: AD_MEMORY_VERSION,
      launches: 0,
      lastSeenAt: null,
      lastAdAt: NOW,
    });
  });
});

describe('launchAdSkipReason', () => {
  it('autorise la pub sur une vraie ouverture', () => {
    expect(launchAdSkipReason(launch())).toBeNull();
  });

  it('jamais pour un premium', () => {
    expect(launchAdSkipReason(launch({ premium: true }))).toBe('premium');
  });

  it('jamais au tout premier lancement', () => {
    expect(launchAdSkipReason(launch({ memory: memory({ launches: 0, lastSeenAt: null, lastAdAt: null }) }))).toBe('firstLaunch');
  });

  it('autorise dès le 2e lancement', () => {
    expect(launchAdSkipReason(launch({ memory: memory({ launches: 1 }) }))).toBeNull();
  });

  it("jamais quand une partie est à reprendre (app tuée en pleine partie)", () => {
    expect(launchAdSkipReason(launch({ hasGameToResume: true }))).toBe('gameToResume');
  });


  it("jamais sur un retour rapide (app tuée en arrière-plan pendant un tour sur WhatsApp)", () => {
    expect(launchAdSkipReason(launch({ memory: memory({ lastSeenAt: NOW - 2 * MIN }) }))).toBe('returning');
    expect(launchAdSkipReason(launch({ memory: memory({ lastSeenAt: NOW - RETURN_WINDOW_MS + 1 }) }))).toBe('returning');
  });

  it('autorise à nouveau une fois la fenêtre de retour écoulée', () => {
    expect(launchAdSkipReason(launch({ memory: memory({ lastSeenAt: NOW - RETURN_WINDOW_MS }) }))).toBeNull();
  });

  it("jamais juste après une autre pub", () => {
    expect(launchAdSkipReason(launch({ memory: memory({ lastSeenAt: null, lastAdAt: NOW - MIN }) }))).toBe('recentAd');
  });

  it('le premium prime sur tout le reste', () => {
    expect(launchAdSkipReason(launch({
      premium: true,
      hasGameToResume: true,
      memory: memory({ launches: 0 }),
    }))).toBe('premium');
  });
});

describe('canShowEndGameAd', () => {
  it('autorise sans pub récente', () => {
    expect(canShowEndGameAd({ now: NOW, premium: false, lastAdAt: null })).toBe(true);
    expect(canShowEndGameAd({ now: NOW, premium: false, lastAdAt: NOW - AD_MIN_GAP_MS })).toBe(true);
  });

  it('jamais pour un premium', () => {
    expect(canShowEndGameAd({ now: NOW, premium: true, lastAdAt: null })).toBe(false);
  });

  it("jamais juste après une autre pub", () => {
    expect(canShowEndGameAd({ now: NOW, premium: false, lastAdAt: NOW - MIN })).toBe(false);
  });
});
