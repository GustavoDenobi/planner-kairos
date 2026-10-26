import {
  CONCERT_PITCH_HZ,
  detectPitch,
  type Note,
  nearestNote,
  type PitchDetectionOptions,
  type PitchEstimate,
} from '@audio-ui/core/pitch';
import { createSource, type Source } from '@audio-ui/core';
import { useEffect, useState } from 'react';

export type PitchReading = Note & {
  confidence: number;
  frequency: number;
};

export type UsePitchOptions = PitchDetectionOptions & {
  holdMs?: number;
  median?: number;
  reference?: number;
};

const DETECTIONS_PER_SECOND = 20;

function middle(values: number[]): number {
  return [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;
}

function steadied(
  recent: number[],
  estimate: PitchEstimate,
  size: number,
  reference: number,
): PitchReading | null {
  recent.push(estimate.frequency);
  if (recent.length > size) {
    recent.shift();
  }
  const steady = middle(recent);
  const note = nearestNote(steady, reference);
  return note ? { ...note, confidence: estimate.confidence, frequency: steady } : null;
}

export function usePitch(
  analyser: AnalyserNode | null,
  {
    holdMs = 600,
    maxHz,
    median = 5,
    minHz,
    minLevel,
    reference = CONCERT_PITCH_HZ,
    threshold,
  }: UsePitchOptions = {},
): Source<PitchReading | null> {
  const [source] = useState(() => createSource<PitchReading | null>(null));

  useEffect(() => {
    if (!analyser) {
      source.set(null);
      return;
    }

    const samples = new Float32Array(analyser.fftSize);
    const recent: number[] = [];
    const interval = 1000 / DETECTIONS_PER_SECOND;
    let lastRun = 0;
    let lastHeard = 0;
    let frame = 0;

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (now - lastRun < interval) {
        return;
      }
      lastRun = now;

      analyser.getFloatTimeDomainData(samples);
      const found = detectPitch(samples, analyser.context.sampleRate, {
        maxHz,
        minHz,
        minLevel,
        threshold,
      });

      if (found) {
        lastHeard = now;
        const reading = steadied(recent, found, median, reference);
        if (reading) {
          source.set(reading);
        }
      } else if (now - lastHeard > holdMs) {
        recent.length = 0;
        if (source.getSnapshot() !== null) {
          source.set(null);
        }
      }
    };

    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      source.set(null);
    };
  }, [analyser, holdMs, maxHz, median, minHz, minLevel, reference, source, threshold]);

  return source;
}
