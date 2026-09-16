import { describe, expect, it } from 'vitest';
import {
  MUSICAL_SYMBOLS,
  MUSICAL_SYMBOL_CATEGORIES,
  musicalSymbolsForCategory,
} from './musical-symbols';

describe('musical-symbols', () => {
  it('has unique ids', () => {
    const ids = MUSICAL_SYMBOLS.map((symbol) => symbol.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has non-empty labels and chars', () => {
    for (const symbol of MUSICAL_SYMBOLS) {
      expect(symbol.label.trim().length).toBeGreaterThan(0);
      expect(symbol.char.length).toBeGreaterThan(0);
    }
  });

  it('groups symbols by category', () => {
    for (const category of MUSICAL_SYMBOL_CATEGORIES) {
      const symbols = musicalSymbolsForCategory(category);
      expect(symbols.length).toBeGreaterThan(0);
      expect(symbols.every((symbol) => symbol.category === category)).toBe(true);
    }
  });
});
