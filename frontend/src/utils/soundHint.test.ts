import { describe, it, expect, vi, beforeEach } from 'vitest';

const platform = vi.hoisted(() => ({ native: true, name: 'android' }));
const volume = vi.hoisted(() => ({ get: vi.fn<() => Promise<{ volume: number }>>() }));
const settings = vi.hoisted(() => ({ sound: true }));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => platform.native,
    getPlatform: () => platform.name,
  },
}));
vi.mock('@capawesome/capacitor-volume', () => ({ Volume: { getVolume: () => volume.get() } }));
vi.mock('./settings', () => ({ getSettings: () => settings }));

import { takeSoundHint, resetSoundHintForTests } from './soundHint';

describe('takeSoundHint', () => {
  beforeEach(() => {
    resetSoundHintForTests();
    platform.native = true;
    platform.name = 'android';
    settings.sound = true;
    volume.get.mockReset();
  });

  it('rappelle de monter le son quand le volume du téléphone est à 0', async () => {
    volume.get.mockResolvedValue({ volume: 0 });
    expect(await takeSoundHint()).toBe('default');
  });

  it('se tait quand le son est déjà monté, et revérifie à la partie suivante', async () => {
    volume.get.mockResolvedValue({ volume: 0.4 });
    expect(await takeSoundHint()).toBeNull();
    volume.get.mockResolvedValue({ volume: 0 });
    expect(await takeSoundHint()).toBe('default');
  });

  it("ne le montre qu'une fois par lancement d'app", async () => {
    volume.get.mockResolvedValue({ volume: 0 });
    expect(await takeSoundHint()).toBe('default');
    expect(await takeSoundHint()).toBeNull();
  });

  it('ne double pas le rappel sur deux lancements coup sur coup', async () => {
    volume.get.mockResolvedValue({ volume: 0 });
    const hints = await Promise.all([takeSoundHint(), takeSoundHint()]);
    expect(hints.filter(Boolean)).toHaveLength(1);
  });

  it('variante iOS (mode silencieux) sur iPhone', async () => {
    platform.name = 'ios';
    volume.get.mockResolvedValue({ volume: 0 });
    expect(await takeSoundHint()).toBe('ios');
  });

  it('jamais sur le web : le volume y est illisible', async () => {
    platform.native = false;
    expect(await takeSoundHint()).toBeNull();
    expect(volume.get).not.toHaveBeenCalled();
  });

  it('jamais si les sons sont coupés dans les Réglages', async () => {
    settings.sound = false;
    volume.get.mockResolvedValue({ volume: 0 });
    expect(await takeSoundHint()).toBeNull();
  });

  it('rien si le volume est illisible (plutôt qu’un rappel à l’aveugle)', async () => {
    volume.get.mockRejectedValue(new Error('not implemented'));
    expect(await takeSoundHint()).toBeNull();
  });
});
