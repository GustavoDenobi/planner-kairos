import {
  RECURRENCE_MAX_DAYS,
  addDaysUtc,
  addDurationMinutes,
  addMonthsUtc,
  daysInMonthUtc,
  endOfDayUtc,
  getUtcWeekday,
  parseDateInputEndOfDayUtc,
  setUtcTimeFrom,
  startOfDayUtc,
  toDateInputValueUtc,
} from './date-utils';
import type { MonthlyRule, RecurrenceRule, WeeklyRule } from './recurrence-rule';
import { isMonthlyRule, isWeeklyRule } from './recurrence-rule';

export { RECURRENCE_MAX_DAYS };

export type GeneratedOccurrence = {
  startsAt: string;
  endsAt: string | null;
  occurrenceIndex: number;
  originalStartsAt: string;
};

export function maxRecurrenceEndDate(limitAnchorAt: string): Date {
  const anchor = startOfDayUtc(limitAnchorAt);
  return endOfDayUtc(addDaysUtc(anchor, RECURRENCE_MAX_DAYS).toISOString());
}

export function maxRecurrenceEndDateInputValue(limitAnchorAt: string = new Date().toISOString()): string {
  return toDateInputValueUtc(maxRecurrenceEndDate(limitAnchorAt));
}

export function validateRecurrenceEndDate(input: {
  seriesStartsAt: string;
  seriesEndsAt: string;
  limitAnchorAt: string;
}): string | null {
  if (!input.seriesEndsAt.trim()) {
    return 'end_date_required';
  }
  const starts = new Date(input.seriesStartsAt);
  const ends = parseDateInputEndOfDayUtc(input.seriesEndsAt.split('T')[0] ?? input.seriesEndsAt);
  if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) {
    return 'invalid_dates';
  }
  if (ends.getTime() < starts.getTime()) {
    return 'invalid_dates';
  }
  const maxEnd = maxRecurrenceEndDate(input.limitAnchorAt);
  if (ends.getTime() > maxEnd.getTime()) {
    return 'end_date_beyond_limit';
  }
  return null;
}

export function validateRecurrenceRule(rule: RecurrenceRule): string | null {
  if (isWeeklyRule(rule)) {
    if (!Number.isInteger(rule.interval) || rule.interval < 1) {
      return 'invalid_recurrence_interval';
    }
    if (rule.byWeekday.length === 0) {
      return 'invalid_recurrence_weekday';
    }
    for (const weekday of rule.byWeekday) {
      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
        return 'invalid_recurrence_weekday';
      }
    }
    return null;
  }

  if (!Number.isInteger(rule.interval) || rule.interval < 1) {
    return 'invalid_recurrence_interval';
  }

  if (rule.mode === 'dayOfMonth') {
    if (!Number.isInteger(rule.day) || rule.day < 1 || rule.day > 31) {
      return 'invalid_recurrence_month_day';
    }
    return null;
  }

  if (!Number.isInteger(rule.weekday) || rule.weekday < 0 || rule.weekday > 6) {
    return 'invalid_recurrence_weekday';
  }
  if (!Number.isInteger(rule.nth) || rule.nth < 1 || rule.nth > 5) {
    return 'invalid_recurrence_nth';
  }
  return null;
}

function compareDates(a: Date, b: Date): number {
  return a.getTime() - b.getTime();
}

function sortWeekdays(weekdays: number[]): number[] {
  return [...new Set(weekdays)].sort((left, right) => left - right);
}

function generateWeeklyOccurrences(
  rule: WeeklyRule,
  seriesStartsAt: string,
  seriesEndsAt: Date,
  durationMinutes: number | null,
): GeneratedOccurrence[] {
  const anchor = new Date(seriesStartsAt);
  const anchorDay = startOfDayUtc(seriesStartsAt);
  const weekdays = sortWeekdays(rule.byWeekday);
  const results: GeneratedOccurrence[] = [];
  let occurrenceIndex = 0;
  let weekStart = anchorDay;

  while (weekStart.getTime() <= seriesEndsAt.getTime()) {
    for (const weekday of weekdays) {
      const dayOffset = (weekday - getUtcWeekday(weekStart) + 7) % 7;
      const candidate = setUtcTimeFrom(anchor, addDaysUtc(weekStart, dayOffset));
      if (candidate.getTime() < anchor.getTime()) {
        continue;
      }
      if (candidate.getTime() > seriesEndsAt.getTime()) {
        continue;
      }
      const startsAt = candidate.toISOString();
      results.push({
        startsAt,
        endsAt: addDurationMinutes(startsAt, durationMinutes),
        occurrenceIndex,
        originalStartsAt: startsAt,
      });
      occurrenceIndex += 1;
    }
    weekStart = addDaysUtc(weekStart, 7 * rule.interval);
  }

  return results.sort((left, right) => compareDates(new Date(left.startsAt), new Date(right.startsAt)))
    .map((item, index) => ({ ...item, occurrenceIndex: index }));
}

