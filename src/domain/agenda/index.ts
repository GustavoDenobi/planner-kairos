export type { EventKind, EventType, EventTypeInput } from './event-type';
export type {
  Event,
  EventInput,
  EventListItem,
  EventAudienceGroup,
  EventAudienceMusician,
} from './event';
export { isEventCancelled } from './event';
export type {
  ProgramItem,
  ProgramItemInput,
  ProgramItemDetail,
  ProgramItemStatus,
  ProgramItemUnit,
  ProgramItemUnitInput,
  ProgramItemUnitDetail,
  ProgramItemValidationContext,
  ProgramItemValidationFile,
  ProgramItemValidationPiece,
} from './program-item';
export { buildProgramItemValidationContext } from './program-validation';
export {
  formatProgramUnitDetail,
  formatProgramUnitSegment,
  formatProgramUnitsSummary,
} from './program-units-format';
export { resolveProgramUnitStartPage, resolveProgramUnitEndPage } from './program-item';
export {
  appendScoreFileToEventProgram,
  programUnitIdentityKey,
} from './append-event-program-score';
export type { EventDetail } from './event-detail';
export type {
  PieceEventHistory,
  PieceEventHistoryItem,
  PieceEventHistorySourceRow,
} from './piece-event-history';
export {
  countPiecePerformancesInLocalYear,
  findLastPiecePerformanceAt,
  localCalendarDaysSince,
  mergePieceEventHistoryRows,
} from './piece-event-history';
export type {
  MusicianEventHistory,
  MusicianEventHistoryItem,
  MusicianEventHistorySourceRow,
} from './musician-event-history';
export {
  buildMusicianEventHistory,
  countMusicianAbsencesInLocalYear,
  countMusicianEventsInLocalYear,
} from './musician-event-history';
export type {
  EventRecurrence,
  ScheduleRecurrenceInput,
  RecurrenceEditScope,
  UpdateRecurrenceOccurrenceInput,
  RecurrenceOccurrenceSummary,
} from './event-recurrence';
export type { RecurrenceRule, WeeklyRule, MonthlyRule } from './recurrence-rule';
export type { GeneratedOccurrence } from './recurrence-engine';
export type {
  EventParticipant,
  EventParticipantMembership,
  EventParticipantAssignment,
  EventAbsence,
} from './event-absence';
export { eventAllParticipantsAbsent } from './event-absence';
export type { AbsenceGroupingMode, AbsenceParticipantBucket } from './absence-grouping';
export { groupEventParticipants } from './absence-grouping';
export type {
  MusicianBirthdayItem,
  MusicianBirthdaySource,
  MusicianBirthdayAssignment,
  ListMusicianBirthdaysOptions,
} from './birthday';
export { listMusicianBirthdaysInRange } from './birthday';
export {
  RECURRENCE_MAX_DAYS,
  generateOccurrenceDates,
  formatRecurrencePreview,
  maxRecurrenceEndDate,
  maxRecurrenceEndDateInputValue,
  validateRecurrenceEndDate,
  validateRecurrenceRule,
  ruleForRescheduledSeries,
} from './recurrence-engine';
export { sameScheduleInstant } from './date-utils';
export {
  canWriteEvent,
  eventDisplayTitle,
  eventHasNoAudience,
  extraAudienceMusicianIds,
  normalizeOptionalText,
  resolveEventColor,
  resolveEventParticipants,
  uniqueIds,
  validateEventAudienceForGroupWriter,
  validateEventInput,
  validateEventTypeInput,
  validateProgramItems,
  validateRecurrenceInput,
} from './rules';
