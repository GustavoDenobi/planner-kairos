import { useMemo } from 'react';
import {
  IconPause,
  IconPlay,
  IconVolume,
  IconVolumeMuted,
  IconX,
} from '@/ui/components/icons';
import { isIosVolumeControlUnsupported } from '@/ui/features/repertoire/audio-device';
import {
  METRONOME_BEATS_OPTIONS,
  type MetronomeBeatsPerMeasure,
} from '@/ui/features/repertoire/metronome-engine';
import { useMetronome } from '@/ui/features/repertoire/useMetronome';

type PdfViewerMetronomeBarProps = {
  userId: string | null;
  onClose: () => void;
};

export function PdfViewerMetronomeBar({ userId, onClose }: PdfViewerMetronomeBarProps) {
  const {
    isPlaying,
    beatPulse,
    downbeatPulse,
    bpm,
    beatsPerMeasure,
    volume,
    minBpm,
    maxBpm,
    togglePlay,
    stop,
    setBpm,
    setBeatsPerMeasure,
    setVolume,
    registerTap,
  } = useMetronome({ userId });

  const supportsVolumeControl = useMemo(() => !isIosVolumeControlUnsupported(), []);

  const handleClose = () => {
    stop();
    onClose();
  };

  return (
    <div className="flex w-full shrink-0 flex-wrap items-center justify-center gap-2 border-b border-border bg-surface px-3 py-2 sm:gap-3">
      <button
        type="button"
        onClick={() => void togglePlay()}
        aria-label={isPlaying ? 'Pausar metrônomo' : 'Iniciar metrônomo'}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-text"
      >
        {isPlaying ? <IconPause className="h-4 w-4" /> : <IconPlay className="h-4 w-4" />}
      </button>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={() => setBpm(bpm - 1)}
          disabled={bpm <= minBpm}
          aria-label="Diminuir BPM"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-sm text-text disabled:opacity-40"
        >
          −
        </button>

        <span
          key={isPlaying ? beatPulse : 'idle'}
          aria-label="Batidas por minuto"
          className={`inline-flex h-8 min-w-10 items-center justify-center rounded-lg px-2 tabular-nums text-sm font-medium text-text ${
            isPlaying && beatPulse > 0 ? 'metronome-bpm-pulse' : ''
          } ${isPlaying && beatPulse > 0 && downbeatPulse ? 'metronome-bpm-pulse-downbeat' : ''}`}
        >
          {bpm}
        </span>

        <button
          type="button"
          onClick={() => setBpm(bpm + 1)}
          disabled={bpm >= maxBpm}
          aria-label="Aumentar BPM"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-sm text-text disabled:opacity-40"
        >
          +
        </button>
      </div>

      <label className="sr-only" htmlFor="metronome-beats-per-measure">
        Tempos por compasso
      </label>
      <select
        id="metronome-beats-per-measure"
        value={beatsPerMeasure}
        onChange={(event) =>
          setBeatsPerMeasure(Number(event.target.value) as MetronomeBeatsPerMeasure)
        }
        aria-label="Tempos por compasso"
        className="shrink-0 rounded-lg border border-border bg-surface px-2 py-1 text-sm text-text"
      >
        {METRONOME_BEATS_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={registerTap}
        aria-label="Marcar tempo"
        title="Marcar tempo"
        className="shrink-0 rounded-lg border border-border px-2 py-1 text-xs text-text sm:text-sm"
      >
        <span className="sm:hidden">Tap</span>
        <span className="hidden sm:inline">Marcar</span>
      </button>

      {supportsVolumeControl ? (
        <>
          <button
            type="button"
            onClick={() => setVolume(volume > 0 ? 0 : 0.8)}
            aria-label={volume > 0 ? 'Silenciar metrônomo' : 'Ativar som do metrônomo'}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-text sm:hidden"
          >
            {volume > 0 ? (
              <IconVolume className="h-4 w-4" />
            ) : (
              <IconVolumeMuted className="h-4 w-4" />
            )}
          </button>

          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
            aria-label="Volume do metrônomo"
            className="hidden w-20 shrink-0 accent-primary sm:block"
          />
        </>
      ) : null}

      <button
        type="button"
        onClick={handleClose}
        aria-label="Fechar metrônomo"
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted hover:text-text"
      >
        <IconX className="h-4 w-4" />
      </button>
    </div>
  );
}
