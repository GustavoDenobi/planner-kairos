import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MetronomeEngine,
  clampMetronomeBpm,
  metronomeBeatIntervalSec,
  normalizeBeatsPerMeasure,
} from './metronome-engine';

describe('metronome helpers', () => {
  it('clamps bpm to supported range', () => {
    expect(clampMetronomeBpm(10)).toBe(40);
    expect(clampMetronomeBpm(300)).toBe(208);
    expect(clampMetronomeBpm(120.7)).toBe(121);
  });

  it('computes beat interval from bpm', () => {
    expect(metronomeBeatIntervalSec(120)).toBe(0.5);
    expect(metronomeBeatIntervalSec(60)).toBe(1);
  });

  it('normalizes beats per measure to supported options', () => {
    expect(normalizeBeatsPerMeasure(3)).toBe(3);
    expect(normalizeBeatsPerMeasure(99)).toBe(4);
  });
});

describe('MetronomeEngine', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('reports beat index within measure', () => {
    const engine = new MetronomeEngine({
      bpm: 120,
      beatsPerMeasure: 4,
      volume: 0.8,
    });

    expect(engine.currentBeatIndex).toBe(0);
  });

  it('resets beat index when beats per measure changes', () => {
    const engine = new MetronomeEngine({
      bpm: 120,
      beatsPerMeasure: 4,
      volume: 0.8,
    });

    engine.setBeatsPerMeasure(3);
    expect(engine.currentBeatIndex).toBe(0);
  });

  it('stops scheduling and closes audio context', async () => {
    vi.useFakeTimers();

    const close = vi.fn().mockResolvedValue(undefined);
    const resume = vi.fn().mockResolvedValue(undefined);
    const createOscillator = vi.fn(() => ({
      type: 'sine',
      frequency: { value: 0 },
      connect: vi.fn().mockReturnThis(),
      start: vi.fn(),
      stop: vi.fn(),
    }));
    const createGain = vi.fn(() => ({
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn().mockReturnThis(),
    }));

    class MockAudioContext {
      currentTime = 0;
      state: AudioContextState = 'running';
      destination = {};
      resume = resume;
      close = close;
      createOscillator = createOscillator;
      createGain = createGain;
    }

    vi.stubGlobal('AudioContext', MockAudioContext);

    const onBeat = vi.fn();
    const engine = new MetronomeEngine({
      bpm: 120,
      beatsPerMeasure: 4,
      volume: 0.8,
      onBeat,
    });

    await engine.start();
    expect(engine.isRunning).toBe(true);

    await vi.advanceTimersByTimeAsync(200);
    expect(onBeat).toHaveBeenCalled();

    engine.stop();
    expect(engine.isRunning).toBe(false);
    expect(close).toHaveBeenCalled();
  });
});
