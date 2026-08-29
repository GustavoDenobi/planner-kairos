import type { AssociableAudience } from '@/application/agenda/list-associable-audience';
import type { EventTypeRepository } from '@/application/ports/event-type-repository';
import type { EventRepository } from '@/application/ports/event-repository';
import type { OfflineAgendaCache } from '@/application/ports/offline-agenda-cache';
import type { AssignmentRepository } from '@/application/ports/assignment-repository';
import type { GroupRepository } from '@/application/ports/group-repository';
import type { MembershipRepository } from '@/application/ports/membership-repository';
import type { MusicianRepository } from '@/application/ports/musician-repository';
import type { OrganizationRepository } from '@/application/ports/organization-repository';
import type { EventDetail, EventKind, EventListItem, EventType } from '@/domain/agenda';
import { Result } from '@/domain/shared';
import { listAssociableAudience } from '@/application/agenda/list-associable-audience';
import { getEvent, listEventsInRange } from '@/application/agenda/event-use-cases';
import { listEventTypes } from '@/application/agenda/event-type-use-cases';
import { getOfflineAgendaCacheRange } from './agenda-cache-types';
import { isBrowserOnline } from './file-cache-use-cases';

export type CachedEventsInRangeOptions = {
  from: string;
  to: string;
  mineOnly?: boolean;
  typeId?: string | null;
  kind?: EventKind | null;
  groupId?: string | null;
};

export type CachedEventsInRangeResult = {
  events: EventListItem[];
  withinCachedRange: boolean;
  cachedAt: string | null;
};

type ParsedSnapshot = {
  events: EventListItem[];
  eventDetails: Record<string, EventDetail>;
  eventTypes: EventType[];
  audience: AssociableAudience;
  rangeFrom: string;
  rangeTo: string;
  cachedAt: string;
};

function parseSnapshot(snapshot: {
  eventsJson: string;
  eventDetailsJson: string;
  eventTypesJson: string;
  audienceJson: string;
  rangeFrom: string;
  rangeTo: string;
  cachedAt: string;
}): ParsedSnapshot {
  return {
    events: JSON.parse(snapshot.eventsJson) as EventListItem[],
    eventDetails: JSON.parse(snapshot.eventDetailsJson) as Record<string, EventDetail>,
    eventTypes: JSON.parse(snapshot.eventTypesJson) as EventType[],
    audience: JSON.parse(snapshot.audienceJson) as AssociableAudience,
    rangeFrom: snapshot.rangeFrom,
    rangeTo: snapshot.rangeTo,
    cachedAt: snapshot.cachedAt,
  };
}

function matchesMineFilter(
  item: EventListItem,
  options: CachedEventsInRangeOptions,
  userId: string,
  audience: AssociableAudience,
): boolean {
  if (!options.mineOnly) {
    return true;
  }
  if (item.createdBy === userId) {
    return true;
  }
  if (
    audience.myMusicianId &&
    item.musicians.some((musician) => musician.id === audience.myMusicianId)
  ) {
    return true;
  }
  return item.groups.some((group) => audience.memberGroupIds.includes(group.id));
}

function filterEvents(
  events: EventListItem[],
  options: CachedEventsInRangeOptions,
  userId: string,
  audience: AssociableAudience,
): EventListItem[] {
  const fromMs = new Date(options.from).getTime();
  const toMs = new Date(options.to).getTime();

  return events.filter((item) => {
    const startsAtMs = new Date(item.startsAt).getTime();
    if (startsAtMs < fromMs || startsAtMs >= toMs) {
      return false;
    }
    if (options.typeId && item.typeId !== options.typeId) {
      return false;
    }
    if (options.kind && item.typeKind !== options.kind) {
      return false;
    }
    if (options.groupId && !item.groups.some((group) => group.id === options.groupId)) {
      return false;
    }
    return matchesMineFilter(item, options, userId, audience);
  });
}

export function isRangeWithinCachedAgenda(
  rangeFrom: string,
  rangeTo: string,
  requestFrom: string,
  requestTo: string,
): boolean {
  const cacheFromMs = new Date(rangeFrom).getTime();
  const cacheToMs = new Date(rangeTo).getTime();
  const requestFromMs = new Date(requestFrom).getTime();
  const requestToMs = new Date(requestTo).getTime();
  return requestFromMs >= cacheFromMs && requestToMs <= cacheToMs;
}

