import type { Source } from '@audio-ui/core';
import { useEffect, useRef } from 'react';
import {
  formatCipherLetter,
  pitchClassSolfege,
  transposePitchReading,
} from '@/ui/features/repertoire/tuner-pitch-display';
import type { TunerReferenceA4Hz } from '@/ui/features/repertoire/tuner-reference-a4';
import type { PitchReading } from '@/ui/features/repertoire/usePitch';

const RANGE_CENTS = 50;
const MARKS = [-50, -25, 0, 25, 50] as const;
const NEEDLE_DAMPING = 0.2;

type PdfViewerTunerDisplayProps = {
  source: Source<PitchReading | null>;
  transposeSemitones?: number;
  referenceA4Hz?: TunerReferenceA4Hz;
  tolerance?: number;
  className?: string;
};

function spoken(reading: PitchReading, tolerance: number): string {
  const cipher = formatCipherLetter(reading.name);
  const solfege = pitchClassSolfege(reading.name);
  const note = `${cipher} ${solfege} ${reading.octave}`;
  const cents = Math.round(reading.cents);
  if (Math.abs(reading.cents) <= tolerance) {
    return `${note}, afinado`;
  }
  return `${note}, ${Math.abs(cents)} cents ${cents > 0 ? 'agudo' : 'grave'}`;
}

export function PdfViewerTunerDisplay({
  source,
  transposeSemitones = 0,
  referenceA4Hz = 440,
  tolerance = 5,
  className = '',
}: PdfViewerTunerDisplayProps) {
  const root = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const needleRef = useRef<HTMLSpanElement>(null);
  const note = useRef<HTMLSpanElement>(null);
  const solfege = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = root.current;
    const track = trackRef.current;
    const needle = needleRef.current;
    const nodes = [note, solfege].map((ref) =>
      ref.current?.appendChild(document.createTextNode('')),
    );
    const [noteNode, solfegeNode] = nodes;
    if (!(element && track && needle && noteNode && solfegeNode)) {
      return;
    }

    let targetCents = 0;
    let smoothCents = 0;
    let inTune = false;
    let idle = true;
    let lastReading: PitchReading | null = null;

    const applyTrackState = () => {
      if (idle) {
        track.setAttribute('data-idle', '');
        track.removeAttribute('data-in-tune');
        return;
      }
      track.removeAttribute('data-idle');
      if (inTune) {
        track.setAttribute('data-in-tune', '');
      } else {
        track.removeAttribute('data-in-tune');
      }
    };

    const applyNeedlePosition = () => {
      needle.style.left = `calc(50% + ${smoothCents} * 1%)`;
    };

    const paintDisplay = () => {
      if (!lastReading) {
        noteNode.data = '–';
        solfegeNode.data = '–';
        element.setAttribute('data-idle', '');
        element.removeAttribute('data-in-tune');
        element.setAttribute('aria-valuenow', '0');
        element.setAttribute('aria-valuetext', 'Sem som');
        return;
      }

      const offset = Math.round(lastReading.cents);
      noteNode.data = formatCipherLetter(lastReading.name);
      solfegeNode.data = `${pitchClassSolfege(lastReading.name)} ${lastReading.octave}`;

      if (idle) {
        element.setAttribute('data-idle', '');
        element.removeAttribute('data-in-tune');
        element.setAttribute('aria-valuenow', String(offset));
        element.setAttribute('aria-valuetext', 'Sem som');
        return;
      }

      element.removeAttribute('data-idle');
      if (Math.abs(lastReading.cents) <= tolerance) {
        element.setAttribute('data-in-tune', '');
      } else {
        element.removeAttribute('data-in-tune');
      }
      element.setAttribute('aria-valuenow', String(offset));
      element.setAttribute('aria-valuetext', spoken(lastReading, tolerance));
    };

    const syncFromSource = () => {
      const raw = source.getSnapshot();
      const reading =
        raw === null
          ? null
          : transposePitchReading(raw, transposeSemitones, referenceA4Hz);

      if (!reading) {
        inTune = false;
        idle = true;
      } else {
        lastReading = reading;
        targetCents = reading.cents;
        inTune = Math.abs(reading.cents) <= tolerance;
        idle = false;
      }

      paintDisplay();
      applyTrackState();
    };

    let frameId = 0;
    const tick = () => {
      frameId = requestAnimationFrame(tick);
      const delta = targetCents - smoothCents;
      if (Math.abs(delta) < 0.04) {
        smoothCents = targetCents;
      } else {
        smoothCents += delta * NEEDLE_DAMPING;
      }
      applyNeedlePosition();
    };

    syncFromSource();
    applyNeedlePosition();
    frameId = requestAnimationFrame(tick);
    const unsubscribe = source.subscribe(syncFromSource);

    return () => {
      cancelAnimationFrame(frameId);
      unsubscribe();
      for (const node of nodes) {
        node?.remove();
      }
    };
  }, [referenceA4Hz, source, tolerance, transposeSemitones]);

  return (
    <div
      ref={root}
      role="meter"
      aria-label="Afinador"
      aria-valuemin={-RANGE_CENTS}
      aria-valuemax={RANGE_CENTS}
      aria-valuenow={0}
      aria-valuetext="Sem som"
      data-idle=""
      className={`group/tuner flex items-center gap-2 sm:gap-3 ${className}`}
    >
      <div
        aria-hidden
        className="flex w-[6.75rem] shrink-0 items-baseline justify-end gap-1 leading-none sm:w-[7.25rem]"
      >
        <span
          ref={note}
          className="inline-block w-9 shrink-0 text-right text-2xl font-semibold tabular-nums text-text group-data-idle/tuner:text-muted group-data-idle/tuner:opacity-60 group-data-in-tune/tuner:text-primary group-data-in-tune/tuner:opacity-100"
        />
        <span
          ref={solfege}
          className="inline-block min-w-[3.25rem] shrink-0 truncate text-left text-[11px] tabular-nums text-muted group-data-idle/tuner:opacity-60 sm:min-w-[3.5rem] sm:text-xs"
        />
      </div>

      <div aria-hidden className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-muted">
        <span className="shrink-0 leading-none">♭</span>
        <div
          ref={trackRef}
          data-idle=""
          className="group/track relative h-7 min-h-7 flex-1 overflow-hidden rounded-md border border-border bg-bg opacity-100 shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)] transition-[background-color,border-color,opacity] duration-150 data-idle:opacity-60 data-in-tune:border-tuner-in-tune-border data-in-tune:bg-tuner-in-tune data-in-tune:opacity-100 dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)]"
        >
          <span className="pointer-events-none absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-border/80" />
          {MARKS.map((mark) => (
            <span
              key={mark}
              className={`pointer-events-none absolute bottom-1 w-px -translate-x-1/2 ${
                mark === 0 ? 'top-1 bg-text/70' : 'top-2 bg-border'
              }`}
              style={{ left: `${50 + mark}%` }}
            />
          ))}
          <span
            ref={needleRef}
            className="pointer-events-none absolute bottom-1 top-1 z-[1] w-0.5 -translate-x-1/2 rounded-full bg-text opacity-100 group-data-idle/track:bg-muted group-data-idle/track:opacity-50 group-data-in-tune/track:w-1 group-data-in-tune/track:bg-tuner-in-tune-needle group-data-in-tune/track:opacity-100"
            style={{ left: '50%' }}
          />
        </div>
        <span className="shrink-0 leading-none">♯</span>
      </div>
    </div>
  );
}
