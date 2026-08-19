import { describe, expect, it } from 'vitest';

import { normalizeEnvUrl } from './normalizeEnvUrl';

describe('normalizeEnvUrl', () => {
  it('trims whitespace, strips trailing slash and escaped newlines', () => {
    expect(normalizeEnvUrl('https://planner.d9digital.com/ ')).toBe('https://planner.d9digital.com');
    expect(normalizeEnvUrl('https://example.supabase.co\\r\\n')).toBe('https://example.supabase.co');
    expect(normalizeEnvUrl('https://planner.d9digital.com\r\n')).toBe('https://planner.d9digital.com');
  });
});
