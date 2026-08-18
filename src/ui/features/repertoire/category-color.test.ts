import { describe, expect, it } from 'vitest';
import {
  contrastingTextColor,
  formatCategoryHue,
  parseCategoryHue,
} from './category-color';

describe('parseCategoryHue', () => {
  it('parses numeric hue strings', () => {
    expect(parseCategoryHue('220', 'hca')).toBe(220);
  });

  it('maps legacy token colors', () => {
    expect(parseCategoryHue('blue-500', 'instrumental')).toBe(220);
    expect(parseCategoryHue('amber-500', 'hca')).toBe(38);
  });

  it('falls back from slug when color is missing', () => {
    expect(parseCategoryHue(null, 'solo')).toBeTypeOf('number');
  });
});

describe('contrastingTextColor', () => {
  it('uses white text on dark hues', () => {
    expect(contrastingTextColor(220)).toBe('#ffffff');
  });

  it('uses dark text on light hues', () => {
    expect(contrastingTextColor(55, 65, 72)).toBe('#18181b');
  });
});

describe('formatCategoryHue', () => {
  it('stores hue as string', () => {
    expect(formatCategoryHue(123.7)).toBe('124');
  });
});
