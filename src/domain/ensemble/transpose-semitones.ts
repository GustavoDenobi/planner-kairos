export const MIN_PART_TRANSPOSE_SEMITONES = -24;
export const MAX_PART_TRANSPOSE_SEMITONES = 24;

export function clampPartTransposeSemitones(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(
    MAX_PART_TRANSPOSE_SEMITONES,
    Math.max(MIN_PART_TRANSPOSE_SEMITONES, Math.round(value)),
  );
}

export function isValidPartTransposeSemitones(value: number): boolean {
  return (
    Number.isInteger(value)
    && value >= MIN_PART_TRANSPOSE_SEMITONES
    && value <= MAX_PART_TRANSPOSE_SEMITONES
  );
}

export function formatTransposeSemitonesLabel(semitones: number): string {
  const clamped = clampPartTransposeSemitones(semitones);
  if (clamped > 0) {
    return `+${clamped}st`;
  }
  if (clamped < 0) {
    return `${clamped}st`;
  }
  return '0st';
}

const TRANSPOSE_KEY_PITCH_CLASSES = [
  'C',
  'C#',
  'D',
  'Eb',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'Bb',
  'B',
] as const;

export function formatTransposeKeyDisplay(pitchClass: string): string {
  return pitchClass.replaceAll('#', '♯').replace(/([A-G])b/g, '$1♭');
}

/** Tom de transposição relativo a Dó (C + N semitons). */
export function transposeKeyPitchClass(semitones: number): string {
  const clamped = clampPartTransposeSemitones(semitones);
  const index = ((clamped % 12) + 12) % 12;
  const pitchClass = TRANSPOSE_KEY_PITCH_CLASSES[index] ?? 'C';
  return formatTransposeKeyDisplay(pitchClass);
}

export function formatTransposeKeyWithSemitones(semitones: number): string {
  const clamped = clampPartTransposeSemitones(semitones);
  const key = transposeKeyPitchClass(clamped);
  return `${key} (${formatTransposeSemitonesLabel(clamped)})`;
}
