import { useEffect, useState } from 'react';
import { IconClock, IconPause, IconPlay } from '@/ui/components/icons';
import { StudyCountdownDurationModal } from '@/ui/features/study-tools/StudyCountdownDurationModal';
import { useStudyTimer, type StudyTimerMode } from '@/ui/features/study-tools/useStudyTimer';

const iconButtonClass =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-text disabled:opacity-40';
const textButtonClass =
  'inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-border px-3 text-sm text-text disabled:opacity-40';

const displayClassName =
  'mt-4 w-full rounded-xl border border-border px-4 py-6 text-center tabular-nums';

export function StudyTimerCard() {
  const timer = useStudyTimer();
  const [durationModalOpen, setDurationModalOpen] = useState(false);

  useEffect(() => {
    if (timer.mode !== 'countdown') {
      setDurationModalOpen(false);
    }
  }, [timer.mode]);

  const modeDisabled = timer.isRunning;

  const displaySurfaceClass = timer.isAlerting
    ? 'study-timer-finished-blink'
    : 'bg-bg';

  const displayContent = (
    <span className="text-4xl font-semibold tracking-wide text-text sm:text-5xl">
      {timer.formattedTime}
    </span>
  );

  return (
    <section
      aria-labelledby="study-timer-heading"
      className="flex flex-col rounded-xl border border-border bg-surface p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2
          id="study-timer-heading"
          className="flex min-w-0 items-center gap-2 text-base font-semibold text-text"
        >
          <IconClock className="h-5 w-5 shrink-0" aria-hidden />
          Cronômetro
        </h2>

        <div
          className="flex shrink-0 rounded-lg border border-border p-0.5"
          role="group"
          aria-label="Modo do cronômetro"
        >
          {(
            [
              ['progressive', 'Progressiva'],
              ['countdown', 'Regressiva'],
            ] as const satisfies ReadonlyArray<[StudyTimerMode, string]>
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              disabled={modeDisabled}
              aria-pressed={timer.mode === value}
              onClick={() => timer.setMode(value)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors sm:text-sm ${
                timer.mode === value
                  ? 'bg-primary text-white'
                  : 'text-muted hover:text-text disabled:hover:text-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {timer.canEditCountdownDuration ? (
        <button
          type="button"
          onClick={() => setDurationModalOpen(true)}
          aria-label="Definir tempo regressivo"
          className={`${displayClassName} ${displaySurfaceClass} transition-colors hover:border-primary/40`}
        >
          {displayContent}
        </button>
      ) : (
        <div
          className={`${displayClassName} ${displaySurfaceClass}`}
          aria-live="polite"
          aria-atomic
        >
          {displayContent}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={timer.toggleRunning}
          disabled={!timer.canStartCountdown && !timer.isRunning}
          aria-label={timer.isRunning ? 'Pausar cronômetro' : 'Iniciar cronômetro'}
          className={iconButtonClass}
        >
          {timer.isRunning ? <IconPause className="h-4 w-4" /> : <IconPlay className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={timer.reset}
          disabled={timer.status === 'idle'}
          className={textButtonClass}
        >
          Zerar
        </button>
      </div>

      <StudyCountdownDurationModal
        open={durationModalOpen}
        onClose={() => setDurationModalOpen(false)}
        minutes={timer.countdownMinutes}
        seconds={timer.countdownSeconds}
        onConfirm={timer.applyCountdownDuration}
      />
    </section>
  );
}
