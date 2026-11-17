import type { EventKind } from './event-type';

export type MusicianEventHistoryItem = {
  eventId: string;
  title: string | null;
  startsAt: string;
  endsAt: string | null;
  cancelledAt: string | null;
  typeId: string;
  typeName: string;
  typeKind: EventKind;
  typeColor: string | null;
  wasAbsent: boolean;
};

export type MusicianEventHistory = {
  events: MusicianEventHistoryItem[];
  eventsThisYear: number;
  absencesThisYear: number;
};

export type MusicianEventHistorySourceRow = {
  eventId: string;
  title: string | null;
  startsAt: string;
  endsAt: string | null;
  cancelledAt: string | null;
  typeId: string;
  typeName: string;
  typeKind: EventKind;
  typeColor: string | null;
  wasAbsent: boolean;
};

export type MusicianHistoryPeriod = 'year' | '6m' | '3m' | '30d' | 'all';

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function addLocalMonths(date: Date, months: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), 1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(date.getDate(), lastDay));
  return result;
}

function historyPeriodStart(period: Exclude<MusicianHistoryPeriod, 'year' | 'all'>, now: Date): Date {
  if (period === '30d') {
    const start = startOfLocalDay(now);
    start.setDate(start.getDate() - 30);
    return start;
  }

  const months = period === '6m' ? -6 : -3;
  return startOfLocalDay(addLocalMonths(now, months));
}

/** Este ano é o ano civil local. Os demais períodos vão do início do dia-limite até o fim de hoje. */
export function musicianEventStartsInPeriod(
  startsAt: string,
  period: MusicianHistoryPeriod,
  now: Date = new Date(),
): boolean {
  if (period === 'all') {
    return true;
  }

  const starts = new Date(startsAt);
  if (Number.isNaN(starts.getTime())) {
    return false;
  }

  if (period === 'year') {
    return starts.getFullYear() === now.getFullYear();
  }

  const time = starts.getTime();
  return time >= historyPeriodStart(period, now).getTime() && time <= endOfLocalDay(now).getTime();
}

export function countMusicianEventsInLocalYear(
  rows: Array<{ startsAt: string }>,
  now: Date = new Date(),
): number {
  const year = now.getFullYear();
  let count = 0;
  for (const row of rows) {
    if (new Date(row.startsAt).getFullYear() === year) {
      count += 1;
    }
  }
  return count;
}

export function countMusicianAbsencesInLocalYear(
  rows: Array<{ startsAt: string; wasAbsent: boolean }>,
  now: Date = new Date(),
): number {
  const year = now.getFullYear();
  let count = 0;
  for (const row of rows) {
    if (!row.wasAbsent) {
      continue;
    }
    if (new Date(row.startsAt).getFullYear() === year) {
      count += 1;
    }
  }
  return count;
}

export function buildMusicianEventHistory(
  rows: MusicianEventHistorySourceRow[],
): MusicianEventHistory {
  const events = [...rows].sort(
    (a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
  );

  return {
    events,
    eventsThisYear: countMusicianEventsInLocalYear(events),
    absencesThisYear: countMusicianAbsencesInLocalYear(events),
  };
}
