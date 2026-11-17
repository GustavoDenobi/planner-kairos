import { Link } from 'react-router-dom';
import type { PracticeDailyDayState } from '@/domain/practice';
import type { AgendaPracticeTaskItem } from '@/ui/features/agenda/agenda-practice-tasks';
import {
  PRACTICE_STATUS_CLASS,
  PRACTICE_STATUS_LABEL,
} from '@/ui/features/practice/practice-labels';
import { practiceTaskPath } from '@/ui/features/practice/practice-routes';

const DAY_STATE_LABEL: Record<PracticeDailyDayState, string> = {
  delivered: 'Entregue',
  missed: 'Não entregue',
  open: 'Em aberto',
  upcoming: 'A fazer',
};

const DAY_STATE_CLASS: Record<PracticeDailyDayState, string> = {
  delivered: PRACTICE_STATUS_CLASS.reviewed,
  missed: PRACTICE_STATUS_CLASS.missed,
  open: 'bg-primary/10 text-primary',
  upcoming: PRACTICE_STATUS_CLASS.pending,
};

const timeFormatter = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

type AgendaPracticeTaskCardProps = {
  orgSlug: string;
  item: AgendaPracticeTaskItem;
};

export function AgendaPracticeTaskCard({ orgSlug, item }: AgendaPracticeTaskCardProps) {
  const subtitle =
    item.cadence === 'daily'
      ? 'Tarefa diária'
      : `Tarefa · até ${timeFormatter.format(new Date(item.dueAt))}`;
  const badgeLabel =
    item.cadence === 'daily' ? DAY_STATE_LABEL[item.dayState] : PRACTICE_STATUS_LABEL[item.status];
  const badgeClass =
    item.cadence === 'daily' ? DAY_STATE_CLASS[item.dayState] : PRACTICE_STATUS_CLASS[item.status];

  return (
    <Link
      to={practiceTaskPath(orgSlug, item.taskId)}
      className="block max-w-full overflow-hidden rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:bg-bg"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-text">{item.title}</p>
          <p className="mt-0.5 text-sm text-muted">{subtitle}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClass}`}
        >
          {badgeLabel}
        </span>
      </div>
    </Link>
  );
}
