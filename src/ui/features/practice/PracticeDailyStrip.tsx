import type { PracticeDailyDayState, PracticeDailyProgress } from '@/domain/practice';
import {
  formatLocalDateWithWeekday,
  practiceDailySummary,
} from '@/ui/features/practice/practice-labels';

const DAY_CLASS: Record<PracticeDailyDayState, string> = {
  delivered: 'bg-emerald-500 dark:bg-emerald-400',
  missed: 'bg-red-400 dark:bg-red-500',
  open: 'bg-surface ring-2 ring-inset ring-primary',
  upcoming: 'bg-border',
};

const DAY_LABEL: Record<PracticeDailyDayState, string> = {
  delivered: 'entregue',
  missed: 'faltou',
  open: 'em aberto',
  upcoming: 'ainda não chegou',
};

type PracticeDailyStripProps = {
  progress: PracticeDailyProgress;
  /** Mostra o resumo em texto ao lado. */
  showSummary?: boolean;
};

/** Um quadradinho por dia cobrado: verde entregue, vermelho falta, contorno em aberto. */
export function PracticeDailyStrip({ progress, showSummary = true }: PracticeDailyStripProps) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
      <ol className="flex min-w-0 flex-wrap gap-1" aria-label="Dias da tarefa">
        {progress.days.map((day) => {
          const label = `${formatLocalDateWithWeekday(day.date)}: ${DAY_LABEL[day.state]}`;
          return (
            <li
              key={day.date}
              title={label}
              aria-label={label}
              className={`h-3.5 w-3.5 rounded-sm ${DAY_CLASS[day.state]}`}
            />
          );
        })}
      </ol>
      {showSummary ? (
        <span className="text-xs text-muted tabular-nums">{practiceDailySummary(progress)}</span>
      ) : null}
    </div>
  );
}
