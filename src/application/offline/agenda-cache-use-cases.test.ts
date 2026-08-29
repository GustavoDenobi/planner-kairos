import { describe, expect, it } from 'vitest';
import type { OfflineAgendaCache } from '@/application/ports/offline-agenda-cache';
import type { AssociableAudience } from '@/application/agenda/list-associable-audience';
import type { EventDetail, EventListItem, EventType } from '@/domain/agenda';
import {
  getOfflineAgendaCacheRange,
  OFFLINE_AGENDA_FORWARD_DAYS,
} from '@/application/offline/agenda-cache-types';
import {
  getCachedEventDetail,
  isRangeWithinCachedAgenda,
  listCachedEventsInRange,
} from '@/application/offline/agenda-cache-use-cases';

function createAgendaCache(initial: ReturnType<typeof buildSnapshot> | null = null): OfflineAgendaCache {
  let snapshot = initial;

  return {
    get: async (organizationId, userId) => {
      if (!snapshot || snapshot.organizationId !== organizationId || snapshot.userId !== userId) {
        return null;
      }
      return snapshot;
    },
    put: async (value) => {
      snapshot = value;
    },
    remove: async () => {
      snapshot = null;
    },
    clearAll: async () => {
      snapshot = null;
    },
  };
}

function buildSnapshot(params: {
  organizationId?: string;
  userId?: string;
  rangeFrom: string;
  rangeTo: string;
  events: EventListItem[];
  eventDetails?: Record<string, EventDetail>;
  audience?: AssociableAudience;
}) {
  const audience: AssociableAudience = params.audience ?? {
    groups: [],
    filterGroups: [],
    musicians: [],
    myMusicianId: 'musician-1',
    writableGroupIds: [],
    canCreateEvents: false,
    isPrivileged: false,
    isGroupWriter: false,
    memberGroupIds: ['group-1'],
  };

  return {
    organizationId: params.organizationId ?? 'org-1',
    userId: params.userId ?? 'user-1',
    cachedAt: '2026-08-20T12:00:00.000Z',
    rangeFrom: params.rangeFrom,
    rangeTo: params.rangeTo,
    eventsJson: JSON.stringify(params.events),
    eventDetailsJson: JSON.stringify(params.eventDetails ?? {}),
    eventTypesJson: JSON.stringify([] as EventType[]),
    audienceJson: JSON.stringify(audience),
  };
}

function sampleEvent(overrides: Partial<EventListItem> = {}): EventListItem {
  return {
    id: 'event-1',
    typeId: 'type-1',
    typeName: 'Ensaio',
    typeKind: 'rehearsal',
    typeColor: null,
    title: 'Ensaio geral',
    startsAt: '2026-08-25T19:00:00.000Z',
    endsAt: null,
    location: null,
    programCount: 0,
    createdBy: 'user-2',
    recurrenceId: null,
    isException: false,
    groups: [{ id: 'group-1', name: 'Cordas', kind: 'ensemble' }],
    musicians: [{ id: 'musician-1', fullName: 'João', userId: 'user-1' }],
    ...overrides,
  };
}

describe('getOfflineAgendaCacheRange', () => {
  it('covers current week start through 90 days forward', () => {
    const now = new Date('2026-08-20T15:30:00.000Z');
    const { from, to } = getOfflineAgendaCacheRange(now);

    expect(from.getDay()).toBe(0);
    expect(from.getHours()).toBe(0);
    expect(to.getTime() - from.getTime()).toBeGreaterThan(OFFLINE_AGENDA_FORWARD_DAYS * 24 * 60 * 60 * 1000 - 86400000);
  });
});

describe('isRangeWithinCachedAgenda', () => {
  it('returns true when requested week is inside cached interval', () => {
    expect(
      isRangeWithinCachedAgenda(
        '2026-08-17T00:00:00.000Z',
        '2026-11-18T00:00:00.000Z',
        '2026-08-24T00:00:00.000Z',
        '2026-08-31T00:00:00.000Z',
      ),
    ).toBe(true);
  });

  it('returns false when requested week exceeds cached interval', () => {
    expect(
      isRangeWithinCachedAgenda(
        '2026-08-17T00:00:00.000Z',
        '2026-11-18T00:00:00.000Z',
        '2026-12-01T00:00:00.000Z',
        '2026-12-08T00:00:00.000Z',
      ),
    ).toBe(false);
  });
});

describe('listCachedEventsInRange', () => {
  const rangeFrom = '2026-08-17T00:00:00.000Z';
  const rangeTo = '2026-11-18T00:00:00.000Z';

  it('filters events by date range and kind', async () => {
    const cache = createAgendaCache(
      buildSnapshot({
        rangeFrom,
        rangeTo,
        events: [
          sampleEvent(),
          sampleEvent({
            id: 'event-2',
            typeKind: 'service',
            startsAt: '2026-08-26T10:00:00.000Z',
          }),
        ],
      }),
    );

    const result = await listCachedEventsInRange(cache, 'org-1', 'user-1', {
      from: '2026-08-24T00:00:00.000Z',
      to: '2026-08-31T00:00:00.000Z',
      kind: 'rehearsal',
    });

    expect(result.withinCachedRange).toBe(true);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.id).toBe('event-1');
  });

  it('applies mineOnly filter using cached audience context', async () => {
    const cache = createAgendaCache(
      buildSnapshot({
        rangeFrom,
        rangeTo,
        events: [
          sampleEvent(),
          sampleEvent({
            id: 'event-3',
            createdBy: 'user-9',
            musicians: [],
            groups: [],
            startsAt: '2026-08-27T10:00:00.000Z',
          }),
        ],
      }),
    );

    const result = await listCachedEventsInRange(cache, 'org-1', 'user-1', {
      from: '2026-08-24T00:00:00.000Z',
      to: '2026-08-31T00:00:00.000Z',
      mineOnly: true,
    });

    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.id).toBe('event-1');
  });

  it('returns empty list and withinCachedRange false when week is outside cache', async () => {
    const cache = createAgendaCache(
      buildSnapshot({
        rangeFrom,
        rangeTo,
        events: [sampleEvent()],
      }),
    );

    const result = await listCachedEventsInRange(cache, 'org-1', 'user-1', {
      from: '2026-12-01T00:00:00.000Z',
      to: '2026-12-08T00:00:00.000Z',
    });

    expect(result.withinCachedRange).toBe(false);
    expect(result.events).toEqual([]);
  });
});

describe('getCachedEventDetail', () => {
  it('returns cached event detail by id', async () => {
    const detail: EventDetail = {
      id: 'event-1',
      organizationId: 'org-1',
      typeId: 'type-1',
      title: 'Ensaio geral',
      startsAt: '2026-08-25T19:00:00.000Z',
      endsAt: null,
      location: null,
      notes: 'Trazer partituras',
      createdBy: 'user-2',
      recurrenceId: null,
      occurrenceIndex: null,
      originalStartsAt: null,
      isException: false,
      type: {
        id: 'type-1',
        organizationId: 'org-1',
        name: 'Ensaio',
        kind: 'rehearsal',
        color: null,
        sortOrder: 0,
      },
      program: [],
      groups: [],
      musicians: [],
    };

    const cache = createAgendaCache(
      buildSnapshot({
        rangeFrom: '2026-08-17T00:00:00.000Z',
        rangeTo: '2026-11-18T00:00:00.000Z',
        events: [sampleEvent()],
        eventDetails: { 'event-1': detail },
      }),
    );

    const result = await getCachedEventDetail(cache, 'org-1', 'user-1', 'event-1');
    expect(result).toEqual(detail);
  });
});
