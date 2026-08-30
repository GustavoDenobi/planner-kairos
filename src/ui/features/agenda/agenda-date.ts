import type { EventListItem, MusicianBirthdayItem } from '@/domain/agenda';

export type AgendaRangeMode = 'week' | 'month';

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function getWeekRange(anchor: Date): { from: Date; to: Date } {
  const day = anchor.getDay();
  const from = addDays(startOfDay(anchor), -day);
  const to = addDays(from, 7);
  return { from, to };
}

export function getMonthRange(anchor: Date): { from: Date; to: Date } {
  const from = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const to = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
  return { from, to };
}

export function getRangeForMode(
  mode: AgendaRangeMode,
  anchor: Date,
): { from: Date; to: Date } {
  return mode === 'week' ? getWeekRange(anchor) : getMonthRange(anchor);
}

export function toIsoRange(from: Date, to: Date): { from: string; to: string } {
  return { from: from.toISOString(), to: to.toISOString() };
}

export function formatDayHeader(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

export function formatEventDateShort(startsAt: string): string {
  const date = new Date(startsAt);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
}

export function formatEventTime(startsAt: string, endsAt: string | null): string {
  const start = new Date(startsAt);
  const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (!endsAt) {
    return timeFmt.format(start);
  }
  const end = new Date(endsAt);
  return `${timeFmt.format(start)} – ${timeFmt.format(end)}`;
}

export function formatRangeLabel(mode: AgendaRangeMode, anchor: Date): string {
  if (mode === 'week') {
    const { from, to } = getWeekRange(anchor);
    const endDay = addDays(to, -1);
    const fmt = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' });
    return `${fmt.format(from)} – ${fmt.format(endDay)}`;
  }
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(anchor);
}

export function toDatetimeLocalValue(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromDatetimeLocalValue(value: string): string {
  return new Date(value).toISOString();
}

export function toDateInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function groupEventsByDay<T extends { startsAt: string }>(
  events: T[],
): { date: Date; events: T[] }[] {
  const groups = new Map<string, T[]>();

  for (const event of events) {
    const day = startOfDay(new Date(event.startsAt));
    const key = day.toISOString();
    const list = groups.get(key) ?? [];
    list.push(event);
    groups.set(key, list);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, dayEvents]) => ({
      date: new Date(key),
      events: dayEvents.sort(
        (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      ),
    }));
}

export function shiftAnchor(mode: AgendaRangeMode, anchor: Date, delta: number): Date {
  if (mode === 'week') {
    return addDays(anchor, delta * 7);
  }
  return new Date(anchor.getFullYear(), anchor.getMonth() + delta, 1);
}

export type AgendaDayGroup = {
  date: Date;
  birthdays: MusicianBirthdayItem[];
  events: EventListItem[];
};

export function groupAgendaItemsByDay(
  events: EventListItem[],
  birthdays: MusicianBirthdayItem[] = [],
): AgendaDayGroup[] {
  const dayMap = new Map<string, AgendaDayGroup>();

  for (const event of events) {
    const day = startOfDay(new Date(event.startsAt));
    const key = day.toISOString();
    const group = dayMap.get(key) ?? { date: day, birthdays: [], events: [] };
    group.events.push(event);
    dayMap.set(key, group);
  }

  for (const birthday of birthdays) {
    const day = startOfDay(new Date(birthday.date));
    const key = day.toISOString();
    const group = dayMap.get(key) ?? { date: day, birthdays: [], events: [] };
    group.birthdays.push(birthday);
    dayMap.set(key, group);
  }

  return [...dayMap.values()]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((group) => ({
      ...group,
      birthdays: group.birthdays.sort((a, b) => a.fullName.localeCompare(b.fullName, 'pt-BR')),
      events: group.events.sort(
        (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      ),
    }));
}
