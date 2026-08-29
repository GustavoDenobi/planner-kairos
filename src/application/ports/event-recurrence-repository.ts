import type {
  EventRecurrence,
  GeneratedOccurrence,
  RecurrenceRule,
  ScheduleRecurrenceInput,
} from '@/domain/agenda';

export type CreateRecurrencePayload = {
  input: ScheduleRecurrenceInput;
  occurrences: GeneratedOccurrence[];
  durationMinutes: number | null;
  limitAnchorAt: string;
};

export type EventRecurrenceRepository = {
  createWithOccurrences(organizationId: string, payload: CreateRecurrencePayload): Promise<{
    recurrence: EventRecurrence;
    firstEventId: string;
  }>;
  getById(organizationId: string, recurrenceId: string): Promise<EventRecurrence | null>;
  cancel(organizationId: string, recurrenceId: string, fromInstant: string): Promise<void>;
  updateTemplate(
    organizationId: string,
    recurrenceId: string,
    patch: {
      typeId?: string;
      title?: string | null;
      location?: string | null;
      notes?: string | null;
      durationMinutes?: number | null;
      seriesStartsAt?: string;
      seriesEndsAt?: string;
      rule?: RecurrenceRule;
    },
  ): Promise<EventRecurrence>;
  replaceAudience(
    organizationId: string,
    recurrenceId: string,
    groupIds: string[],
    musicianIds: string[],
  ): Promise<void>;
  deleteOccurrencesFromIndex(
    organizationId: string,
    recurrenceId: string,
    fromIndex: number,
    includeFromIndex?: boolean,
  ): Promise<void>;
  deleteOccurrencesAfterDate(
    organizationId: string,
    recurrenceId: string,
    afterInstant: string,
  ): Promise<void>;
  listOccurrenceSummaries(
    organizationId: string,
    recurrenceId: string,
  ): Promise<Array<{ id: string; occurrenceIndex: number; startsAt: string; isException: boolean }>>;
  truncateSeriesEnd(
    organizationId: string,
    recurrenceId: string,
    seriesEndsAt: string,
  ): Promise<void>;
  deleteNonExceptionOccurrencesFromInstant(
    organizationId: string,
    recurrenceId: string,
    fromInstant: string,
  ): Promise<void>;
  insertOccurrences(
    organizationId: string,
    recurrence: EventRecurrence,
    occurrences: GeneratedOccurrence[],
  ): Promise<void>;
};
