import type { EventTypeRepository } from '@/application/ports/event-type-repository';
import type { EventTypeInput } from '@/domain/agenda';

import {
  createEventType,
  deleteEventType,
  listEventTypes,
  updateEventType,
} from './event-type-use-cases';
import type { EventRepository, ListEventsInRangeOptions } from '@/application/ports/event-repository';
import type { AssignmentRepository } from '@/application/ports/assignment-repository';
import type { GroupRepository } from '@/application/ports/group-repository';
import type { MembershipRepository } from '@/application/ports/membership-repository';
import type { MusicianRepository } from '@/application/ports/musician-repository';
import type { PieceRepository } from '@/application/ports/piece-repository';
import type { EventInput, ProgramItemInput } from '@/domain/agenda';

import {
  deleteEvent,
  getEvent,
  scheduleEvent,
  updateEvent,
  listEventsInRange,
} from './event-use-cases';
import { listAssociableAudience } from './list-associable-audience';
import { setEventProgram } from './program-use-cases';

export type AgendaDeps = {
  eventTypeRepo: EventTypeRepository;
  eventRepo: EventRepository;
  pieceRepo: PieceRepository;
  membershipRepo: MembershipRepository;
  musicianRepo: MusicianRepository;
  assignmentRepo: AssignmentRepository;
  groupRepo: GroupRepository;
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
    listEventsInRange: (
      organizationId: string,
      userId: string,
      options: ListEventsInRangeOptions,
    ) =>
      listEventsInRange(
        deps.eventRepo,
        deps.membershipRepo,
        deps.musicianRepo,
        deps.assignmentRepo,
        organizationId,
        userId,
        options,
      ),
    getEvent: (organizationId: string, eventId: string) =>
      getEvent(deps.eventRepo, organizationId, eventId),
    scheduleEvent: (organizationId: string, userId: string, input: EventInput) =>
      scheduleEvent(
        deps.eventRepo,
        deps.membershipRepo,
        deps.musicianRepo,
        deps.assignmentRepo,
        organizationId,
        userId,
        input,
      ),
    updateEvent: (
      organizationId: string,
      userId: string,
      eventId: string,
      input: EventInput,
    ) =>
      updateEvent(
        deps.eventRepo,
        deps.membershipRepo,
        deps.musicianRepo,
        deps.assignmentRepo,
        organizationId,
        userId,
        eventId,
        input,
      ),
    deleteEvent: (organizationId: string, userId: string, eventId: string) =>
      deleteEvent(
        deps.eventRepo,
        deps.membershipRepo,
        deps.musicianRepo,
        deps.assignmentRepo,
        organizationId,
        userId,
        eventId,
      ),
    listAssociableAudience: (organizationId: string, userId: string) =>
      listAssociableAudience(
        deps.membershipRepo,
        deps.musicianRepo,
        deps.assignmentRepo,
        deps.groupRepo,
        organizationId,
        userId,
      ),
    setEventProgram: (
      organizationId: string,
      eventId: string,
      items: ProgramItemInput[],
    ) => setEventProgram(deps.eventRepo, deps.pieceRepo, organizationId, eventId, items),
  };
}

export type AgendaUseCases = ReturnType<typeof createAgendaUseCases>;
export type {
  AssociableAudience,
  AssociableAudienceGroup,
  AssociableAudienceItem,
  AssociableAudienceMusician,
} from './list-associable-audience';
