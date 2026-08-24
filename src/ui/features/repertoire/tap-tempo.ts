import { clampMetronomeBpm } from '@/ui/features/repertoire/metronome-engine';

export const TAP_TEMPO_RESET_MS = 2000;
export const TAP_TEMPO_WINDOW = 3;

export type TapTempoResult = {
  taps: number[];
  bpm: number | null;
};

function bpmFromLastThreeTaps(taps: number[]): number | null {
  if (taps.length < TAP_TEMPO_WINDOW) {
    return null;
  }

  const lastThree = taps.slice(-TAP_TEMPO_WINDOW);
  const interval1 = lastThree[1]! - lastThree[0]!;
  const interval2 = lastThree[2]! - lastThree[1]!;
  const averageMs = (interval1 + interval2) / 2;

  if (averageMs <= 0) {
    return null;
  }

  return clampMetronomeBpm(60_000 / averageMs);
}

export function registerTapTempo(
  previousTaps: number[],
  timestampMs: number,
  resetAfterMs: number = TAP_TEMPO_RESET_MS,
): TapTempoResult {
  const lastTap = previousTaps.at(-1);
  const shouldReset =
    lastTap !== undefined && timestampMs - lastTap > resetAfterMs;

  const taps = shouldReset
    ? [timestampMs]
    : [...previousTaps, timestampMs].slice(-TAP_TEMPO_WINDOW);

  return {
    taps,
    bpm: bpmFromLastThreeTaps(taps),
  };
}
