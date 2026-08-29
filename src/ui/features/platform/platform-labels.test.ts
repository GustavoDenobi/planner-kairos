import { describe, expect, it } from 'vitest';
import { usagePercent } from '@/ui/features/platform/platform-labels';

describe('usagePercent', () => {
  it('returns null for unlimited plans', () => {
    expect(usagePercent(10, null)).toBeNull();
  });

  it('calculates percentage capped at 100', () => {
    expect(usagePercent(5, 10)).toBe(50);
    expect(usagePercent(20, 10)).toBe(100);
  });
});
