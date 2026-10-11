import { describe, it, expect } from '@jest/globals';
import { isOlderVersion, isActiveVersion, shouldBlockForUpdate } from '@onskone/shared';
import { announcesClientPolicy, shouldBlockLegacyClient } from '../src/utils/versionRule';

describe('announcesClientPolicy', () => {
  it('recognizes clients that check their store themselves (number or string)', () => {
    expect(announcesClientPolicy({ versionPolicy: 1 })).toBe(true);
    expect(announcesClientPolicy({ versionPolicy: '1' })).toBe(true);
  });

  it('treats anything else as a legacy client', () => {
    expect(announcesClientPolicy(undefined)).toBe(false);
    expect(announcesClientPolicy({})).toBe(false);
    expect(announcesClientPolicy({ appVersion: '1.3.0' })).toBe(false);
    expect(announcesClientPolicy({ versionPolicy: true })).toBe(false);
  });
});

describe('isOlderVersion', () => {
  it('compares numerically, segment by segment (not lexicographically)', () => {
    expect(isOlderVersion('1.3.9', '1.3.10')).toBe(true);
    expect(isOlderVersion('1.9.9', '1.10.0')).toBe(true);
    expect(isOlderVersion('1.99.99', '2.0.0')).toBe(true);
    expect(isOlderVersion('1.3.10', '1.3.9')).toBe(false);
  });

  it('is strict: equal versions are not older', () => {
    expect(isOlderVersion('1.3.29', '1.3.29')).toBe(false);
    expect(isOlderVersion('v1.3.29', '1.3.29')).toBe(false);
  });

  it('treats missing or garbage segments as 0', () => {
    expect(isOlderVersion('1.3', '1.3.0')).toBe(false);
    expect(isOlderVersion('', '1.3.0')).toBe(true);
    expect(isOlderVersion('1.3.29', '')).toBe(false);
  });
});

describe('isActiveVersion', () => {
  it('considers empty and 0.0.0 as "no floor"', () => {
    expect(isActiveVersion('')).toBe(false);
    expect(isActiveVersion('0.0.0')).toBe(false);
    expect(isActiveVersion('0.0.1')).toBe(true);
  });
});

describe('shouldBlockForUpdate (the shared rule)', () => {
  it('blocks only when under the floor AND a newer version is obtainable', () => {
    expect(shouldBlockForUpdate('1.3.20', '1.3.29', true)).toBe(true);
  });

  it('never blocks someone who cannot obtain a newer version (already on the latest available)', () => {
    expect(shouldBlockForUpdate('1.3.20', '1.3.29', false)).toBe(false);
  });

  it('never blocks at or above the floor', () => {
    expect(shouldBlockForUpdate('1.3.29', '1.3.29', true)).toBe(false);
    expect(shouldBlockForUpdate('1.3.35', '1.3.29', true)).toBe(false);
  });

  it('never blocks when no floor is set', () => {
    expect(shouldBlockForUpdate('0.0.1', '', true)).toBe(false);
    expect(shouldBlockForUpdate('0.0.1', '0.0.0', true)).toBe(false);
  });
});

describe('shouldBlockLegacyClient (clients that do not check their store)', () => {
  const base = { minVersion: '1.3.35', deployedVersion: '1.3.35' };

  it('never blocks a legacy native app, whatever its version (store unknown to the server)', () => {
    expect(shouldBlockLegacyClient({ ...base, appVersion: '1.3.0', isNativeApp: true })).toBe(false);
    expect(shouldBlockLegacyClient({ ...base, appVersion: '', isNativeApp: true })).toBe(false);
  });

  it('blocks a stale web tab under the floor: a reload serves the deployed version', () => {
    expect(shouldBlockLegacyClient({ ...base, appVersion: '1.3.20', isNativeApp: false })).toBe(true);
    expect(shouldBlockLegacyClient({ ...base, appVersion: '', isNativeApp: false })).toBe(true);
  });

  it('never blocks a web client already on the deployed version, even if the floor is higher (rollback)', () => {
    expect(shouldBlockLegacyClient({
      appVersion: '1.3.30', minVersion: '1.3.35', deployedVersion: '1.3.30', isNativeApp: false,
    })).toBe(false);
  });

  it('never blocks when the deployed version is unknown (nothing proves a reload helps)', () => {
    expect(shouldBlockLegacyClient({ ...base, deployedVersion: '', appVersion: '1.3.0', isNativeApp: false })).toBe(false);
  });

  it('never blocks when no floor is set', () => {
    expect(shouldBlockLegacyClient({ ...base, minVersion: '', appVersion: '1.0.0', isNativeApp: false })).toBe(false);
  });
});
