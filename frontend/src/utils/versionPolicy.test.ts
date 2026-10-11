import { describe, it, expect } from 'vitest';
import { AppUpdateAvailability, type AppUpdateInfo } from '@capawesome/capacitor-app-update';
import { shouldBlockForUpdate } from '@onskone/shared';
import {
  webUpdateObtainable,
  androidUpdateObtainable,
  parseIosVersion,
  iosUpdateObtainable,
  createPolicyEvaluator,
  IOS_RELEASE_GRACE_MS,
  type VersionBlock,
} from './versionPolicy';

const NOW = Date.parse('2026-10-10T12:00:00Z');
const HOUR = 60 * 60 * 1000;

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
const IPHONE_OLD_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
const IPAD_DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)';

const android = (o: Partial<AppUpdateInfo>): AppUpdateInfo => ({
  currentVersionName: '1.3.29',
  currentVersionCode: '173',
  availableVersionCode: '173',
  updateAvailability: AppUpdateAvailability.UPDATE_NOT_AVAILABLE,
  ...o,
});

const ios = (o: Partial<AppUpdateInfo> & { minimumOsVersion?: string }): AppUpdateInfo & { minimumOsVersion?: string } => ({
  currentVersionName: '1.3.21',
  currentVersionCode: '150',
  availableVersionName: '1.3.21',
  updateAvailability: AppUpdateAvailability.UPDATE_NOT_AVAILABLE,
  minimumOsVersion: '15.0',
  // Sortie il y a 3 jours : hors délai de grâce par défaut.
  availableVersionReleaseDate: new Date(NOW - 72 * HOUR).toISOString(),
  ...o,
});

describe('webUpdateObtainable', () => {
  it('is true only when the deployed version is strictly newer', () => {
    expect(webUpdateObtainable('1.3.20', '1.3.29')).toBe(true);
    expect(webUpdateObtainable('1.3.29', '1.3.29')).toBe(false);
    expect(webUpdateObtainable('1.3.30', '1.3.29')).toBe(false);
  });

  it('is false when the deployed version is unknown', () => {
    expect(webUpdateObtainable('1.0.0', '')).toBe(false);
  });
});

describe('androidUpdateObtainable', () => {
  it('trusts Play Core when it offers a higher versionCode', () => {
    expect(androidUpdateObtainable(android({
      updateAvailability: AppUpdateAvailability.UPDATE_AVAILABLE, availableVersionCode: '180',
    }))).toBe(true);
  });

  it('is false when Play Core offers nothing (already on the latest, sideloaded, staged rollout not reached...)', () => {
    expect(androidUpdateObtainable(android({ updateAvailability: AppUpdateAvailability.UPDATE_NOT_AVAILABLE }))).toBe(false);
    expect(androidUpdateObtainable(android({ updateAvailability: AppUpdateAvailability.UNKNOWN }))).toBe(false);
    expect(androidUpdateObtainable(android({ updateAvailability: AppUpdateAvailability.UPDATE_IN_PROGRESS }))).toBe(false);
  });

  it('is false on inconsistent data (available code not higher, or unreadable)', () => {
    expect(androidUpdateObtainable(android({
      updateAvailability: AppUpdateAvailability.UPDATE_AVAILABLE, availableVersionCode: '173',
    }))).toBe(false);
    expect(androidUpdateObtainable(android({
      updateAvailability: AppUpdateAvailability.UPDATE_AVAILABLE, availableVersionCode: undefined,
    }))).toBe(false);
  });
});

describe('parseIosVersion', () => {
  it('reads the iOS version from an iPhone user agent', () => {
    expect(parseIosVersion(IPHONE_UA)).toBe('17.4.1');
    expect(parseIosVersion(IPHONE_OLD_UA)).toBe('15.8.0');
  });

  it('returns null when the OS is not identifiable (iPad desktop UA)', () => {
    expect(parseIosVersion(IPAD_DESKTOP_UA)).toBeNull();
    expect(parseIosVersion('')).toBeNull();
  });
});

describe('iosUpdateObtainable', () => {
  it('is true when the App Store has a newer version this iOS can install', () => {
    expect(iosUpdateObtainable(ios({ availableVersionName: '1.3.29' }), IPHONE_UA, NOW)).toBe(true);
  });

  it('is false when already on the App Store version', () => {
    expect(iosUpdateObtainable(ios({}), IPHONE_UA, NOW)).toBe(false);
  });

  it('is false for a TestFlight build newer than the App Store', () => {
    expect(iosUpdateObtainable(ios({ currentVersionName: '1.3.40', availableVersionName: '1.3.29' }), IPHONE_UA, NOW)).toBe(false);
  });

  it('is false when the device iOS is too old for the App Store version', () => {
    expect(iosUpdateObtainable(ios({ availableVersionName: '1.3.29', minimumOsVersion: '16.0' }), IPHONE_OLD_UA, NOW)).toBe(false);
  });

  it('is false when anything needed to prove it is missing', () => {
    expect(iosUpdateObtainable(ios({ availableVersionName: '1.3.29' }), IPAD_DESKTOP_UA, NOW)).toBe(false);
    expect(iosUpdateObtainable(ios({ availableVersionName: '1.3.29', minimumOsVersion: undefined }), IPHONE_UA, NOW)).toBe(false);
    expect(iosUpdateObtainable(ios({ availableVersionName: undefined }), IPHONE_UA, NOW)).toBe(false);
  });

  it('waits 24h after an App Store release (the lookup API is ahead of the store binary)', () => {
    const released = (msAgo: number) => ios({
      availableVersionName: '1.3.29', availableVersionReleaseDate: new Date(NOW - msAgo).toISOString(),
    });
    expect(iosUpdateObtainable(released(2 * HOUR), IPHONE_UA, NOW)).toBe(false);
    expect(iosUpdateObtainable(released(IOS_RELEASE_GRACE_MS - 1), IPHONE_UA, NOW)).toBe(false);
    expect(iosUpdateObtainable(released(IOS_RELEASE_GRACE_MS), IPHONE_UA, NOW)).toBe(true);
  });

  it('is false when the release date is missing or unreadable', () => {
    expect(iosUpdateObtainable(ios({ availableVersionName: '1.3.29', availableVersionReleaseDate: undefined }), IPHONE_UA, NOW)).toBe(false);
    expect(iosUpdateObtainable(ios({ availableVersionName: '1.3.29', availableVersionReleaseDate: 'n/a' }), IPHONE_UA, NOW)).toBe(false);
  });
});

