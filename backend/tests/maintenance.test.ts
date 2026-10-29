import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Petit magasin clé/valeur en mémoire à la place de SQLite.
const store = new Map<string, string>();
jest.mock('../src/db/appConfig', () => ({
  getConfig: (k: string) => store.get(k) ?? null,
  setConfig: (k: string, v: string) => { store.set(k, v); },
}));

import { getMaintenance, setMaintenance, isNewGameBlocked, attachMaintenance } from '../src/utils/maintenance';

describe('maintenance', () => {
  beforeEach(() => store.clear());

  it('is off by default', () => {
    expect(getMaintenance().active).toBe(false);
    expect(isNewGameBlocked()).toBe(false);
  });

  it('activates with a mode, persists it and blocks new games', () => {
    const state = setMaintenance(true, 'all');
    expect(state).toMatchObject({ active: true, mode: 'all' });
    expect(typeof state.since).toBe('number');
    expect(getMaintenance()).toEqual(state);
    expect(isNewGameBlocked()).toBe(true);
  });

  it('is lifted by setMaintenance(false)', () => {
    setMaintenance(true, 'new_games');
    setMaintenance(false);
    expect(getMaintenance().active).toBe(false);
    expect(isNewGameBlocked()).toBe(false);
  });

  it('treats corrupted or unknown stored values as off (never locks the game by accident)', () => {
    store.set('maintenance', '{not json');
    expect(getMaintenance().active).toBe(false);
    store.set('maintenance', JSON.stringify({ active: true, mode: 'bogus' }));
    expect(getMaintenance().active).toBe(false);
  });

  it('broadcasts changes to every connected client and greets new connections with the state', () => {
    const emitAll = jest.fn();
    const handlers: Record<string, (s: { emit: jest.Mock }) => void> = {};
    const io = { emit: emitAll, on: (ev: string, cb: (s: { emit: jest.Mock }) => void) => { handlers[ev] = cb; } };
    attachMaintenance(io as never);

    const state = setMaintenance(true, 'new_games');
    expect(emitAll).toHaveBeenCalledWith('maintenance', state);

    const socket = { emit: jest.fn() };
    handlers.connection(socket);
    expect(socket.emit).toHaveBeenCalledWith('maintenance', state);
  });
});
