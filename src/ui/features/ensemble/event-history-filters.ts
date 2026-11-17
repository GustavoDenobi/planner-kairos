import type { EventKind, MusicianHistoryPeriod } from '@/domain/agenda';

export const HISTORY_PERIODS: MusicianHistoryPeriod[] = ['year', '6m', '3m', '30d', 'all'];

export function historyPeriodOptionLabel(period: MusicianHistoryPeriod, year: number): string {
  switch (period) {
    case 'year':
      return `Este ano (${year})`;
    case '6m':
      return '6 meses';
    case '3m':
      return '3 meses';
    case '30d':
      return '30 dias';
    case 'all':
      return 'Tudo';
  }
}

export function historyPeriodStatLabels(period: MusicianHistoryPeriod): {
  events: string;
  absences: string;
} {
  switch (period) {
    case 'year':
      return { events: 'Eventos neste ano', absences: 'Faltas neste ano' };
    case '6m':
      return { events: 'Eventos nos últimos 6 meses', absences: 'Faltas nos últimos 6 meses' };
    case '3m':
      return { events: 'Eventos nos últimos 3 meses', absences: 'Faltas nos últimos 3 meses' };
    case '30d':
      return { events: 'Eventos nos últimos 30 dias', absences: 'Faltas nos últimos 30 dias' };
    case 'all':
      return { events: 'Total de eventos', absences: 'Total de faltas' };
  }
}

export function absenceRateLabel(absences: number, events: number): string | null {
  if (events === 0) {
    return null;
  }
  return `${((absences / events) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

export type HistoryTypeOption = {
  id: string;
  name: string;
  kind: EventKind;
  color: string | null;
};

type HistoryEventTypeSource = {
  typeId: string;
  typeName: string;
  typeKind: EventKind;
  typeColor: string | null;
};

export function historyTypeOptions(events: Iterable<HistoryEventTypeSource>): HistoryTypeOption[] {
  const byId = new Map<string, HistoryTypeOption>();
  for (const event of events) {
    if (!byId.has(event.typeId)) {
      byId.set(event.typeId, {
        id: event.typeId,
        name: event.typeName,
        kind: event.typeKind,
        color: event.typeColor,
      });
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

/** IDs selecionados que ainda existem nas opções; vazio = todos os tipos. */
export function activeHistoryTypeIds(
  selectedTypeIds: string[],
  typeOptions: HistoryTypeOption[],
): string[] {
  const available = new Set(typeOptions.map((type) => type.id));
  return selectedTypeIds.filter((id) => available.has(id));
}

export type GroupHistoryMemberSort = 'most_absences' | 'most_events' | 'name_az';

export const DEFAULT_GROUP_HISTORY_MEMBER_SORT: GroupHistoryMemberSort = 'most_absences';

export const GROUP_HISTORY_MEMBER_SORT_OPTIONS: {
  value: GroupHistoryMemberSort;
  label: string;
}[] = [
  { value: 'most_absences', label: 'Mais faltas' },
  { value: 'most_events', label: 'Mais eventos' },
  { value: 'name_az', label: 'Nome A–Z' },
];

type GroupHistoryMemberRow = {
  musicianId: string;
  musicianName: string;
};

export function sortGroupHistoryMembers<T extends GroupHistoryMemberRow>(
  members: T[],
  summaries: Map<string, { events: number; absences: number }>,
  sort: GroupHistoryMemberSort = DEFAULT_GROUP_HISTORY_MEMBER_SORT,
): T[] {
  const copy = [...members];
  copy.sort((a, b) => {
    const summaryA = summaries.get(a.musicianId) ?? { events: 0, absences: 0 };
    const summaryB = summaries.get(b.musicianId) ?? { events: 0, absences: 0 };
    switch (sort) {
      case 'most_events': {
        const byEvents = summaryB.events - summaryA.events;
        return byEvents !== 0 ? byEvents : a.musicianName.localeCompare(b.musicianName, 'pt-BR');
      }
      case 'name_az':
        return a.musicianName.localeCompare(b.musicianName, 'pt-BR');
      case 'most_absences':
      default: {
        const byAbsences = summaryB.absences - summaryA.absences;
        return byAbsences !== 0 ? byAbsences : a.musicianName.localeCompare(b.musicianName, 'pt-BR');
      }
    }
  });
  return copy;
}