export async function cacheAgendaForOffline(
  eventRepo: EventRepository,
  eventTypeRepo: EventTypeRepository,
  membershipRepo: MembershipRepository,
  musicianRepo: MusicianRepository,
  assignmentRepo: AssignmentRepository,
  groupRepo: GroupRepository,
  orgRepo: OrganizationRepository,
  agendaCache: OfflineAgendaCache,
  organizationId: string,
  userId: string,
): Promise<Result<void, string>> {
  if (!isBrowserOnline()) {
    return Result.fail('offline');
  }

  const { from, to } = getOfflineAgendaCacheRange();
  const range = { from: from.toISOString(), to: to.toISOString() };

  const [typesResult, audienceResult, eventsResult] = await Promise.all([
    listEventTypes(eventTypeRepo, organizationId),
    listAssociableAudience(
      membershipRepo,
      musicianRepo,
      assignmentRepo,
      groupRepo,
      orgRepo,
      organizationId,
      userId,
    ),
    listEventsInRange(
      eventRepo,
      membershipRepo,
      musicianRepo,
      assignmentRepo,
      orgRepo,
      organizationId,
      userId,
      range,
    ),
  ]);

  if (!typesResult.ok) {
    return Result.fail('event_types_failed');
  }
  if (!audienceResult.ok) {
    return Result.fail('audience_failed');
  }
  if (!eventsResult.ok) {
    return Result.fail('events_failed');
  }

  const eventDetails: Record<string, EventDetail> = {};
  for (const item of eventsResult.value) {
    const detailResult = await getEvent(eventRepo, organizationId, item.id);
    if (detailResult.ok) {
      eventDetails[item.id] = detailResult.value;
    }
  }

  await agendaCache.put({
    organizationId,
    userId,
    cachedAt: new Date().toISOString(),
    rangeFrom: range.from,
    rangeTo: range.to,
    eventsJson: JSON.stringify(eventsResult.value),
    eventDetailsJson: JSON.stringify(eventDetails),
    eventTypesJson: JSON.stringify(typesResult.value),
    audienceJson: JSON.stringify(audienceResult.value),
  });

  return Result.ok(undefined);
}

export async function listCachedEventsInRange(
  agendaCache: OfflineAgendaCache,
  organizationId: string,
  userId: string,
  options: CachedEventsInRangeOptions,
): Promise<CachedEventsInRangeResult> {
  const snapshot = await agendaCache.get(organizationId, userId);
  if (!snapshot) {
    return { events: [], withinCachedRange: false, cachedAt: null };
  }

  const parsed = parseSnapshot(snapshot);
  const withinCachedRange = isRangeWithinCachedAgenda(
    parsed.rangeFrom,
    parsed.rangeTo,
    options.from,
    options.to,
  );

  if (!withinCachedRange) {
    return { events: [], withinCachedRange: false, cachedAt: parsed.cachedAt };
  }

  return {
    events: filterEvents(parsed.events, options, userId, parsed.audience),
    withinCachedRange: true,
    cachedAt: parsed.cachedAt,
  };
}

export async function getCachedEventDetail(
  agendaCache: OfflineAgendaCache,
  organizationId: string,
  userId: string,
  eventId: string,
): Promise<EventDetail | null> {
  const snapshot = await agendaCache.get(organizationId, userId);
  if (!snapshot) {
    return null;
  }
  const parsed = parseSnapshot(snapshot);
  return parsed.eventDetails[eventId] ?? null;
}

export async function getCachedEventTypes(
  agendaCache: OfflineAgendaCache,
  organizationId: string,
  userId: string,
): Promise<EventType[]> {
  const snapshot = await agendaCache.get(organizationId, userId);
  if (!snapshot) {
    return [];
  }
  return parseSnapshot(snapshot).eventTypes;
}

export async function getCachedAssociableAudience(
  agendaCache: OfflineAgendaCache,
  organizationId: string,
  userId: string,
): Promise<AssociableAudience | null> {
  const snapshot = await agendaCache.get(organizationId, userId);
  if (!snapshot) {
    return null;
  }
  return parseSnapshot(snapshot).audience;
}

export async function getCachedAgendaMeta(
  agendaCache: OfflineAgendaCache,
  organizationId: string,
  userId: string,
): Promise<{ cachedAt: string; rangeFrom: string; rangeTo: string } | null> {
  const snapshot = await agendaCache.get(organizationId, userId);
  if (!snapshot) {
    return null;
  }
  return {
    cachedAt: snapshot.cachedAt,
    rangeFrom: snapshot.rangeFrom,
    rangeTo: snapshot.rangeTo,
  };
}
