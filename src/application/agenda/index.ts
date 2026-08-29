import type { EventTypeRepository } from '@/application/ports/event-type-repository';
import type { EventTypeInput } from '@/domain/agenda';

import {
  createEventType,
  deleteEventType,
  listEventTypes,
  updateEventType,
} from './event-type-use-cases';
import type { EventRepository, ListEventsInRangeOptions } from '@/application/ports/event-repository';
import type { EventRecurrenceRepository } from '@/application/ports/event-recurrence-repository';
import type { EventAbsenceRepository } from '@/application/ports/event-absence-repository';
import type { AssignmentRepository } from '@/application/ports/assignment-repository';
import type { GroupRepository } from '@/application/ports/group-repository';
import type { MembershipRepository } from '@/application/ports/membership-repository';
import type { MusicianRepository } from '@/application/ports/musician-repository';
import type { OrganizationRepository } from '@/application/ports/organization-repository';
import type { PieceRepository } from '@/application/ports/piece-repository';
import type { EventInput, ProgramItemInput, RecurrenceEditScope, ScheduleRecurrenceInput } from '@/domain/agenda';

import {
  deleteEvent,
  getEvent,
  scheduleEvent,
  updateEvent,
  listEventsInRange,
} from './event-use-cases';
import { listEventAbsences, toggleEventAbsence } from './event-absence-use-cases';
import { listAssociableAudience } from './list-associable-audience';
import { setEventProgram, getPreviousEventProgram } from './program-use-cases';
import { listMusicianBirthdaysInRangeForAdmin } from './birthday-use-cases';
import {
  cancelRecurrence,
  deleteRecurrenceOccurrence,
  getRecurrence,
  scheduleRecurrence,
  updateRecurrenceOccurrence,
  updateRecurrenceSeries,
} from './recurrence-use-cases';

export type AgendaDeps = {
  eventTypeRepo: EventTypeRepository;
  eventRepo: EventRepository;
  eventRecurrenceRepo: EventRecurrenceRepository;
  eventAbsenceRepo: EventAbsenceRepository;
  pieceRepo: PieceRepository;
  membershipRepo: MembershipRepository;
  musicianRepo: MusicianRepository;
  assignmentRepo: AssignmentRepository;
  groupRepo: GroupRepository;
  orgRepo: OrganizationRepository;
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
        deps.orgRepo,
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
        deps.orgRepo,
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
        deps.orgRepo,
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
        deps.orgRepo,
        organizationId,
        userId,
        eventId,
      ),
    scheduleRecurrence: (organizationId: string, userId: string, input: ScheduleRecurrenceInput) =>
      scheduleRecurrence(
        deps.eventRepo,
        deps.eventRecurrenceRepo,
        deps.membershipRepo,
        deps.musicianRepo,
        deps.assignmentRepo,
        deps.orgRepo,
        organizationId,
        userId,
        input,
      ),
    cancelRecurrence: (organizationId: string, userId: string, recurrenceId: string, fromInstant?: string) =>
      cancelRecurrence(
        deps.eventRecurrenceRepo,
        deps.membershipRepo,
        deps.musicianRepo,
        deps.assignmentRepo,
        deps.orgRepo,
        organizationId,
        userId,
        recurrenceId,
        fromInstant,
      ),
    getRecurrence: (organizationId: string, userId: string, recurrenceId: string) =>
      getRecurrence(
        deps.eventRecurrenceRepo,
        deps.membershipRepo,
        deps.musicianRepo,
        deps.assignmentRepo,
        deps.orgRepo,
        organizationId,
        userId,
        recurrenceId,
      ),
    updateRecurrenceSeries: (
      organizationId: string,
      userId: string,
      recurrenceId: string,
      input: import('./recurrence-use-cases').UpdateRecurrenceSeriesInput,
    ) =>
      updateRecurrenceSeries(
        deps.eventRecurrenceRepo,
        deps.membershipRepo,
        deps.musicianRepo,
        deps.assignmentRepo,
        deps.orgRepo,
        organizationId,
        userId,
        recurrenceId,
        input,
      ),
    updateRecurrenceOccurrence: (
      organizationId: string,
      userId: string,
      eventId: string,
      scope: RecurrenceEditScope,
      input: EventInput,
      options?: { seriesEndsAt?: string; rule?: ScheduleRecurrenceInput['rule'] },
    ) =>
      updateRecurrenceOccurrence(
        deps.eventRepo,
        deps.eventRecurrenceRepo,
        deps.membershipRepo,
        deps.musicianRepo,
        deps.assignmentRepo,
        deps.orgRepo,
        organizationId,
        userId,
        eventId,
        scope,
        input,
        options,
      ),
    deleteRecurrenceOccurrence: (
      organizationId: string,
      userId: string,
      eventId: string,
      scope: RecurrenceEditScope,
    ) =>
      deleteRecurrenceOccurrence(
        deps.eventRepo,
        deps.eventRecurrenceRepo,
        deps.membershipRepo,
        deps.musicianRepo,
        deps.assignmentRepo,
        deps.orgRepo,
        organizationId,
        userId,
        eventId,
        scope,
      ),
    listAssociableAudience: (organizationId: string, userId: string) =>
      listAssociableAudience(
        deps.membershipRepo,
        deps.musicianRepo,
        deps.assignmentRepo,
        deps.groupRepo,
        deps.orgRepo,
        organizationId,
        userId,
      ),
    setEventProgram: (
      organizationId: string,
      eventId: string,
      items: ProgramItemInput[],
    ) => setEventProgram(deps.eventRepo, deps.pieceRepo, organizationId, eventId, items),
    getPreviousEventProgram: (organizationId: string, eventId: string) =>
      getPreviousEventProgram(deps.eventRepo, organizationId, eventId),
    listEventAbsences: (organizationId: string, userId: string, eventId: string) =>
      listEventAbsences(
        deps.eventRepo,
        deps.membershipRepo,
        deps.musicianRepo,
        deps.assignmentRepo,
        deps.orgRepo,
        deps.eventAbsenceRepo,
        organizationId,
        userId,
        eventId,
      ),
    toggleEventAbsence: (
      organizationId: string,
      userId: string,
      eventId: string,
      musicianId: string,
    ) =>
      toggleEventAbsence(
        deps.eventRepo,
        deps.membershipRepo,
        deps.musicianRepo,
        deps.assignmentRepo,
        deps.orgRepo,
        deps.eventAbsenceRepo,
        organizationId,
        userId,
        eventId,
        musicianId,
      ),
    listMusicianBirthdaysInRange: (
      organizationId: string,
      userId: string,
      options: import('./birthday-use-cases').ListMusicianBirthdaysInRangeOptions,
    ) =>
      listMusicianBirthdaysInRangeForAdmin(
        deps.membershipRepo,
        deps.musicianRepo,
        deps.orgRepo,
        organizationId,
        userId,
        options,
      ),
  };
}

export type AgendaUseCases = ReturnType<typeof createAgendaUseCases>;
export type { PreviousEventProgram } from './program-use-cases';
export type {
  AssociableAudience,
  AssociableAudienceGroup,
  AssociableAudienceItem,
  AssociableAudienceMusician,
} from './list-associable-audience';
