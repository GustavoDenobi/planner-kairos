export const TUNER_REFERENCE_A4_OPTIONS = [432, 440, 442] as const;

export type TunerReferenceA4Hz = (typeof TUNER_REFERENCE_A4_OPTIONS)[number];

export const DEFAULT_TUNER_REFERENCE_A4_HZ: TunerReferenceA4Hz = 440;

export function normalizeTunerReferenceA4Hz(value: unknown): TunerReferenceA4Hz {
  if (value === 432 || value === 442) {
    return value;
  }
  return DEFAULT_TUNER_REFERENCE_A4_HZ;
}

export function cycleTunerReferenceA4Hz(current: number): TunerReferenceA4Hz {
  const normalized = normalizeTunerReferenceA4Hz(current);
  const index = TUNER_REFERENCE_A4_OPTIONS.indexOf(normalized);
  const nextIndex = index < 0 ? 0 : (index + 1) % TUNER_REFERENCE_A4_OPTIONS.length;
  return TUNER_REFERENCE_A4_OPTIONS[nextIndex] ?? DEFAULT_TUNER_REFERENCE_A4_HZ;
}

export function formatTunerReferenceA4Label(hz: TunerReferenceA4Hz): string {
  return `A = ${hz} Hz`;
}
