import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { GAME_CONSTANTS } from '@onskone/shared';

// Fausse socket : on capte les listeners pour simuler les diffusions du serveur.
const { fakeSocket, listeners } = vi.hoisted(() => {
  const listeners = new Map<string, Set<(data: unknown) => void>>();
  const fakeSocket = {
    on: (event: string, fn: (data: unknown) => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(fn);
    },
    off: (event: string, fn: (data: unknown) => void) => { listeners.get(event)?.delete(fn); },
    emit: vi.fn(),
  };
  return { fakeSocket, listeners };
});
vi.mock('../utils/socket', () => ({ default: fakeSocket }));

import { useLobbyState } from './useLobbyState';

const serverState = (patch: Record<string, unknown> = {}) => ({
  catalog: {},
  catalogWithMeta: {},
  selected: {},
  gameMode: 'local',
  guessMyAnswerMode: false,
  gameSpeed: GAME_CONSTANTS.GAME_SPEED_DEFAULT,
  excludedLeaderIds: [],
  preparing: false,
  locale: 'fr',
  ...patch,
});
const broadcast = (data: unknown) => act(() => { listeners.get('lobbyDecksState')?.forEach(fn => fn(data)); });
const lastEmit = (event: string) => fakeSocket.emit.mock.calls.filter(c => c[0] === event).at(-1)?.[1];

describe('useLobbyState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fakeSocket.emit.mockClear();
  });
  afterEach(() => { vi.useRealTimers(); });

  it("une diffusion à l'arrivée d'un joueur n'écrase pas un thème coché encore en attente d'envoi", () => {
    const { result } = renderHook(() => useLobbyState('ABCDEF'));
    broadcast(serverState());

    act(() => result.current.onSelectedDecksChange({ FUN: ['A'] }));
    broadcast(serverState({ selected: {} })); // un pote rejoint dans les 150 ms
    expect(result.current.selectedDecks).toEqual({ FUN: ['A'] });

    act(() => { vi.advanceTimersByTime(150); });
    expect(lastEmit('updateSelectedDecks')).toEqual({ lobbyCode: 'ABCDEF', selected: { FUN: ['A'] } });

    // Une fois envoyé, l'état serveur reprend la main.
    broadcast(serverState({ selected: { FUN: ['A'] } }));
    expect(result.current.selectedDecks).toEqual({ FUN: ['A'] });
  });

  it("garde l'auto-exclusion d'un arrivant posée par le serveur pendant un geste de l'hôte", () => {
    const { result } = renderHook(() => useLobbyState('ABCDEF'));
    broadcast(serverState({ excludedLeaderIds: [] }));

    act(() => result.current.onExcludedLeadersChange(['p1'])); // l'hôte exclut p1
    broadcast(serverState({ excludedLeaderIds: ['p9'] })); // le 9e arrive, exclu d'office
    expect(result.current.excludedLeaderIds).toEqual(['p9', 'p1']);

    act(() => { vi.advanceTimersByTime(150); });
    expect(lastEmit('updateExcludedLeaders')).toEqual({ lobbyCode: 'ABCDEF', excludedLeaderIds: ['p9', 'p1'] });
  });

  it("un joueur que l'hôte ré-autorise reste ré-autorisé malgré une diffusion intermédiaire", () => {
    const { result } = renderHook(() => useLobbyState('ABCDEF'));
    broadcast(serverState({ excludedLeaderIds: ['p9'] }));

    act(() => result.current.onExcludedLeadersChange([])); // l'hôte re-coche p9
    broadcast(serverState({ excludedLeaderIds: ['p9', 'p10'] }));
    expect(result.current.excludedLeaderIds).toEqual(['p10']);

    act(() => { vi.advanceTimersByTime(150); });
    expect(lastEmit('updateExcludedLeaders')).toEqual({ lobbyCode: 'ABCDEF', excludedLeaderIds: ['p10'] });
  });
});
