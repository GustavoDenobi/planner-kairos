/**
 * Tarefa diária: o aluno entrega uma gravação por dia cobrado, como prova de estudo.
 * "Hoje" é sempre o dia no fuso da organização. Mesmas regras de
 * supabase/migrations/20261110120000_practice_daily_tasks.sql.
 */

/** Data local no formato AAAA-MM-DD. */
export type LocalDate = string;

export type PracticeDailySchedule = {
  startsOn: LocalDate;
  endsOn: LocalDate;
  /** Dias da semana cobrados: 0 = domingo … 6 = sábado. */
  weekdays: number[];
};

export const PRACTICE_DAILY_ALL_WEEKDAYS: readonly number[] = [0, 1, 2, 3, 4, 5, 6];
/** Uma gravação feita num dia ainda conta para ele se enviada até esta hora do dia seguinte. */
export const PRACTICE_DAILY_GRACE_HOURS = 2;
export const PRACTICE_DAILY_MAX_SPAN_DAYS = 366;
export const DEFAULT_ORGANIZATION_TIME_ZONE = 'America/Sao_Paulo';

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidLocalDate(value: string): boolean {
  if (!LOCAL_DATE_PATTERN.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(0);
    return true;
  } catch {
    return false;
  }
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = partsFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    partsFormatters.set(timeZone, formatter);
  }
  return formatter;
}

/** Data e hora locais de um instante no fuso indicado. */
export function localDateTimeIn(
  instant: Date,
  timeZone: string,
): { date: LocalDate; hour: number; minute: number } {
  const parts = partsFormatter(timeZone).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '00';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')) % 24,
    minute: Number(get('minute')),
  };
}

export function localDateIn(instant: Date, timeZone: string): LocalDate {
  return localDateTimeIn(instant, timeZone).date;
}

export function addDaysToLocalDate(date: LocalDate, days: number): LocalDate {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Dias de `from` até `to` (negativo se `to` vem antes). */
export function daysBetweenLocalDates(from: LocalDate, to: LocalDate): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000,
  );
}

export function weekdayOfLocalDate(date: LocalDate): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function isPracticeDailyChargedDay(schedule: PracticeDailySchedule, date: LocalDate): boolean {
  return (
    date >= schedule.startsOn &&
    date <= schedule.endsOn &&
    schedule.weekdays.includes(weekdayOfLocalDate(date))
  );
}

/** Todos os dias cobrados do período, em ordem. */
export function listPracticeDailyChargedDays(schedule: PracticeDailySchedule): LocalDate[] {
  const days: LocalDate[] = [];
  const span = Math.min(
    daysBetweenLocalDates(schedule.startsOn, schedule.endsOn),
    PRACTICE_DAILY_MAX_SPAN_DAYS,
  );
  for (let offset = 0; offset <= span; offset += 1) {
    const day = addDaysToLocalDate(schedule.startsOn, offset);
    if (schedule.weekdays.includes(weekdayOfLocalDate(day))) {
      days.push(day);
    }
  }
  return days;
}

export type PracticeDailyScheduleError = 'invalid_schedule' | 'schedule_too_long' | 'weekdays_required';

export function normalizePracticeDailySchedule(schedule: PracticeDailySchedule): PracticeDailySchedule {
  return {
    ...schedule,
    weekdays: [...new Set(schedule.weekdays)].sort((a, b) => a - b),
  };
}

export function validatePracticeDailySchedule(
  schedule: PracticeDailySchedule,
): PracticeDailyScheduleError | null {
  if (!isValidLocalDate(schedule.startsOn) || !isValidLocalDate(schedule.endsOn)) {
    return 'invalid_schedule';
  }
  if (schedule.endsOn < schedule.startsOn) {
    return 'invalid_schedule';
  }
  if (daysBetweenLocalDates(schedule.startsOn, schedule.endsOn) > PRACTICE_DAILY_MAX_SPAN_DAYS) {
    return 'schedule_too_long';
  }
  if (
    schedule.weekdays.length === 0 ||
    schedule.weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
  ) {
    return 'weekdays_required';
  }
  if (listPracticeDailyChargedDays(schedule).length === 0) {
    return 'weekdays_required';
  }
  return null;
}

