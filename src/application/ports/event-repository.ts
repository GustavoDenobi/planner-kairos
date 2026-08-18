import type {
  EventDetail,
  EventInput,
  EventListItem,
  ProgramItemInput,
} from '@/domain/agenda';

export type ListEventsInRangeOptions = {
  from: string;
  to: string;
};

export type EventRepository = {
  listInRange(organizationId: string, options: ListEventsInRangeOptions): Promise<EventListItem[]>;
  getById(organizationId: string, eventId: string): Promise<EventDetail | null>;
  create(organizationId: string, input: EventInput): Promise<EventDetail>;
  update(organizationId: string, eventId: string, input: EventInput): Promise<EventDetail>;
  replaceProgram(
    organizationId: string,
    eventId: string,
    items: ProgramItemInput[],
  ): Promise<EventDetail>;
};
