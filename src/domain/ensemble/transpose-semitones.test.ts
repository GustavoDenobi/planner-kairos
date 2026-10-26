import { describe, expect, it } from 'vitest';
import {
  clampPartTransposeSemitones,
  formatTransposeKeyWithSemitones,
  formatTransposeSemitonesLabel,
  transposeKeyPitchClass,
} from '@/domain/ensemble/transpose-semitones';

describe('transpose semitones helpers', () => {
  it('clamps values to the allowed range', () => {
    expect(clampPartTransposeSemitones(40)).toBe(24);
    expect(clampPartTransposeSemitones(-30)).toBe(-24);
  });

  it('formats labels with sign', () => {
    expect(formatTransposeSemitonesLabel(9)).toBe('+9st');
    expect(formatTransposeSemitonesLabel(-2)).toBe('-2st');
    expect(formatTransposeSemitonesLabel(0)).toBe('0st');
  });

  it('maps semitones to transposition key pitch class', () => {
    expect(transposeKeyPitchClass(3)).toBe('E♭');
    expect(transposeKeyPitchClass(0)).toBe('C');
    expect(transposeKeyPitchClass(1)).toBe('C♯');
    expect(transposeKeyPitchClass(6)).toBe('F♯');
    expect(transposeKeyPitchClass(8)).toBe('G♯');
  });

  it('formats key with semitones for display', () => {
    expect(formatTransposeKeyWithSemitones(3)).toBe('E♭ (+3st)');
  });
});
