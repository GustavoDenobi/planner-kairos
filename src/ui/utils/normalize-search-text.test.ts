import { describe, expect, it } from 'vitest';
import { matchesSearchText, normalizeSearchText } from './normalize-search-text';

describe('normalizeSearchText', () => {
  it('lowercases and removes accents', () => {
    expect(normalizeSearchText('  Violoncelo  ')).toBe('violoncelo');
    expect(normalizeSearchText('Saxofone Alto')).toBe('saxofone alto');
  });
});

describe('matchesSearchText', () => {
  it('matches substring ignoring case and accents', () => {
    expect(matchesSearchText('Contrabaixo Acústico', 'acustico')).toBe(true);
    expect(matchesSearchText('Violino', 'viol')).toBe(true);
    expect(matchesSearchText('Viola', 'violino')).toBe(false);
  });

  it('returns true for empty query', () => {
    expect(matchesSearchText('Violino', '   ')).toBe(true);
  });
});
