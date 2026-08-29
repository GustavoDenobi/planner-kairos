export const RECURRENCE_MAX_DAYS = 730;

export function startOfDayUtc(iso: string): Date {
  const date = new Date(iso);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function endOfDayUtc(iso: string): Date {
  const start = startOfDayUtc(iso);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

export function addDaysUtc(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function addMonthsUtc(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = daysInMonthUtc(result.getUTCFullYear(), result.getUTCMonth());
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

export function daysInMonthUtc(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

export function getUtcWeekday(date: Date): number {
  return date.getUTCDay();
}

export function setUtcTimeFrom(source: Date, targetDay: Date): Date {
  return new Date(
    Date.UTC(
      targetDay.getUTCFullYear(),
      targetDay.getUTCMonth(),
      targetDay.getUTCDate(),
      source.getUTCHours(),
      source.getUTCMinutes(),
      source.getUTCSeconds(),
      source.getUTCMilliseconds(),
    ),
  );
}

export function toDateInputValueUtc(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function parseDateInputEndOfDayUtc(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
}

export function parseDateInputStartOfDayUtc(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

export function durationMinutesBetween(startsAt: string, endsAt: string | null | undefined): number | null {
  if (!endsAt) {
    return null;
  }
  const diff = new Date(endsAt).getTime() - new Date(startsAt).getTime();
  if (diff < 0) {
    return null;
  }
  return Math.round(diff / 60_000);
}

export function addDurationMinutes(startsAt: string, durationMinutes: number | null): string | null {
  if (durationMinutes == null) {
    return null;
  }
  return new Date(new Date(startsAt).getTime() + durationMinutes * 60_000).toISOString();
}
