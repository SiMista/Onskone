import { describe, it, expect } from '@jest/globals';
import { Round } from '../src/models/Round';
import { RoundPhase, IPlayer, GameCard } from '@onskone/shared';

const leader: IPlayer = {
  id: 'leader-1',
  name: 'Leader',
  isHost: true,
  isActive: true,
  avatarId: 0,
};

const card: GameCard = {
  category: 'FUN',
  theme: 'THEME',
  subject: 'Subject',
  questions: ['q1', 'q2', 'q3'],
};

/** Drive nextPhase() until it stops advancing, collecting the phase sequence. */
function walkPhases(round: Round): RoundPhase[] {
  const seq: RoundPhase[] = [round.phase];
  // Cap iterations well above the longest chain to guard against an infinite loop.
  for (let i = 0; i < 20; i++) {
    const before = round.phase;
    round.nextPhase();
    if (round.phase === before) break;
    seq.push(round.phase);
  }
  return seq;
}

describe('Round.nextPhase phase machine', () => {
  it('starts in QUESTION_SELECTION', () => {
    expect(new Round(1, leader, card).phase).toBe(RoundPhase.QUESTION_SELECTION);
    expect(new Round(1, leader, card, true).phase).toBe(RoundPhase.QUESTION_SELECTION);
  });

  it('walks the Classique sequence (no substitute)', () => {
    const round = new Round(1, leader, card, false);
    expect(walkPhases(round)).toEqual([
      RoundPhase.QUESTION_SELECTION,
      RoundPhase.ANSWERING,
      RoundPhase.GUESSING,
      RoundPhase.REVEAL,
    ]);
  });

  it('walks the "Devine ma réponse" sequence (with substitute)', () => {
    const round = new Round(1, leader, card, true);
    expect(walkPhases(round)).toEqual([
      RoundPhase.QUESTION_SELECTION,
      RoundPhase.SUBSTITUTE_SELECTION,
      RoundPhase.ANSWERING,
      RoundPhase.SUBSTITUTE_ANSWERING,
      RoundPhase.GUESSING,
      RoundPhase.REVEAL,
    ]);
  });

  it('is idempotent once REVEAL is reached', () => {
    const round = new Round(1, leader, card, false);
    walkPhases(round);
    expect(round.phase).toBe(RoundPhase.REVEAL);
    round.nextPhase();
    round.nextPhase();
    expect(round.phase).toBe(RoundPhase.REVEAL);
  });

  it('resets the per-phase timer bookkeeping on each transition', () => {
    const round = new Round(1, leader, card, false);
    round.timerEnd = new Date();
    round.timerStartedAt = 123456;
    round.timerDuration = 45;

    round.nextPhase();

    expect(round.phase).toBe(RoundPhase.ANSWERING);
    expect(round.timerEnd).toBeNull();
    expect(round.timerStartedAt).toBeUndefined();
    expect(round.timerDuration).toBeUndefined();
  });
});
