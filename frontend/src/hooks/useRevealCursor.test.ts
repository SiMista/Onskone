import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { RevealResult } from '@onskone/shared';

// Fausse socket : on capte les listeners pour simuler les diffusions du serveur.
const { fakeSocket } = vi.hoisted(() => {
  const listeners = new Map<string, Set<(data: unknown) => void>>();
  const fakeSocket = {
    on: (event: string, fn: (data: unknown) => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(fn);
    },
    off: (event: string, fn: (data: unknown) => void) => { listeners.get(event)?.delete(fn); },
    emit: vi.fn(),
  };
  return { fakeSocket };
});
vi.mock('../utils/socket', () => ({ default: fakeSocket }));

import { useRevealCursor } from './useRevealCursor';

const card = (author: string, holder: string, answer: string): RevealResult => ({
  playerId: author,
  playerName: author,
  answer,
  guessedPlayerId: holder,
  guessedPlayerName: holder,
  correct: author === holder,
});

// Alice et Bob ont écrit pizza, Charlie hamburger ; cartes tournées d'un cran.
// Tour de table : Bob (0), Charlie (1), Alice (2).
const RESULTS = [card('alice', 'bob', 'Pizza'), card('bob', 'charlie', 'Pizzas'), card('charlie', 'alice', 'Hamburger')];
const ORDER = [0, 1, 2];
const NONE: readonly number[] = [];

const setup = (props: { pending: number | null; revealed?: number[]; corrections?: readonly number[]; isLeader?: boolean }) =>
  renderHook((p: typeof props) => useRevealCursor({
    results: RESULTS,
    leaderId: 'pilier',
    isLeader: p.isLeader ?? true,
    gameMode: 'local',
    lobbyCode: 'ABCDEF',
    revealOrder: ORDER,
    serverRevealedIndices: p.revealed,
    pendingSimilarityIndex: p.pending,
    similarityCorrections: p.corrections ?? NONE,
  }), { initialProps: props });

describe('useRevealCursor : arbitrage des similarités (état serveur)', () => {
  beforeEach(() => { fakeSocket.emit.mockClear(); });

  it('reprend sur la carte jugée après une reconnexion pendant la popup', () => {
    // Le pilier recharge alors que la carte de Bob (0) attend son arbitrage.
    const { result } = setup({ pending: 0, revealed: [0] });
    expect(result.current.pilierCursor).toBe(0);
    expect(result.current.pilierPhase).toBe('revealed');
    expect(result.current.showSimilarity).toBe(true);
    // La popup compare à la carte posée devant Charlie (vraie réponse de Bob).
    expect(result.current.similarityModal?.comparison).toMatchObject({ comparedIndex: 1, holderId: 'charlie', comparedAnswer: 'Pizzas' });
  });

  it('un curseur parti ailleurs revient sur la carte jugée quand le serveur signale l’attente', () => {
    const { result, rerender } = setup({ pending: null, revealed: [0] });
    expect(result.current.pilierCursor).toBe(1); // le pilier était passé à Charlie
    rerender({ pending: 0, revealed: [0] });
    expect(result.current.pilierCursor).toBe(0);
    expect(result.current.showSimilarity).toBe(true);
  });

  it('bloque « Révéler » tant que le pilier n’a pas tranché, et tranche sur la carte attendue', () => {
    const { result } = setup({ pending: 0, revealed: [0] });
    act(() => { result.current.handleReveal(); });
    expect(fakeSocket.emit).not.toHaveBeenCalledWith('revealAnswer', expect.anything());

    act(() => { result.current.handleConfirmSimilarity(); });
    expect(fakeSocket.emit).toHaveBeenCalledWith('confirmSimilarity', { lobbyCode: 'ABCDEF', answerIndex: 0 });
  });

  it('suit la décision du serveur : popup fermée, carte corrigée', () => {
    const { result, rerender } = setup({ pending: 0, revealed: [0] });
    rerender({ pending: null, revealed: [0], corrections: [0] });
    expect(result.current.similarityModal).toBeNull();
    expect(result.current.showSimilarity).toBe(false);
    expect(result.current.correctedIndices.has(0)).toBe(true);
  });
});
