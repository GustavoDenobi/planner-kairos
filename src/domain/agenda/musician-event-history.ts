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
