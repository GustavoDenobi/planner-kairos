import { describe, expect, it } from 'vitest';
import {
  pitchClassSolfege,
  transposePitchReading,
} from '@/ui/features/repertoire/tuner-pitch-display';

describe('tuner pitch display', () => {
  it('maps pitch classes to solfege', () => {
    expect(pitchClassSolfege('A')).toBe('Lá');
    expect(pitchClassSolfege('C#')).toBe('Dó♯');
  });

  it('transposes displayed pitch by semitones', () => {
    const reading = {
      name: 'C',
      octave: 4,
      pitch: 60,
      cents: 0,
      confidence: 0.9,
      frequency: 261.6,
    };

    const transposed = transposePitchReading(reading, 9);
    expect(transposed.name).toBe('A');
    expect(transposed.octave).toBe(4);
  });
});
