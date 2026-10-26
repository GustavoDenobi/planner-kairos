import { describe, expect, it } from 'vitest';
import {
  cycleTunerReferenceA4Hz,
  formatTunerReferenceA4Label,
  normalizeTunerReferenceA4Hz,
} from '@/ui/features/repertoire/tuner-reference-a4';

describe('tuner reference A4', () => {
  it('normalizes unknown values to 440', () => {
    expect(normalizeTunerReferenceA4Hz(441)).toBe(440);
    expect(normalizeTunerReferenceA4Hz(432)).toBe(432);
  });

  it('cycles through preset references in order', () => {
    expect(cycleTunerReferenceA4Hz(432)).toBe(440);
    expect(cycleTunerReferenceA4Hz(440)).toBe(442);
    expect(cycleTunerReferenceA4Hz(442)).toBe(432);
  });

  it('formats the display label', () => {
    expect(formatTunerReferenceA4Label(440)).toBe('A = 440 Hz');
  });
});