// Le cas qui compte : quelqu'un qui a déjà la dernière version qu'il peut obtenir
// n'est JAMAIS bloqué, même sous le plancher.
describe('invariant: the latest obtainable version is never blocked', () => {
  const floor = '1.3.35';

  it('web: already on the deployed version', () => {
    expect(shouldBlockForUpdate('1.3.35', floor, webUpdateObtainable('1.3.35', '1.3.35'))).toBe(false);
    // Plancher au-dessus du déployé (rollback) : à jour quand même.
    expect(shouldBlockForUpdate('1.3.30', floor, webUpdateObtainable('1.3.30', '1.3.30'))).toBe(false);
  });

  it('android: store behind the floor (hotfix iOS only, rollout not reached...)', () => {
    expect(shouldBlockForUpdate('1.3.29', floor, androidUpdateObtainable(android({})))).toBe(false);
  });

  it('ios: App Store behind the floor (review pending)', () => {
    expect(shouldBlockForUpdate('1.3.21', floor, iosUpdateObtainable(ios({}), IPHONE_UA, NOW))).toBe(false);
  });

  it('but someone behind their own store IS asked to update', () => {
    expect(shouldBlockForUpdate('1.3.10', floor, iosUpdateObtainable(ios({ currentVersionName: '1.3.10' }), IPHONE_UA, NOW))).toBe(true);
  });
});

describe('createPolicyEvaluator (state machine)', () => {
  const deferred = <T>() => {
    let resolve!: (v: T) => void;
    const promise = new Promise<T>((r) => { resolve = r; });
    return { promise, resolve };
  };

  // Évaluateur branché sur un faux store ; `obtainable` décide de la réponse du store.
  const setup = (currentVersion: string, obtainable: () => Promise<boolean>) => {
    const state = { block: null as VersionBlock | null, storeCalls: 0 };
    const evaluate = createPolicyEvaluator({
      getCurrentVersion: () => currentVersion,
      isNewerVersionObtainable: () => { state.storeCalls++; return obtainable(); },
      isBlocked: () => state.block !== null,
      setBlocked: (b) => { state.block = b; },
    });
    return { evaluate, state };
  };

  it('connect: blocks under the floor when an update is obtainable', async () => {
    const { evaluate, state } = setup('1.3.20', async () => true);
    await evaluate({ minVersion: '1.3.29', trigger: 'connect' });
    expect(state.block).toEqual({ minVersion: '1.3.29' });
  });

  it('connect: does not block under the floor when nothing newer is obtainable', async () => {
    const { evaluate, state } = setup('1.3.20', async () => false);
    await evaluate({ minVersion: '1.3.29', trigger: 'connect' });
    expect(state.block).toBeNull();
  });

  it('connect: at or above the floor, never asks the store and never blocks', async () => {
    const { evaluate, state } = setup('1.3.29', async () => true);
    await evaluate({ minVersion: '1.3.29', trigger: 'connect' });
    expect(state.block).toBeNull();
    expect(state.storeCalls).toBe(0);
  });

  it('update: never imposes a block mid-session', async () => {
    const { evaluate, state } = setup('1.3.20', async () => true);
    await evaluate({ minVersion: '1.3.29', trigger: 'update' });
    expect(state.block).toBeNull();
    expect(state.storeCalls).toBe(0);
  });

  it('update: lifts an existing block when the admin disables the floor', async () => {
    const { evaluate, state } = setup('1.3.20', async () => true);
    await evaluate({ minVersion: '1.3.29', trigger: 'connect' });
    expect(state.block).not.toBeNull();
    await evaluate({ minVersion: '', trigger: 'update' });
    expect(state.block).toBeNull();
  });

  it('race: "Désactiver" during a slow store check is not lost', async () => {
    const store = deferred<boolean>();
    const { evaluate, state } = setup('1.3.20', () => store.promise);
    const connect = evaluate({ minVersion: '1.3.29', trigger: 'connect' });
    await evaluate({ minVersion: '', trigger: 'update' });
    store.resolve(true);
    await connect;
    expect(state.block).toBeNull();
  });

  it('race: a stale connect result is dropped in favor of the latest policy', async () => {
    const slow = deferred<boolean>();
    let call = 0;
    const { evaluate, state } = setup('1.3.20', () => (++call === 1 ? slow.promise : Promise.resolve(false)));
    const first = evaluate({ minVersion: '1.3.29', trigger: 'connect' });
    await evaluate({ minVersion: '1.3.29', trigger: 'connect' });
    slow.resolve(true);
    await first;
    expect(state.block).toBeNull();
  });
});
