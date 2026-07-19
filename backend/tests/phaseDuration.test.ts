import { describe, it, expect } from '@jest/globals';
import {
  getPhaseDuration,
  getBasePhaseDuration,
  clampTimeMultiplier,
  RoundPhase,
  GAME_CONSTANTS,
} from '@onskone/shared';

const T = GAME_CONSTANTS.TIMERS;

describe('getBasePhaseDuration', () => {
  it('returns the fixed base for non-GUESSING timed phases', () => {
    expect(getBasePhaseDuration(RoundPhase.QUESTION_SELECTION, 3)).toBe(T.QUESTION_SELECTION);
    expect(getBasePhaseDuration(RoundPhase.SUBSTITUTE_SELECTION, 3)).toBe(T.SUBSTITUTE_SELECTION);
    expect(getBasePhaseDuration(RoundPhase.ANSWERING, 3)).toBe(T.ANSWERING);
    expect(getBasePhaseDuration(RoundPhase.SUBSTITUTE_ANSWERING, 3)).toBe(T.SUBSTITUTE_ANSWERING);
  });

  it('returns 0 for phases without a timer (REVEAL)', () => {
    expect(getBasePhaseDuration(RoundPhase.REVEAL, 3)).toBe(0);
  });

  it('scales GUESSING by GUESSING_EXTRA_PER_PLAYER beyond 3 players', () => {
    const extra = GAME_CONSTANTS.GUESSING_EXTRA_PER_PLAYER;
    expect(getBasePhaseDuration(RoundPhase.GUESSING, 3)).toBe(T.GUESSING);
    expect(getBasePhaseDuration(RoundPhase.GUESSING, 5)).toBe(T.GUESSING + 2 * extra);
    expect(getBasePhaseDuration(RoundPhase.GUESSING, 10)).toBe(T.GUESSING + 7 * extra);
  });

  it('never reduces GUESSING below the base for fewer than 3 players', () => {
    expect(getBasePhaseDuration(RoundPhase.GUESSING, 2)).toBe(T.GUESSING);
  });
});

describe('clampTimeMultiplier', () => {
  const levels = GAME_CONSTANTS.TIME_MULTIPLIER_LEVELS;
  it('clamps into the allowed range', () => {
    expect(clampTimeMultiplier(0.1)).toBe(levels[0]);
    expect(clampTimeMultiplier(9)).toBe(levels[levels.length - 1]);
    expect(clampTimeMultiplier(1)).toBe(1);
  });
  it('falls back to the default for non-finite input (NaN / Infinity)', () => {
    expect(clampTimeMultiplier(NaN)).toBe(GAME_CONSTANTS.TIME_MULTIPLIER_DEFAULT);
    expect(clampTimeMultiplier(Infinity)).toBe(GAME_CONSTANTS.TIME_MULTIPLIER_DEFAULT);
  });
});

describe('getPhaseDuration', () => {
  it('applies the base durations at the default multiplier', () => {
    expect(getPhaseDuration(RoundPhase.QUESTION_SELECTION, 1, 3)).toBe(45);
    expect(getPhaseDuration(RoundPhase.ANSWERING, 1, 3)).toBe(120);
    expect(getPhaseDuration(RoundPhase.GUESSING, 1, 3)).toBe(120);
  });

  it('combines the GUESSING per-player rule with the multiplier', () => {
    // base 5 players = 160, *1.3 = 208
    expect(getPhaseDuration(RoundPhase.GUESSING, 1, 5)).toBe(160);
    expect(getPhaseDuration(RoundPhase.GUESSING, 1.3, 5)).toBe(Math.round(160 * 1.3));
  });

  it('rounds the multiplied duration and clamps the multiplier', () => {
    expect(getPhaseDuration(RoundPhase.ANSWERING, 0.7, 3)).toBe(Math.round(120 * 0.7)); // 84
    expect(getPhaseDuration(RoundPhase.ANSWERING, 1.3, 3)).toBe(Math.round(120 * 1.3)); // 156
    // Out-of-range multiplier is clamped to 1.3 before applying.
    expect(getPhaseDuration(RoundPhase.ANSWERING, 99, 3)).toBe(Math.round(120 * 1.3));
    // NaN multiplier falls back to the default (1).
    expect(getPhaseDuration(RoundPhase.ANSWERING, NaN, 3)).toBe(120);
  });

  it('floors any timerless phase at 1 second', () => {
    expect(getPhaseDuration(RoundPhase.REVEAL, 1, 3)).toBe(1);
    expect(getPhaseDuration(RoundPhase.REVEAL, 1.3, 8)).toBe(1);
  });

  it('defaults playerCount to 3 when omitted', () => {
    expect(getPhaseDuration(RoundPhase.GUESSING)).toBe(120);
  });
});
