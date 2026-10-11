import { describe, it, expect } from 'vitest';
import { GameStatus, RoundPhase, type IGame, type IRound, gameFingerprint } from '@onskone/shared';
import { mergeGameState, deltaMatchesCurrentRound, isFinished, screenKey } from './gameSync';

const PHASE_ORDER = [
  RoundPhase.QUESTION_SELECTION,
  RoundPhase.SUBSTITUTE_SELECTION,
  RoundPhase.ANSWERING,
  RoundPhase.SUBSTITUTE_ANSWERING,
  RoundPhase.GUESSING,
  RoundPhase.REVEAL,
];

const round = (roundNumber: number, phase: RoundPhase, revealedIndices: number[] = []): IRound => ({
  roundNumber,
  phase,
  revealedIndices,
  leader: { id: 'L', name: 'Léa', isHost: true, isActive: true, avatarId: 0 },
  gameCard: { category: 'FUN', theme: 't', subject: 's', questions: ['q'] },
  selectedQuestion: 'q',
  answers: {},
  scores: {},
  guessMyAnswerMode: false,
  substitutePlayerId: null,
  substituteAnswer: null,
} as IRound);

const game = (currentRound: IRound | null, status: GameStatus = GameStatus.IN_PROGRESS): IGame => ({
  // Seuls status/currentRound comptent pour la synchro : le lobby est un gabarit minimal.
  lobby: { code: 'ABCDEF', players: [], selectedDecks: {}, gameMode: 'local', guessMyAnswerMode: false, gameSpeed: 'normal', locale: 'fr' } as unknown as IGame['lobby'],
  currentRound,
  status,
  rounds: currentRound ? [currentRound] : [],
});

describe('mergeGameState', () => {
  it('applies the first state and flags the screen as changed', () => {
    const d = mergeGameState(null, game(round(1, RoundPhase.ANSWERING)), PHASE_ORDER);
    expect(d).toMatchObject({ apply: true, screenChanged: true });
  });

  it('rejects a stale state: same round, earlier phase', () => {
    const prev = game(round(2, RoundPhase.GUESSING));
    expect(mergeGameState(prev, game(round(2, RoundPhase.ANSWERING)), PHASE_ORDER)).toEqual({ apply: false });
  });

  it('applies a later phase of the same round, and a later round', () => {
    const prev = game(round(2, RoundPhase.ANSWERING));
    expect(mergeGameState(prev, game(round(2, RoundPhase.REVEAL)), PHASE_ORDER)).toMatchObject({ apply: true, screenChanged: true });
    expect(mergeGameState(prev, game(round(3, RoundPhase.QUESTION_SELECTION)), PHASE_ORDER)).toMatchObject({ apply: true, screenChanged: true });
  });

  it('applies a LOWER round number: a new game in the same lobby restarts at round 1', () => {
    const prev = game(round(6, RoundPhase.REVEAL));
    expect(mergeGameState(prev, game(round(1, RoundPhase.QUESTION_SELECTION)), PHASE_ORDER)).toMatchObject({ apply: true });
  });

  it('applies the same screen without flagging a change (periodic no-op resync)', () => {
    const prev = game(round(2, RoundPhase.REVEAL, [0, 1]));
    expect(mergeGameState(prev, game(round(2, RoundPhase.REVEAL, [0, 1])), PHASE_ORDER)).toMatchObject({ apply: true, screenChanged: false });
  });

  it('does NOT flag a screen change when only the revealed answers differ (no remount mid-reveal)', () => {
    const prev = game(round(2, RoundPhase.REVEAL, [0]));
    const d = mergeGameState(prev, game(round(2, RoundPhase.REVEAL, [0, 1, 2])), PHASE_ORDER);
    expect(d).toMatchObject({ apply: true, screenChanged: false });
    if (d.apply) expect(d.game.currentRound?.revealedIndices).toEqual([0, 1, 2]);
  });

  it('applies a FINISHED state over the last REVEAL of the same round', () => {
    const prev = game(round(6, RoundPhase.REVEAL));
    const d = mergeGameState(prev, game(round(6, RoundPhase.REVEAL), GameStatus.FINISHED), PHASE_ORDER);
    expect(d).toMatchObject({ apply: true, screenChanged: true });
  });
});

describe('deltaMatchesCurrentRound', () => {
  it('accepts a delta for the displayed round and rejects another round', () => {
    const g = game(round(3, RoundPhase.ANSWERING));
    expect(deltaMatchesCurrentRound(g, 3)).toBe(true);
    expect(deltaMatchesCurrentRound(g, 4)).toBe(false);
    expect(deltaMatchesCurrentRound(g, 2)).toBe(false);
  });

  it('rejects any delta when no round is displayed', () => {
    expect(deltaMatchesCurrentRound(null, 1)).toBe(false);
    expect(deltaMatchesCurrentRound(game(null), 1)).toBe(false);
  });

  it('trusts an untagged delta (older server)', () => {
    expect(deltaMatchesCurrentRound(game(round(3, RoundPhase.ANSWERING)), undefined)).toBe(true);
  });
});

describe('fingerprint & finished', () => {
  it('fingerprint changes with status, round, phase and revealed count only', () => {
    const a = gameFingerprint(game(round(1, RoundPhase.REVEAL, [0])));
    expect(gameFingerprint(game(round(1, RoundPhase.REVEAL, [0])))).toBe(a);
    expect(gameFingerprint(game(round(1, RoundPhase.REVEAL, [0, 1])))).not.toBe(a);
    expect(gameFingerprint(game(round(2, RoundPhase.REVEAL, [0])))).not.toBe(a);
    expect(gameFingerprint(game(round(1, RoundPhase.GUESSING, [0])))).not.toBe(a);
    expect(gameFingerprint(game(round(1, RoundPhase.REVEAL, [0]), GameStatus.FINISHED))).not.toBe(a);
    expect(gameFingerprint(null)).toBe('none');
  });

  it('screenKey ignores the revealed count but tracks status, round and phase', () => {
    const a = screenKey(game(round(1, RoundPhase.REVEAL, [0])));
    expect(screenKey(game(round(1, RoundPhase.REVEAL, [0, 1, 2])))).toBe(a);
    expect(screenKey(game(round(2, RoundPhase.REVEAL, [0])))).not.toBe(a);
    expect(screenKey(game(round(1, RoundPhase.GUESSING)))).not.toBe(a);
    expect(screenKey(game(round(1, RoundPhase.REVEAL), GameStatus.FINISHED))).not.toBe(a);
  });

  it('isFinished', () => {
    expect(isFinished(game(round(1, RoundPhase.REVEAL), GameStatus.FINISHED))).toBe(true);
    expect(isFinished(game(round(1, RoundPhase.REVEAL)))).toBe(false);
    expect(isFinished(null)).toBe(false);
  });
});
