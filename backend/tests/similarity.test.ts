import { describe, it, expect } from '@jest/globals';
import { areAnswersSimilar, isSimilarPair } from '../src/utils/similarity';
import { formatNoResponse } from '@onskone/shared';

describe('areAnswersSimilar', () => {
  it('treats identical answers (modulo case) as similar', () => {
    expect(areAnswersSimilar('Le chat', 'le chat')).toBe(true);
  });

  it('normalizes accents, case and punctuation before comparing', () => {
    expect(areAnswersSimilar('Café !', 'cafe')).toBe(true);
    expect(areAnswersSimilar('ÉLÉPHANT', 'elephant')).toBe(true);
  });

  it('ignores French stop words so paraphrases with filler words merge', () => {
    // "le" is a stop word -> both normalize to "petit chat noir"
    expect(areAnswersSimilar('le petit chat noir', 'petit chat noir')).toBe(true);
  });

  it('merges near-duplicates that differ by a small typo', () => {
    // "bonjour" vs "bonjuor": distance 2 over length 7 -> ~0.71 >= 0.65
    expect(areAnswersSimilar('bonjour', 'bonjuor')).toBe(true);
  });

  it('keeps clearly different answers apart', () => {
    expect(areAnswersSimilar('chien', 'montagne')).toBe(false);
  });

  it('returns false when either side is empty after normalization', () => {
    // Both reduce to stop-word-only -> empty normalized strings.
    expect(areAnswersSimilar('le', 'la')).toBe(false);
    expect(areAnswersSimilar('', 'quelque chose')).toBe(false);
  });

  it('respects the threshold argument', () => {
    // A loose match that passes at 0.65 must fail at a stricter threshold.
    expect(areAnswersSimilar('bonjour', 'bonjuor', 0.65)).toBe(true);
    expect(areAnswersSimilar('bonjour', 'bonjuor', 0.95)).toBe(false);
  });
});

describe('isSimilarPair', () => {
  it('is true for genuinely similar real answers', () => {
    expect(isSimilarPair('Le chat', 'le chat')).toBe(true);
    expect(isSimilarPair('bonjour', 'bonjuor')).toBe(true);
  });

  it('is false for different real answers', () => {
    expect(isSimilarPair('chien', 'montagne')).toBe(false);
  });

  it('never merges when either answer is an auto NO_RESPONSE placeholder', () => {
    const noResp = formatNoResponse('Alice', "n'a pas répondu à temps");
    // Even against an identical-looking text, a NO_RESPONSE side must not merge.
    expect(isSimilarPair(noResp, noResp)).toBe(false);
    expect(isSimilarPair(noResp, 'Alice')).toBe(false);
    expect(isSimilarPair('Alice', noResp)).toBe(false);
  });
});
