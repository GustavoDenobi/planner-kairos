import type { EventTypeRepository } from '@/application/ports/event-type-repository';
import type { EventTypeInput } from '@/domain/agenda';

import {
  createEventType,
  deleteEventType,
  listEventTypes,
  updateEventType,
} from './event-type-use-cases';
import type { EventRepository, ListEventsInRangeOptions } from '@/application/ports/event-repository';
import type { PieceRepository } from '@/application/ports/piece-repository';
import type { EventInput, ProgramItemInput } from '@/domain/agenda';

import {
  getEvent,
  listEventsInRange,
  scheduleEvent,
  updateEvent,
} from './event-use-cases';
import { setEventProgram } from './program-use-cases';

export type AgendaDeps = {
  eventTypeRepo: EventTypeRepository;
  eventRepo: EventRepository;
  pieceRepo: PieceRepository;
};

export function createAgendaUseCases(deps: AgendaDeps) {
  return {
    listEventTypes: (organizationId: string) =>
      listEventTypes(deps.eventTypeRepo, organizationId),
    createEventType: (organizationId: string, input: EventTypeInput) =>
      createEventType(deps.eventTypeRepo, organizationId, input),
    updateEventType: (organizationId: string, typeId: string, input: EventTypeInput) =>
      updateEventType(deps.eventTypeRepo, organizationId, typeId, input),
    deleteEventType: (organizationId: string, typeId: string) =>
      deleteEventType(deps.eventTypeRepo, organizationId, typeId),
    listEventsInRange: (organizationId: string, options: ListEventsInRangeOptions) =>
      listEventsInRange(deps.eventRepo, organizationId, options),
    getEvent: (organizationId: string, eventId: string) =>
      getEvent(deps.eventRepo, organizationId, eventId),
    scheduleEvent: (organizationId: string, input: EventInput) =>
      scheduleEvent(deps.eventRepo, organizationId, input),
    updateEvent: (organizationId: string, eventId: string, input: EventInput) =>
      updateEvent(deps.eventRepo, organizationId, eventId, input),
    setEventProgram: (
      organizationId: string,
      eventId: string,
      items: ProgramItemInput[],
    ) => setEventProgram(deps.eventRepo, deps.pieceRepo, organizationId, eventId, items),
  };
}

export type AgendaUseCases = ReturnType<typeof createAgendaUseCases>;
