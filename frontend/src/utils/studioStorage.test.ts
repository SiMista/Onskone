import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * studioStorage namespaces localStorage per Studio slot. The active slot is
 * detected ONCE at module load from `?studioSlot=N` (or `window.name`), so each
 * test re-imports the module after setting up the desired slot context.
 */

async function loadForSlot(slot: number | null) {
  vi.resetModules();
  // Reset the same-origin reload fallback so a prior import can't leak its slot.
  window.name = '';
  const search = slot === null ? '' : `?studioSlot=${slot}`;
  window.history.replaceState({}, '', `/${search}`);
  return await import('./studioStorage');
}

beforeEach(() => {
  localStorage.clear();
  window.name = '';
});

afterEach(() => {
  localStorage.clear();
  window.name = '';
  window.history.replaceState({}, '', '/');
});

describe('studioStorage slot detection', () => {
  it('detects the slot from the URL and marks the frame as a studio frame', async () => {
    const mod = await loadForSlot(2);
    expect(mod.studioSlotIndex).toBe(2);
    expect(mod.isStudioFrame).toBe(true);
  });

  it('is a transparent passthrough outside a studio frame', async () => {
    const mod = await loadForSlot(null);
    expect(mod.studioSlotIndex).toBeNull();
    expect(mod.isStudioFrame).toBe(false);

    mod.studioStorage.setItem('plainKey', 'plainValue');
    // No prefix applied: the raw key is used.
    expect(localStorage.getItem('plainKey')).toBe('plainValue');
    expect(mod.studioStorage.getItem('plainKey')).toBe('plainValue');
  });

  it('falls back to window.name when the URL has no studioSlot param', async () => {
    vi.resetModules();
    window.name = 'studio-slot-4';
    window.history.replaceState({}, '', '/');
    const mod = await import('./studioStorage');
    expect(mod.studioSlotIndex).toBe(4);
    expect(mod.isStudioFrame).toBe(true);
  });
});

describe('studioStorage namespacing', () => {
  it('prefixes keys with the slot index in localStorage', async () => {
    const mod = await loadForSlot(0);
    mod.studioStorage.setItem('token', 'abc');

    expect(localStorage.getItem('studio0_token')).toBe('abc');
    // The bare (unprefixed) key must not exist.
    expect(localStorage.getItem('token')).toBeNull();
    expect(mod.studioStorage.getItem('token')).toBe('abc');
  });

  it('removeItem only clears the slot-namespaced key', async () => {
    const mod = await loadForSlot(1);
    localStorage.setItem('token', 'shared-untouched');
    mod.studioStorage.setItem('token', 'slot-value');

    mod.studioStorage.removeItem('token');
    expect(localStorage.getItem('studio1_token')).toBeNull();
    // A same-named non-namespaced entry is left alone.
    expect(localStorage.getItem('token')).toBe('shared-untouched');
  });

  it('keeps two slots fully isolated from each other', async () => {
    const slot0 = await loadForSlot(0);
    slot0.studioStorage.setItem('playerName', 'Alice');

    const slot1 = await loadForSlot(1);
    slot1.studioStorage.setItem('playerName', 'Bob');

    // Each slot reads back its own value only.
    expect(slot0.studioStorage.getItem('playerName')).toBe('Alice');
    expect(slot1.studioStorage.getItem('playerName')).toBe('Bob');
    expect(localStorage.getItem('studio0_playerName')).toBe('Alice');
    expect(localStorage.getItem('studio1_playerName')).toBe('Bob');
  });
});

describe('purgeStudioSlot', () => {
  it('removes only the keys belonging to the target slot', async () => {
    const mod = await loadForSlot(0);
    localStorage.setItem('studio0_a', '1');
    localStorage.setItem('studio0_b', '2');
    localStorage.setItem('studio1_a', '3');
    localStorage.setItem('unrelated', '4');

    mod.purgeStudioSlot(0);

    expect(localStorage.getItem('studio0_a')).toBeNull();
    expect(localStorage.getItem('studio0_b')).toBeNull();
    // Other slots and unrelated keys survive.
    expect(localStorage.getItem('studio1_a')).toBe('3');
    expect(localStorage.getItem('unrelated')).toBe('4');
  });
});