/**
 * Dia a que pertence uma gravação feita em `recordedAt` e enviada em `at`
 * (null se não cai em nenhum dia cobrado). A gravação tem de ser do próprio dia;
 * a de ontem ainda vale até {@link PRACTICE_DAILY_GRACE_HOURS}h.
 */
export function practiceDailyPeriodFor(input: {
  schedule: PracticeDailySchedule;
  timeZone: string;
  recordedAt: Date;
  at: Date;
}): LocalDate | null {
  const now = localDateTimeIn(input.at, input.timeZone);
  const recordedDay = localDateIn(input.recordedAt, input.timeZone);
  if (recordedDay === now.date && isPracticeDailyChargedDay(input.schedule, now.date)) {
    return now.date;
  }
  const yesterday = addDaysToLocalDate(now.date, -1);
  if (
    recordedDay === yesterday &&
    now.hour < PRACTICE_DAILY_GRACE_HOURS &&
    isPracticeDailyChargedDay(input.schedule, yesterday)
  ) {
    return yesterday;
  }
  return null;
}

/** Dias que ainda aceitam envio agora: hoje e, na tolerância da madrugada, ontem. */
export function practiceDailyOpenDays(input: {
  schedule: PracticeDailySchedule;
  timeZone: string;
  now: Date;
}): LocalDate[] {
  const now = localDateTimeIn(input.now, input.timeZone);
  const open: LocalDate[] = [];
  const yesterday = addDaysToLocalDate(now.date, -1);
  if (now.hour < PRACTICE_DAILY_GRACE_HOURS && isPracticeDailyChargedDay(input.schedule, yesterday)) {
    open.push(yesterday);
  }
  if (isPracticeDailyChargedDay(input.schedule, now.date)) {
    open.push(now.date);
  }
  return open;
}

export type PracticeDailyDayState = 'delivered' | 'missed' | 'open' | 'upcoming';

export type PracticeDailyDay = {
  date: LocalDate;
  state: PracticeDailyDayState;
};

export type PracticeDailyProgress = {
  /** Hoje, no fuso da organização. */
  today: LocalDate;
  /** Dias cobrados do período (até o encerramento, se a tarefa foi encerrada). */
  days: PracticeDailyDay[];
  /** Dias que ainda aceitam envio agora. */
  openDays: LocalDate[];
  delivered: number;
  missed: number;
  /** Dias cobrados que já começaram (entregues, faltas e o de hoje). */
  elapsed: number;
  /** Dias seguidos com entrega, contando de trás para frente (o dia em aberto não quebra). */
  streak: number;
};

/** Situação de cada dia cobrado para um aluno. */
export function resolvePracticeDailyProgress(input: {
  schedule: PracticeDailySchedule;
  timeZone: string;
  /** Dias com pelo menos um envio. */
  deliveredDays: Iterable<LocalDate>;
  closedAt: string | null;
  now: Date;
}): PracticeDailyProgress {
  const today = localDateIn(input.now, input.timeZone);
  const closedOn = input.closedAt ? localDateIn(new Date(input.closedAt), input.timeZone) : null;
  const delivered = new Set(input.deliveredDays);
  const openDays = closedOn
    ? []
    : practiceDailyOpenDays({ schedule: input.schedule, timeZone: input.timeZone, now: input.now });
  const open = new Set(openDays);

  const days: PracticeDailyDay[] = listPracticeDailyChargedDays(input.schedule)
    .filter((date) => closedOn === null || date <= closedOn)
    .map((date) => {
      if (delivered.has(date)) {
        return { date, state: 'delivered' };
      }
      if (open.has(date)) {
        return { date, state: 'open' };
      }
      return { date, state: date < today || closedOn !== null ? 'missed' : 'upcoming' };
    });

  let streak = 0;
  for (let index = days.length - 1; index >= 0; index -= 1) {
    const state = days[index].state;
    if (state === 'upcoming' || state === 'open') {
      continue;
    }
    if (state !== 'delivered') {
      break;
    }
    streak += 1;
  }

  return {
    today,
    days,
    openDays,
    delivered: days.filter((day) => day.state === 'delivered').length,
    missed: days.filter((day) => day.state === 'missed').length,
    elapsed: days.filter((day) => day.state !== 'upcoming').length,
    streak,
  };
}
