import { IconPause, IconPlay, IconX } from '@/ui/components/icons';
import {
  METRONOME_BEATS_OPTIONS,
  type MetronomeBeatsPerMeasure,
} from '@/ui/features/repertoire/metronome-engine';
import { useMetronome } from '@/ui/features/repertoire/useMetronome';

type PdfViewerMetronomeBarProps = {
  userId: string | null;
  onClose?: () => void;
  variant?: 'toolbar' | 'embedded';
};

export function PdfViewerMetronomeBar({
  userId,
  onClose,
  variant = 'toolbar',
}: PdfViewerMetronomeBarProps) {
  const {
    isPlaying,
    beatPulse,
    downbeatPulse,
    bpm,
    beatsPerMeasure,
    minBpm,
    maxBpm,
    togglePlay,
    stop,
    setBpm,
    setBeatsPerMeasure,
    registerTap,
  } = useMetronome({ userId });

  const handleClose = () => {
    stop();
    onClose?.();
  };

  const wrapperClass =
    variant === 'embedded'
      ? 'flex flex-wrap items-center justify-center gap-3 py-2'
      : 'flex w-full shrink-0 flex-wrap items-center justify-center gap-2 border-b border-border bg-surface px-3 py-2 sm:gap-3';

  return (
    <div className={wrapperClass}>
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
        className="inline-flex h-8 shrink-0 rounded-lg border border-border bg-surface px-2 text-sm text-text"
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
        className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-border px-2.5 text-sm text-text"
      >
        <span className="sm:hidden">Tap</span>
        <span className="hidden sm:inline">Marcar</span>
      </button>

      {onClose ? (
        <button
          type="button"
          onClick={handleClose}
          aria-label="Fechar metrônomo"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted hover:text-text"
        >
          <IconX className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
