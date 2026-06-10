import { describe, it, expect } from 'vitest';
import type { IPlayer, IRound, LeaderboardEntry } from '@onskone/shared';
import { RoundPhase } from '@onskone/shared';
import { computeTeamPct } from './playerStats';

/** Minimal valid IPlayer for building leaderboard/round fixtures. */
function makePlayer(id: string, overrides: Partial<IPlayer> = {}): IPlayer {
  return {
    id,
    socketId: `socket-${id}`,
    name: id,
    isHost: false,
    isActive: true,
    avatarId: 0,
    ...overrides,
  };
}

function makeEntry(id: string, score: number): LeaderboardEntry {
  return { player: makePlayer(id), score };
}

/** Minimal valid IRound; `answers` size drives the denominator. */
function makeRound(overrides: Partial<IRound> = {}): IRound {
  return {
    roundNumber: 1,
    leader: makePlayer('leader'),
    gameCard: { category: 'FUN', theme: 'T', subject: 'S', questions: ['q'] },
    phase: RoundPhase.REVEAL,
    selectedQuestion: 'q',
    answers: {},
    scores: {},
    revealedIndices: [],
    guessMyAnswerMode: false,
    ...overrides,
  };
}

describe('computeTeamPct', () => {
  it('returns 0 for empty leaderboard', () => {
    expect(computeTeamPct([], [makeRound()])).toBe(0);
  });

  it('returns 0 for empty rounds', () => {
    expect(computeTeamPct([makeEntry('a', 5)], [])).toBe(0);
  });

  it('returns 0 when both empty', () => {
    expect(computeTeamPct([], [])).toBe(0);
  });

  it('computes percentage for a full lobby with a stable roster (classic mode)', () => {
    // 3 players answer each of 2 rounds -> pool of 3 per round -> 6 possible.
    // Team scored 3 across the game -> 3/6 = 50%.
    const leaderboard = [makeEntry('a', 1), makeEntry('b', 1), makeEntry('c', 1)];
    const answers = { a: 'x', b: 'y', c: 'z' };
    const rounds = [
      makeRound({ roundNumber: 1, answers }),
      makeRound({ roundNumber: 2, answers }),
    ];
    expect(computeTeamPct(leaderboard, rounds)).toBe(50);
  });

  it('rounds to the nearest integer', () => {
    // scored 1 over a pool of 3 -> 33.33% -> rounds to 33.
    const leaderboard = [makeEntry('a', 1)];
    const rounds = [makeRound({ answers: { a: 'x', b: 'y', c: 'z' } })];
    expect(computeTeamPct(leaderboard, rounds)).toBe(33);
  });

  it('treats ties (equal scores) purely additively', () => {
    // Tie does not matter: only the sum of scores counts.
    const leaderboard = [makeEntry('a', 2), makeEntry('b', 2)];
    const rounds = [makeRound({ answers: { a: 'x', b: 'y', c: 'z', d: 'w' } })];
    // 4 scored / 4 pool = 100.
    expect(computeTeamPct(leaderboard, rounds)).toBe(100);
  });

  it('adds the pilier (substitute) entry to the pool in guessMyAnswerMode', () => {
    // 2 player answers + 1 substitute entry -> pool of 3.
    const leaderboard = [makeEntry('a', 3)];
    const rounds = [
      makeRound({
        answers: { a: 'x', b: 'y' },
        guessMyAnswerMode: true,
        substituteAnswer: 'pilier answer',
      }),
    ];
    // 3 scored / 3 pool = 100.
    expect(computeTeamPct(leaderboard, rounds)).toBe(100);
  });

  it('does NOT add the pilier entry when guessMyAnswerMode but substituteAnswer is missing', () => {
    const leaderboard = [makeEntry('a', 1)];
    const rounds = [
      makeRound({
        answers: { a: 'x', b: 'y' },
        guessMyAnswerMode: true,
        substituteAnswer: null,
      }),
    ];
    // pool of 2 (no substitute entry) -> 1/2 = 50.
    expect(computeTeamPct(leaderboard, rounds)).toBe(50);
  });

  it('does NOT add the pilier entry when substituteAnswer is present but mode is off', () => {
    const leaderboard = [makeEntry('a', 1)];
    const rounds = [
      makeRound({
        answers: { a: 'x', b: 'y' },
        guessMyAnswerMode: false,
        substituteAnswer: 'leftover',
      }),
    ];
    expect(computeTeamPct(leaderboard, rounds)).toBe(50);
  });

  it('clamps the result to 100 when score exceeds the pool', () => {
    const leaderboard = [makeEntry('a', 999)];
    const rounds = [makeRound({ answers: { a: 'x', b: 'y' } })];
    expect(computeTeamPct(leaderboard, rounds)).toBe(100);
  });

  it('clamps the result to 0 for a negative aggregate score', () => {
    const leaderboard = [makeEntry('a', -10), makeEntry('b', 1)];
    const rounds = [makeRound({ answers: { a: 'x', b: 'y', c: 'z' } })];
    expect(computeTeamPct(leaderboard, rounds)).toBe(0);
  });

  it('returns 0 (no division by zero) when every round has an empty pool', () => {
    const leaderboard = [makeEntry('a', 5)];
    const rounds = [makeRound({ answers: {} }), makeRound({ answers: {} })];
    expect(computeTeamPct(leaderboard, rounds)).toBe(0);
  });

  it('handles a round whose answers field is undefined without throwing', () => {
    const leaderboard = [makeEntry('a', 1)];
    // Force `answers` undefined to exercise the `?? {}` guard.
    const round = makeRound();
    (round as { answers?: Record<string, string> }).answers = undefined;
    expect(computeTeamPct(leaderboard, [round])).toBe(0);
  });
});
