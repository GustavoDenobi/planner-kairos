import type { EventListItem } from '@/domain/agenda';

/**
 * Próximo evento (não cancelado) que envolve o público escolhido: serve de prazo
 * padrão, porque "até a próxima aula" é o pedido mais comum.
 */
export function findNextEventForAudience(
  events: readonly EventListItem[],
  audience: { groupIds: readonly string[]; musicianIds: readonly string[] },
  now: Date,
): EventListItem | null {
  if (audience.groupIds.length === 0 && audience.musicianIds.length === 0) {
    return null;
  }
  const groups = new Set(audience.groupIds);
  const musicians = new Set(audience.musicianIds);
  const nowMs = now.getTime();

  let best: EventListItem | null = null;
  for (const event of events) {
    if (event.cancelledAt || Date.parse(event.startsAt) <= nowMs) {
      continue;
    }
    const matches =
      event.groups.some((group) => groups.has(group.id)) ||
      event.musicians.some((musician) => musicians.has(musician.id));
    if (matches && (!best || event.startsAt < best.startsAt)) {
      best = event;
    }
  }
  return best;
}

export function eventShortLabel(event: Pick<EventListItem, 'title' | 'typeName'>): string {
  return event.title?.trim() || event.typeName;
}
