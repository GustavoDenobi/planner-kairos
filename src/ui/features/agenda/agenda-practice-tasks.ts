import type { AssignedPracticeTaskItem } from '@/application/practice';
import type { LocalDate, PracticeDailyDayState, PracticeTaskStudentStatus } from '@/domain/practice';

/** Uma tarefa num dia da agenda: o prazo (tarefa de uma vez) ou um dia de entrega (diária). */
export type AgendaPracticeTaskItem =
  | {
      key: string;
      taskId: string;
      title: string;
      date: Date;
      cadence: 'once';
      dueAt: string;
      status: PracticeTaskStudentStatus;
    }
  | {
      key: string;
      taskId: string;
      title: string;
      date: Date;
      cadence: 'daily';
      dayState: PracticeDailyDayState;
    };

function localDateToDate(date: LocalDate): Date {
  return new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)));
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Itens da agenda no intervalo [from, to): o prazo de cada tarefa e cada dia das diárias. */
export function buildAgendaPracticeTaskItems(
  items: AssignedPracticeTaskItem[],
  range: { from: Date; to: Date },
): AgendaPracticeTaskItem[] {
  const inRange = (date: Date) => date >= range.from && date < range.to;
  const result: AgendaPracticeTaskItem[] = [];

  for (const { task, progress } of items) {
    if (task.cadence === 'daily') {
      for (const day of progress.daily?.days ?? []) {
        const date = localDateToDate(day.date);
        if (inRange(date)) {
          result.push({
            key: `${task.id}-${day.date}`,
            taskId: task.id,
            title: task.title,
            date,
            cadence: 'daily',
            dayState: day.state,
          });
        }
      }
      continue;
    }

    const date = startOfDay(new Date(task.dueAt));
    if (inRange(date)) {
      result.push({
        key: task.id,
        taskId: task.id,
        title: task.title,
        date,
        cadence: 'once',
        dueAt: task.dueAt,
        status: progress.status,
      });
    }
  }

  return result;
}
