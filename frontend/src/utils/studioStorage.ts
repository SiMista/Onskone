/**
 * Storage namespaced per studio slot.
 *
 * The Studio page sets each iframe's `name` to "studio-slot-N". `window.name`
 * is preserved across same-origin navigations and full reloads of the frame,
 * and is isolated per frame - making it the cleanest handle for keeping each
 * simulated player's localStorage separate from the others.
 *
 * Outside the studio (top-level browsing context), this is a transparent
 * passthrough to localStorage.
 */

const SLOT_REGEX = /^studio-slot-(\d+)$/;

function detectSlotIndex(): number | null {
  if (typeof window === 'undefined') return null;

  // Primary: URL param `studioSlot=N`. Set at the iframe's initial load by
  // the Studio parent. The value is captured ONCE at module load time below
  // (module-level state, isolated per iframe), so it survives SPA navigations
  // even when the URL no longer carries the param.
  try {
    const urlSlot = new URLSearchParams(window.location.search).get('studioSlot');
    if (urlSlot !== null) {
      const n = parseInt(urlSlot, 10);
      if (!isNaN(n)) {
        // Mirror into window.name as a belt-and-suspenders fallback for hard
        // reloads of the inner page (which would drop the URL param but keep
        // window.name across same-origin reloads).
        try {
          if (!SLOT_REGEX.test(window.name)) window.name = `studio-slot-${n}`;
        } catch { /* silent */ }
        return n;
      }
    }
  } catch { /* silent */ }

  // Fallback: window.name (set either by us above or by the iframe element).
  const match = window.name?.match(SLOT_REGEX);
  return match ? parseInt(match[1], 10) : null;
}

export const studioSlotIndex = detectSlotIndex();
export const isStudioFrame = studioSlotIndex !== null;
const PREFIX = isStudioFrame ? `studio${studioSlotIndex}_` : '';

export const studioStorage = {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(PREFIX + key);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(PREFIX + key, value);
    } catch {
      /* quota / disabled - silent */
    }
  },
  removeItem(key: string): void {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch {
      /* silent */
    }
  },
};

/** Purge every key belonging to a given studio slot (used by Studio "reset"). */
export function purgeStudioSlot(slot: number): void {
  const prefix = `studio${slot}_`;
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) toRemove.push(key);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* silent */
  }
}
