import { describe, expect, it } from 'vitest';
import { formatBirthDateInput } from './birthDateInput';

describe('formatBirthDateInput', () => {
  it('formats digits as DD/MM/YYYY while typing', () => {
    expect(formatBirthDateInput('1')).toBe('1');
    expect(formatBirthDateInput('15')).toBe('15');
    expect(formatBirthDateInput('1505')).toBe('15/05');
    expect(formatBirthDateInput('15051990')).toBe('15/05/1990');
  });

  it('strips non-digits and limits length', () => {
    expect(formatBirthDateInput('15/05/1990abc')).toBe('15/05/1990');
    expect(formatBirthDateInput('150519901234')).toBe('15/05/1990');
  });
});
