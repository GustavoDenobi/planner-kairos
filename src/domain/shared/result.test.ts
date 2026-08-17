import { describe, expect, it } from 'vitest';
import { Result } from './result';

describe('Result', () => {
  it('creates ok result', () => {
    const result = Result.ok(42);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(42);
    }
  });

  it('creates fail result', () => {
    const result = Result.fail('error');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('error');
    }
  });
});
