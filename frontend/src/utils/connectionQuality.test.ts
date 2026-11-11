import { describe, it, expect, vi } from 'vitest';

vi.mock('./socket', () => ({ default: { on: vi.fn(), connected: false } }));

const { tooSlow, tooManyDrops, SLOW_RTT_MS, DROP_WINDOW_MS } = await import('./connectionQuality');
const { classifyProbe } = await import('./maintenance');

describe('qualité de connexion', () => {
  it('alerte sur 2 latences lentes parmi les dernières, pas sur un pic isolé', () => {
    expect(tooSlow([80, 120, 95])).toBe(false);
    expect(tooSlow([80, SLOW_RTT_MS + 400, 95])).toBe(false);
    expect(tooSlow([SLOW_RTT_MS, 90, SLOW_RTT_MS + 1000])).toBe(true);
  });

  it('alerte sur 2 coupures dans la minute, pas sur des coupures espacées', () => {
    const now = 1_000_000;
    expect(tooManyDrops([now], now)).toBe(false);
    expect(tooManyDrops([now - DROP_WINDOW_MS - 1, now], now)).toBe(false);
    expect(tooManyDrops([now - 20_000, now], now)).toBe(true);
  });
});

describe('sonde serveur', () => {
  it("aucune réponse = injoignable (réseau du joueur), jamais « panne serveur »", () => {
    expect(classifyProbe(null)).toBe('unreachable');
  });

  it('5xx (proxy vivant, backend mort) = vraie panne serveur', () => {
    expect(classifyProbe(502)).toBe('down');
    expect(classifyProbe(503)).toBe('down');
  });

  it('le backend répond = serveur joignable', () => {
    expect(classifyProbe(200)).toBe('up');
    expect(classifyProbe(404)).toBe('up');
  });
});
