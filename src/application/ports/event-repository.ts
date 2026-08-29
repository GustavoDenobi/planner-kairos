import type { EventKind } from '@/domain/agenda';
import type {
  EventDetail,
  EventInput,
  EventListItem,
  ProgramItemInput,
} from '@/domain/agenda';

export type ListEventsInRangeOptions = {
  from: string;
  to: string;
  mineOnly?: boolean;
  typeId?: string | null;
  kind?: EventKind | null;
  groupId?: string | null;
  viewerUserId?: string;
  viewerMusicianId?: string | null;
  viewerGroupIds?: string[];
};

export type EventOccurrencePatch = {
  typeId?: string;
  title?: string | null;
  startsAt?: string;
  endsAt?: string | null;
  location?: string | null;
  notes?: string | null;
};

export type EventRepository = {
  listInRange(organizationId: string, options: ListEventsInRangeOptions): Promise<EventListItem[]>;
  getById(organizationId: string, eventId: string): Promise<EventDetail | null>;
  getOccurrenceByIndex(
    organizationId: string,
    recurrenceId: string,
    occurrenceIndex: number,
  ): Promise<EventDetail | null>;
  create(organizationId: string, input: EventInput): Promise<EventDetail>;
  update(organizationId: string, eventId: string, input: EventInput): Promise<EventDetail>;
  replaceProgram(
    organizationId: string,
    eventId: string,
    items: ProgramItemInput[],
  ): Promise<EventDetail>;
  delete(organizationId: string, eventId: string): Promise<void>;
  markAsException(organizationId: string, eventId: string): Promise<void>;
  bulkUpdateFutureOccurrences(
    organizationId: string,
    recurrenceId: string,
    fromIndex: number,
    patch: EventOccurrencePatch,
    skipExceptions: boolean,
  ): Promise<void>;
  replaceAudienceForFutureOccurrences(
    organizationId: string,
    recurrenceId: string,
    fromIndex: number,
    groupIds: string[],
    musicianIds: string[],
    skipExceptions: boolean,
  ): Promise<void>;
};
