import type { EventKind } from './event-type';
import type { ProgramItemStatus } from './program-item';

export type PieceEventHistoryItem = {
  eventId: string;
  title: string | null;
  startsAt: string;
  endsAt: string | null;
  cancelledAt: string | null;
  typeId: string;
  typeName: string;
  typeKind: EventKind;
  typeColor: string | null;
  programStatus: ProgramItemStatus;
};

export type PieceEventHistory = {
  events: PieceEventHistoryItem[];
  performancesThisYear: number;
  lastPerformanceAt: string | null;
};

export type PieceEventHistorySourceRow = {
  eventId: string;
  sortOrder: number;
  status: ProgramItemStatus;
  title: string | null;
  startsAt: string;
  endsAt: string | null;
  cancelledAt: string | null;
  typeId: string;
  typeName: string;
  typeKind: EventKind;
  typeColor: string | null;
};

export function countPiecePerformancesInLocalYear(
  rows: Array<{ status: ProgramItemStatus; startsAt: string }>,
  now: Date = new Date(),
): number {
  const year = now.getFullYear();
  let count = 0;
  for (const row of rows) {
    if (row.status !== 'performed') {
      continue;
    }
    if (new Date(row.startsAt).getFullYear() === year) {
      count += 1;
    }
  }
  return count;
}

export function findLastPiecePerformanceAt(
  rows: Array<{ status: ProgramItemStatus; startsAt: string }>,
): string | null {
  let latest: string | null = null;
  let latestTime = Number.NEGATIVE_INFINITY;

  for (const row of rows) {
    if (row.status !== 'performed') {
      continue;
    }
    const time = new Date(row.startsAt).getTime();
    if (time > latestTime) {
      latestTime = time;
      latest = row.startsAt;
    }
  }

  return latest;
}

function startOfLocalDayMs(value: string | Date): number {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Dias de calendário entre a data do evento e hoje (0 = mesmo dia). */
export function localCalendarDaysSince(iso: string, now: Date = new Date()): number {
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.round((startOfLocalDayMs(now) - startOfLocalDayMs(iso)) / dayMs);
}

export function mergePieceEventHistoryRows(
  rows: PieceEventHistorySourceRow[],
): PieceEventHistoryItem[] {
  const byEvent = new Map<string, PieceEventHistorySourceRow>();

  for (const row of rows) {
    const existing = byEvent.get(row.eventId);
    if (!existing || row.sortOrder < existing.sortOrder) {
      byEvent.set(row.eventId, row);
    }
  }

  return [...byEvent.values()]
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
    .map((row) => ({
      eventId: row.eventId,
      title: row.title,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      cancelledAt: row.cancelledAt,
      typeId: row.typeId,
      typeName: row.typeName,
      typeKind: row.typeKind,
      typeColor: row.typeColor,
      programStatus: row.status,
    }));
}
