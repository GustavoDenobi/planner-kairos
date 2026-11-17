import type {
  LocalDate,
  PracticeDailyProgress,
  PracticeTask,
  PracticeTaskStudentStatus,
} from '@/domain/practice';
import { PRACTICE_DAILY_ALL_WEEKDAYS, weekdayOfLocalDate } from '@/domain/practice';

export const PRACTICE_STATUS_LABEL: Record<PracticeTaskStudentStatus, string> = {
  pending: 'Pendente',
  late: 'Atrasada',
  missed: 'Não entregue',
  submitted: 'Enviada',
  reviewed: 'Revisada',
  redo_requested: 'Refazer',
};

export const PRACTICE_STATUS_CLASS: Record<PracticeTaskStudentStatus, string> = {
  pending: 'bg-bg text-muted',
  late: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  missed: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  submitted: 'bg-primary/10 text-primary',
  reviewed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  redo_requested: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
};

const ERROR_MESSAGES: Record<string, string> = {
  not_a_member: 'Você não faz parte desta organização.',
  not_allowed: 'Você não tem permissão para isso.',
  not_found: 'Tarefa não encontrada.',
  title_required: 'Dê um título à tarefa.',
  title_too_long: 'O título está longo demais.',
  instructions_too_long: 'As instruções estão longas demais.',
  invalid_due_at: 'Informe até quando a tarefa deve ser entregue.',
  audience_required: 'Escolha pelo menos um aluno ou grupo.',
  audience_not_allowed: 'Você só pode passar tarefas para os grupos em que dá aula ou rege.',
  invalid_reference: 'A partitura escolhida não está mais disponível.',
  load_failed: 'Não foi possível carregar as tarefas. Verifique a conexão e tente de novo.',
  save_failed: 'Não foi possível salvar. Tente de novo.',
  delete_failed: 'Não foi possível excluir. Tente de novo.',
  not_a_student: 'Esta tarefa não foi passada para você.',
  task_closed: 'Esta tarefa já foi encerrada.',
  already_reviewed: 'Seu envio já foi revisado.',
  past_due: 'O prazo desta tarefa terminou e ela não aceita envios atrasados.',
  empty_recording: 'A gravação está vazia.',
  recording_too_large: 'A gravação é grande demais para enviar.',
  unsupported_format: 'Formato de áudio não suportado.',
  note_too_long: 'O recado está longo demais.',
  upload_failed: 'Não foi possível enviar o áudio. Verifique a conexão e tente de novo.',
  feedback_required: 'Diga ao aluno o que refazer.',
  feedback_too_long: 'O comentário está longo demais.',
  url_failed: 'Não foi possível carregar o áudio.',
  invalid_schedule: 'Informe o primeiro e o último dia da tarefa.',
  schedule_too_long: 'A tarefa diária pode durar no máximo um ano.',
  weekdays_required: 'Escolha pelo menos um dia da semana dentro do período.',
  not_a_delivery_day: 'Hoje não é dia de entrega desta tarefa.',
  recording_not_from_today: 'Na tarefa diária, só vale a gravação feita no próprio dia.',
  redo_not_allowed: 'Tarefas diárias não têm pedido para refazer.',
};

export function practiceErrorMessage(error: string): string {
  return ERROR_MESSAGES[error] ?? 'Algo deu errado. Tente de novo.';
}

const dueFormatter = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

/** Ex.: "qui., 06/11, 18:00". */
export function formatPracticeDueAt(dueAt: string): string {
  return dueFormatter.format(new Date(dueAt));
}

export function formatPracticeDateTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

/** Ex.: "09/11". */
export function formatLocalDateShort(date: LocalDate): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

const WEEKDAY_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
/** Iniciais na ordem da semana brasileira (seg primeiro). */
export const WEEKDAY_PICKER: ReadonlyArray<{ value: number; short: string; label: string }> = [
  { value: 1, short: 'S', label: 'segunda' },
  { value: 2, short: 'T', label: 'terça' },
  { value: 3, short: 'Q', label: 'quarta' },
  { value: 4, short: 'Q', label: 'quinta' },
  { value: 5, short: 'S', label: 'sexta' },
  { value: 6, short: 'S', label: 'sábado' },
  { value: 0, short: 'D', label: 'domingo' },
];

/** Ex.: "qui., 12/11". */
export function formatLocalDateWithWeekday(date: LocalDate): string {
  return `${WEEKDAY_SHORT[weekdayOfLocalDate(date)]}., ${formatLocalDateShort(date)}`;
}

/** Ex.: "todo dia", "seg a sex", "seg, qua, sex". */
export function formatWeekdays(weekdays: readonly number[]): string {
  const set = new Set(weekdays);
  if (PRACTICE_DAILY_ALL_WEEKDAYS.every((day) => set.has(day))) {
    return 'todo dia';
  }
  if (set.size === 5 && [1, 2, 3, 4, 5].every((day) => set.has(day))) {
    return 'seg a sex';
  }
  return WEEKDAY_PICKER.filter((day) => set.has(day.value))
    .map((day) => WEEKDAY_SHORT[day.value])
    .join(', ');
}

/** Resumo do prazo: "até qui., 12/11, 18:00" ou "Diária · seg a sex · 09/11 a 20/11". */
export function formatPracticeTaskSchedule(
  task: Pick<PracticeTask, 'cadence' | 'daily' | 'dueAt'>,
): string {
  if (task.cadence === 'daily' && task.daily) {
    return `Diária · ${formatWeekdays(task.daily.weekdays)} · ${formatLocalDateShort(
      task.daily.startsOn,
    )} a ${formatLocalDateShort(task.daily.endsOn)}`;
  }
  return `até ${formatPracticeDueAt(task.dueAt)}`;
}

/** Resumo da tarefa diária: "8 de 10 dias · 3 seguidos". */
export function practiceDailySummary(progress: PracticeDailyProgress): string {
  const days = `${progress.delivered} de ${progress.elapsed} ${progress.elapsed === 1 ? 'dia' : 'dias'}`;
  return progress.streak > 1 ? `${days} · ${progress.streak} seguidos` : days;
}

/** Prazo padrão quando não há evento próximo: daqui a 7 dias, 23:59 local. */
export function defaultPracticeDueAt(now: Date = new Date()): Date {
  const due = new Date(now);
  due.setDate(due.getDate() + 7);
  due.setHours(23, 59, 0, 0);
  return due;
}
