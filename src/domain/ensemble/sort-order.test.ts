import { describe, expect, it } from 'vitest';
import { compareByName, nextSortOrder, sortOrdersFromIds } from './sort-order';

describe('compareByName', () => {
  it('sorts numerically within strings', () => {
    expect(compareByName('1', '2')).toBeLessThan(0);
    expect(compareByName('2', '10')).toBeLessThan(0);
    expect(compareByName('div. B', 'div. A')).toBeGreaterThan(0);
  });
});

describe('nextSortOrder', () => {
  it('returns 1 for empty list', () => {
    expect(nextSortOrder([])).toBe(1);
  });

  it('returns max + 1', () => {
    expect(nextSortOrder([{ sortOrder: 1 }, { sortOrder: 3 }])).toBe(4);
  });
});

describe('sortOrdersFromIds', () => {
  it('assigns 1-based order', () => {
    const map = sortOrdersFromIds(['a', 'b', 'c']);
    expect(map.get('a')).toBe(1);
    expect(map.get('b')).toBe(2);
    expect(map.get('c')).toBe(3);
  });
});
