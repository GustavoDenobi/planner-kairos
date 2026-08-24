import { describe, expect, it } from 'vitest';
import { registerTapTempo, TAP_TEMPO_RESET_MS } from './tap-tempo';

describe('registerTapTempo', () => {
  it('returns null bpm with fewer than three taps', () => {
    const first = registerTapTempo([], 1000);
    expect(first.bpm).toBeNull();

    const second = registerTapTempo(first.taps, 1500);
    expect(second.bpm).toBeNull();
  });

  it('calculates bpm from the last three evenly spaced taps', () => {
    let taps: number[] = [];

    for (const timestamp of [0, 500, 1000]) {
      const result = registerTapTempo(taps, timestamp);
      taps = result.taps;
      if (timestamp === 1000) {
        expect(result.bpm).toBe(120);
      }
    }
  });

  it('recalculates using only the last three taps', () => {
    let taps: number[] = [];
    let lastResult = registerTapTempo(taps, 0);

    for (const timestamp of [0, 500, 1000, 1500]) {
      lastResult = registerTapTempo(taps, timestamp);
      taps = lastResult.taps;
    }

    expect(taps).toEqual([500, 1000, 1500]);
    expect(lastResult.bpm).toBe(120);
  });

  it('resets tap sequence after timeout', () => {
    const first = registerTapTempo([], 1000);
    const second = registerTapTempo(first.taps, 1500);
    const third = registerTapTempo(second.taps, 2000);
    expect(third.bpm).toBe(120);

    const reset = registerTapTempo(third.taps, 2000 + TAP_TEMPO_RESET_MS + 1);
    expect(reset.taps).toEqual([2000 + TAP_TEMPO_RESET_MS + 1]);
    expect(reset.bpm).toBeNull();
  });
});
