import { describe, it, expect } from '@jest/globals';
import { parseAppStoreLookup } from '../src/utils/appStoreVersion';

describe('parseAppStoreLookup', () => {
  it('reads version, release date and minimum iOS from the Apple lookup response', () => {
    expect(parseAppStoreLookup({
      resultCount: 1,
      results: [{ version: '1.3.21', currentVersionReleaseDate: '2026-10-01T21:26:45Z', minimumOsVersion: '15.0' }],
    })).toEqual({ version: '1.3.21', releasedAt: '2026-10-01T21:26:45Z', minimumOsVersion: '15.0' });
  });

  it('returns null when the app is not on the store or the payload is unexpected', () => {
    expect(parseAppStoreLookup({ resultCount: 0, results: [] })).toBeNull();
    expect(parseAppStoreLookup({ results: [{ version: 1321 }] })).toBeNull();
    expect(parseAppStoreLookup(null)).toBeNull();
    expect(parseAppStoreLookup('oops')).toBeNull();
  });
});
