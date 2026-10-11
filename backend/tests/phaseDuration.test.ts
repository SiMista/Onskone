import { describe, it, expect } from '@jest/globals';
import {
  getPhaseDuration,
  getBasePhaseDuration,
  isGameSpeed,
  RoundPhase,
  GAME_CONSTANTS,
} from '@onskone/shared';
import type { GameSpeed } from '@onskone/shared';
import { speedFromLegacyMultiplier, legacyMultiplierFromSpeed } from '../src/utils/legacyTimeMultiplier';

const T = GAME_CONSTANTS.TIMERS;

describe('getBasePhaseDuration', () => {
  it('returns the fixed durations of the requested speed', () => {
    for (const speed of ['normal', 'fast'] as GameSpeed[]) {
      expect(getBasePhaseDuration(RoundPhase.QUESTION_SELECTION, 3, speed)).toBe(T[speed].QUESTION_SELECTION);
      expect(getBasePhaseDuration(RoundPhase.SUBSTITUTE_SELECTION, 3, speed)).toBe(T[speed].SUBSTITUTE_SELECTION);
      expect(getBasePhaseDuration(RoundPhase.ANSWERING, 3, speed)).toBe(T[speed].ANSWERING);
      expect(getBasePhaseDuration(RoundPhase.SUBSTITUTE_ANSWERING, 3, speed)).toBe(T[speed].SUBSTITUTE_ANSWERING);
    }
  });

  it('returns 0 for REVEAL (no timer)', () => {
    expect(getBasePhaseDuration(RoundPhase.REVEAL, 3)).toBe(0);
  });

  it('adds GUESSING_EXTRA_PER_PLAYER beyond 3 players, per speed', () => {
    for (const speed of ['normal', 'fast'] as GameSpeed[]) {
      const { GUESSING, GUESSING_EXTRA_PER_PLAYER: extra } = T[speed];
      expect(getBasePhaseDuration(RoundPhase.GUESSING, 3, speed)).toBe(GUESSING);
      expect(getBasePhaseDuration(RoundPhase.GUESSING, 5, speed)).toBe(GUESSING + 2 * extra);
      expect(getBasePhaseDuration(RoundPhase.GUESSING, 10, speed)).toBe(GUESSING + 7 * extra);
    }
  });

  it('never reduces GUESSING below the base for fewer than 3 players', () => {
    expect(getBasePhaseDuration(RoundPhase.GUESSING, 2)).toBe(T.normal.GUESSING);
  });

  it('defaults to the normal speed', () => {
    expect(GAME_CONSTANTS.GAME_SPEED_DEFAULT).toBe('normal');
    expect(getBasePhaseDuration(RoundPhase.ANSWERING, 3)).toBe(T.normal.ANSWERING);
  });

  it('falls back to the default speed for an unknown value', () => {
    expect(getBasePhaseDuration(RoundPhase.ANSWERING, 3, 'turbo' as GameSpeed)).toBe(T.normal.ANSWERING);
  });
});

describe('fast speed', () => {
  it('is never slower than normal', () => {
    for (const phase of [
      RoundPhase.QUESTION_SELECTION,
      RoundPhase.SUBSTITUTE_SELECTION,
      RoundPhase.ANSWERING,
      RoundPhase.SUBSTITUTE_ANSWERING,
      RoundPhase.GUESSING,
    ]) {
      for (const players of [3, 8, GAME_CONSTANTS.MAX_PLAYERS]) {
        expect(getPhaseDuration(phase, 'fast', players)).toBeLessThanOrEqual(getPhaseDuration(phase, 'normal', players));
      }
    }
  });
});

describe('isGameSpeed', () => {
  it('accepts the known speeds (debug included, filtered server-side)', () => {
    expect(isGameSpeed('fast')).toBe(true);
    expect(isGameSpeed('normal')).toBe(true);
    expect(isGameSpeed('debug')).toBe(true);
  });
  it('rejects anything else', () => {
    expect(isGameSpeed('slow')).toBe(false);
    expect(isGameSpeed(1)).toBe(false);
    expect(isGameSpeed(undefined)).toBe(false);
    expect(isGameSpeed('toString')).toBe(false); // pas de fuite par le prototype
  });
});

describe('getPhaseDuration', () => {
  it('uses the current normal values', () => {
    expect(getPhaseDuration(RoundPhase.QUESTION_SELECTION, 'normal', 3)).toBe(45);
    expect(getPhaseDuration(RoundPhase.ANSWERING, 'normal', 3)).toBe(110);
    expect(getPhaseDuration(RoundPhase.GUESSING, 'normal', 3)).toBe(100);
    // 100 + (8 - 3) * 15 = 175.
    expect(getPhaseDuration(RoundPhase.GUESSING, 'normal', 8)).toBe(175);
  });

  it('floors any timerless phase at 1 second', () => {
    expect(getPhaseDuration(RoundPhase.REVEAL, 'normal', 3)).toBe(1);
    expect(getPhaseDuration(RoundPhase.REVEAL, 'fast', 8)).toBe(1);
  });

  it('defaults speed to normal and playerCount to 3 when omitted', () => {
    expect(getPhaseDuration(RoundPhase.GUESSING)).toBe(T.normal.GUESSING);
  });
});

describe('legacy time multiplier bridge', () => {
  it('maps old multipliers to a speed', () => {
    expect(speedFromLegacyMultiplier(0.7)).toBe('fast');
    expect(speedFromLegacyMultiplier(1)).toBe('normal');
    // L'ancien niveau "Longue" n'existe plus : il retombe sur normal.
    expect(speedFromLegacyMultiplier(1.3)).toBe('normal');
    expect(speedFromLegacyMultiplier(30)).toBe('debug');
    expect(speedFromLegacyMultiplier(NaN)).toBe('normal');
    expect(speedFromLegacyMultiplier('n/a')).toBe('normal');
  });

  it('round-trips every speed', () => {
    for (const speed of ['fast', 'normal', 'debug'] as GameSpeed[]) {
      expect(speedFromLegacyMultiplier(legacyMultiplierFromSpeed(speed))).toBe(speed);
    }
  });
});
