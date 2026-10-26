import { nearestNote, noteToFrequency } from '@audio-ui/core/pitch';
import type { PitchReading } from '@/ui/features/repertoire/usePitch';

const SOLFEGE_BY_PITCH_CLASS: Record<string, string> = {
  C: 'Dó',
  'C#': 'Dó♯',
  D: 'Ré',
  'D#': 'Ré♯',
  E: 'Mi',
  F: 'Fá',
  'F#': 'Fá♯',
  G: 'Sol',
  'G#': 'Sol♯',
  A: 'Lá',
  'A#': 'Lá♯',
  B: 'Si',
};

export function pitchClassSolfege(pitchClassName: string): string {
  return SOLFEGE_BY_PITCH_CLASS[pitchClassName] ?? pitchClassName;
}

export function formatCipherLetter(pitchClassName: string): string {
  return pitchClassName.replace('#', '♯');
}

export function transposePitchReading(
  reading: PitchReading,
  semitones: number,
  reference = 440,
): PitchReading {
  if (semitones === 0) {
    return reading;
  }

  const transposedPitch = reading.pitch + semitones;
  const frequency = noteToFrequency(transposedPitch, reference);
  const note = nearestNote(frequency, reference);
  if (!note) {
    return reading;
  }

  return {
    ...note,
    confidence: reading.confidence,
    frequency,
  };
}
