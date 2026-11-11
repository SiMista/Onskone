import { describe, expect, it } from 'vitest';
import { localTimerEnd, localTimerStart } from './timerClock';

describe('localTimerEnd', () => {
  const data = { startedAt: 1_000_000, duration: 60, serverNow: 1_000_000 };

  it('horloge locale à l\'heure : échéance = startedAt + durée', () => {
    expect(localTimerEnd(data, 1_000_000)).toBe(1_060_000);
  });

  it('horloge locale en avance de 5 min : le temps restant reste 60 s', () => {
    const local = 1_000_000 + 300_000;
    expect(localTimerEnd(data, local) - local).toBe(60_000);
  });

  it('horloge locale en retard de 5 min : le temps restant reste 60 s', () => {
    const local = 1_000_000 - 300_000;
    expect(localTimerEnd(data, local) - local).toBe(60_000);
  });

  it('timerState tardif : ne compte que le temps réellement restant', () => {
    const late = { ...data, serverNow: 1_040_000 };
    expect(localTimerEnd(late, 5_000) - 5_000).toBe(20_000);
  });
});

describe('localTimerStart', () => {
  it("départ décalé de 3,5 s (intro) : dans le futur sur l'horloge locale, quelle que soit sa montre", () => {
    const data = { startedAt: 1_003_500, serverNow: 1_000_000 };
    expect(localTimerStart(data, 1_000_000)).toBe(1_003_500);
    expect(localTimerStart(data, 1_300_000)).toBe(1_303_500);
  });

  it('timer déjà parti : départ dans le passé', () => {
    expect(localTimerStart({ startedAt: 1_000_000, serverNow: 1_010_000 }, 2_000_000)).toBe(1_990_000);
  });
});
