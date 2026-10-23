import { describe, expect, it } from 'vitest';
import { localTimerEnd } from './timerClock';

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

  it('sans serverNow (ancien serveur) : ancien calcul', () => {
    expect(localTimerEnd({ startedAt: 1_000_000, duration: 60 })).toBe(1_060_000);
  });
});