function resolveMonthlyDayOfMonth(year: number, month: number, day: number): Date {
  const lastDay = daysInMonthUtc(year, month);
  return new Date(Date.UTC(year, month, Math.min(day, lastDay)));
}

function resolveMonthlyNthWeekday(
  year: number,
  month: number,
  weekday: number,
  nth: number,
): Date | null {
  const first = new Date(Date.UTC(year, month, 1));
  const firstWeekdayOffset = (weekday - getUtcWeekday(first) + 7) % 7;
  const day = 1 + firstWeekdayOffset + (nth - 1) * 7;
  const candidate = new Date(Date.UTC(year, month, day));
  if (candidate.getUTCMonth() !== month) {
    return null;
  }
  return candidate;
}

function generateMonthlyOccurrences(
  rule: MonthlyRule,
  seriesStartsAt: string,
  seriesEndsAt: Date,
  durationMinutes: number | null,
): GeneratedOccurrence[] {
  const anchor = new Date(seriesStartsAt);
  const results: GeneratedOccurrence[] = [];
  let cursor = startOfDayUtc(seriesStartsAt);
  cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1));
  let occurrenceIndex = 0;
  let monthOffset = 0;

  while (true) {
    const monthDate = addMonthsUtc(cursor, monthOffset);
    const year = monthDate.getUTCFullYear();
    const month = monthDate.getUTCMonth();

    let dayDate: Date | null;
    if (rule.mode === 'dayOfMonth') {
      dayDate = resolveMonthlyDayOfMonth(year, month, rule.day);
    } else {
      dayDate = resolveMonthlyNthWeekday(year, month, rule.weekday, rule.nth);
    }

    monthOffset += rule.interval;

    if (!dayDate) {
      if (monthDate.getTime() > seriesEndsAt.getTime()) {
        break;
      }
      continue;
    }

    const candidate = setUtcTimeFrom(anchor, dayDate);
    if (candidate.getTime() < anchor.getTime()) {
      continue;
    }
    if (candidate.getTime() > seriesEndsAt.getTime()) {
      break;
    }

    const startsAt = candidate.toISOString();
    results.push({
      startsAt,
      endsAt: addDurationMinutes(startsAt, durationMinutes),
      occurrenceIndex,
      originalStartsAt: startsAt,
    });
    occurrenceIndex += 1;
  }

  return results;
}

export function generateOccurrenceDates(input: {
  rule: RecurrenceRule;
  seriesStartsAt: string;
  seriesEndsAt: string;
  durationMinutes: number | null;
}): GeneratedOccurrence[] {
  const endInstant = parseDateInputEndOfDayUtc(input.seriesEndsAt.split('T')[0] ?? input.seriesEndsAt);
  if (isWeeklyRule(input.rule)) {
    return generateWeeklyOccurrences(
      input.rule,
      input.seriesStartsAt,
      endInstant,
      input.durationMinutes,
    );
  }
  if (isMonthlyRule(input.rule)) {
    return generateMonthlyOccurrences(
      input.rule,
      input.seriesStartsAt,
      endInstant,
      input.durationMinutes,
    );
  }
  return [];
}

export function formatRecurrencePreview(rule: RecurrenceRule, seriesEndsAt: string): string {
  const weekdayNames = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const endLabel = new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parseDateInputEndOfDayUtc(seriesEndsAt.split('T')[0] ?? seriesEndsAt));

  if (isWeeklyRule(rule)) {
    const days = sortWeekdays(rule.byWeekday)
      .map((day) => weekdayNames[day])
      .join(', ');
    const intervalLabel =
      rule.interval === 1 ? 'Toda semana' : `A cada ${rule.interval} semanas`;
    return `${intervalLabel}, ${days}, até ${endLabel}`;
  }

  if (rule.mode === 'dayOfMonth') {
    const intervalLabel =
      rule.interval === 1 ? 'Todo mês' : `A cada ${rule.interval} meses`;
    return `${intervalLabel}, dia ${rule.day}, até ${endLabel}`;
  }

  const nthLabels = ['', '1ª', '2ª', '3ª', '4ª', '5ª'];
  const intervalLabel =
    rule.interval === 1 ? 'Todo mês' : `A cada ${rule.interval} meses`;
  return `${intervalLabel}, ${nthLabels[rule.nth]} ${weekdayNames[rule.weekday]}, até ${endLabel}`;
}
