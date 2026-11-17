import { IconLoader, IconPause, IconPlay } from '@/ui/components/icons';
import {
  useStudyRecordingElapsedMs,
  useStudyRecordingSession,
} from '@/ui/features/study-tools/recording-session/recording-session-context';
import { formatTimerMs } from '@/ui/features/study-tools/study-timer-format';

type StudyRecordingSessionIndicatorProps = {
  hidden: boolean;
};

/**
 * Indicador flutuante de gravação em andamento, visível em qualquer tela que
 * não mostre os próprios controles da gravação.
 */
export function StudyRecordingSessionIndicator({ hidden }: StudyRecordingSessionIndicatorProps) {
  const recording = useStudyRecordingSession();
  const elapsedMs = useStudyRecordingElapsedMs();

  if (hidden) {
    return null;
  }

  const isPaused = recording.status === 'paused';
  const isSaving = recording.status === 'saving';

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed right-3 z-[90] flex items-center gap-1.5 rounded-full border border-border bg-surface py-1 pl-3 pr-1 shadow-lg md:right-4"
      style={{
        bottom: 'calc(var(--app-bottom-nav-offset, 0px) + 0.75rem)',
      }}
    >
      <span
        aria-hidden
        className={`h-2.5 w-2.5 shrink-0 rounded-full bg-red-600 ${
          isPaused || isSaving ? '' : 'animate-pulse'
        }`}
      />
      <span className="text-sm font-medium tabular-nums text-text">
        {isSaving ? 'Salvando…' : formatTimerMs(elapsedMs)}
      </span>
      <span className="sr-only">{isPaused ? 'Gravação pausada' : 'Gravando'}</span>
      {isSaving ? (
        <IconLoader className="mx-2 h-4 w-4 animate-spin text-muted" aria-hidden />
      ) : (
        <>
          {recording.supportsPause ? (
            <button
              type="button"
              onClick={recording.togglePause}
              aria-label={isPaused ? 'Retomar gravação' : 'Pausar gravação'}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-text hover:bg-bg"
            >
              {isPaused ? <IconPlay className="h-4 w-4" /> : <IconPause className="h-4 w-4" />}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void recording.stop()}
            className="inline-flex h-8 items-center justify-center rounded-full bg-primary px-3 text-sm font-medium text-white hover:opacity-90"
          >
            Salvar
          </button>
        </>
      )}
    </div>
  );
}
