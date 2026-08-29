import type { EventInput } from './event';
import type { RecurrenceRule } from './recurrence-rule';

export type RecurrenceEditScope = 'this' | 'following' | 'all_future';

export type EventRecurrence = {
  id: string;
  organizationId: string;
  typeId: string;
  title: string | null;
  location: string | null;
  notes: string | null;
  durationMinutes: number | null;
  seriesStartsAt: string;
  seriesEndsAt: string;
  rule: RecurrenceRule;
  limitAnchorAt: string;
  cancelledAt: string | null;
  createdBy: string | null;
  groupIds: string[];
  musicianIds: string[];
};

export type ScheduleRecurrenceInput = EventInput & {
  rule: RecurrenceRule;
  seriesEndsAt: string;
};

export type UpdateRecurrenceOccurrenceInput = {
  scope: RecurrenceEditScope;
  eventInput: EventInput;
  seriesEndsAt?: string;
  rule?: RecurrenceRule;
};

export type RecurrenceOccurrenceSummary = {
  id: string;
  occurrenceIndex: number;
  startsAt: string;
  isException: boolean;
};
