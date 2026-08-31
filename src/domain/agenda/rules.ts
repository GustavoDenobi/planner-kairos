import type { EventInput, EventAudienceMusician } from './event';
import type { EventKind, EventType, EventTypeInput } from './event-type';
import type { EventParticipant } from './event-absence';
import type {
  ProgramItemInput,
  ProgramItemStatus,
  ProgramItemUnitInput,
  ProgramItemValidationContext,
} from './program-item';
import type { ScheduleRecurrenceInput } from './event-recurrence';
import {
  generateOccurrenceDates,
  validateRecurrenceEndDate,
  validateRecurrenceRule,
} from './recurrence-engine';
import { durationMinutesBetween } from './date-utils';

const EVENT_KINDS: EventKind[] = ['rehearsal', 'service', 'class', 'special'];
const PROGRAM_ITEM_STATUSES: ProgramItemStatus[] = ['planned', 'performed', 'skipped'];

const EVENT_KIND_COLORS: Record<EventKind, string> = {
  rehearsal: 'blue-500',
  service: 'amber-500',
  class: 'emerald-500',
  special: 'fuchsia-500',
};

export function isValidTypeId(typeId: string): boolean {
  return typeId.trim().length > 0;
}

export function isValidStartsAt(startsAt: string): boolean {
  const date = new Date(startsAt);
  return !Number.isNaN(date.getTime());
}

export function isValidEventTypeName(name: string): boolean {
  return name.trim().length > 0;
}

export function isValidEventKind(kind: EventKind): boolean {
  return EVENT_KINDS.includes(kind);
}

export function validateEventTypeInput(input: EventTypeInput): string | null {
  if (!isValidEventTypeName(input.name)) {
    return 'invalid_name';
  }
  if (!isValidEventKind(input.kind)) {
    return 'invalid_kind';
  }
  if (
    input.sortOrder !== undefined &&
    (!Number.isInteger(input.sortOrder) || input.sortOrder < 0)
  ) {
    return 'invalid_sort_order';
  }
  return null;
}

export function validateEventInput(input: EventInput): string | null {
  if (!isValidTypeId(input.typeId)) {
    return 'invalid_type';
  }
  if (!isValidStartsAt(input.startsAt)) {
    return 'invalid_dates';
  }
  if (input.endsAt) {
    const starts = new Date(input.startsAt).getTime();
    const ends = new Date(input.endsAt).getTime();
    if (Number.isNaN(ends) || ends < starts) {
      return 'invalid_dates';
    }
  }
  return null;
}

export function validateRecurrenceInput(
  input: ScheduleRecurrenceInput,
  limitAnchorAt: string = new Date().toISOString(),
): string | null {
  const eventError = validateEventInput(input);
  if (eventError) {
    return eventError;
  }
  const ruleError = validateRecurrenceRule(input.rule);
  if (ruleError) {
    return ruleError;
  }
  const endError = validateRecurrenceEndDate({
    seriesStartsAt: input.startsAt,
    seriesEndsAt: input.seriesEndsAt,
    limitAnchorAt,
  });
  if (endError) {
    return endError;
  }
  const occurrences = generateOccurrenceDates({
    rule: input.rule,
    seriesStartsAt: input.startsAt,
    seriesEndsAt: input.seriesEndsAt,
    durationMinutes: durationMinutesBetween(input.startsAt, input.endsAt),
  });
  if (occurrences.length === 0) {
    return 'recurrence_no_occurrences';
  }
  return null;
}

export function isValidProgramItemStatus(status: ProgramItemStatus): boolean {
  return PROGRAM_ITEM_STATUSES.includes(status);
}

function validateProgramItemUnitPages(unit: ProgramItemUnitInput): string | null {
  const startPage = unit.startPage ?? null;
  const endPage = unit.endPage ?? null;

  if (startPage != null && (!Number.isInteger(startPage) || startPage < 1)) {
    return 'invalid_start_page';
  }
  if (endPage != null && (!Number.isInteger(endPage) || endPage < 1)) {
    return 'invalid_end_page';
  }
  if (startPage != null && endPage != null && endPage < startPage) {
    return 'invalid_page_range';
  }
  return null;
}

function unitDedupeKey(unit: ProgramItemUnitInput): string {
  if (unit.pieceFileTocEntryId) {
    return `toc:${unit.pieceFileTocEntryId}`;
  }
  return `file:${unit.pieceFileId}`;
}

function validateProgramItemUnitReferences(
  unit: ProgramItemUnitInput,
  scoreFileIds: Set<string>,
  context: ProgramItemValidationContext | undefined,
  pieceId: string,
): string | null {
  if (!unit.pieceFileId.trim()) {
    return 'invalid_unit_file';
  }
  if (!scoreFileIds.has(unit.pieceFileId)) {
    return 'invalid_unit_file';
  }

  const piece = context?.piecesById.get(pieceId);
  const file = piece?.files.find((item) => item.id === unit.pieceFileId);

  if (unit.pieceFileTocEntryId) {
    if (!file?.tocEntryIds.has(unit.pieceFileTocEntryId)) {
      return 'invalid_toc_entry';
    }
  }

  return validateProgramItemUnitPages(unit);
}

function validateProgramItemUnits(
  units: ProgramItemUnitInput[] | undefined,
  pieceId: string,
  context: ProgramItemValidationContext | undefined,
): string | null {
  if (!units || units.length === 0) {
    return null;
  }

  const piece = context?.piecesById.get(pieceId);
  if (!piece) {
    return 'piece_not_found';
  }

  const scoreFiles = piece.files.filter((file) => file.kind === 'score');
  const scoreFileIds = new Set(scoreFiles.map((file) => file.id));
  const generalScoreFiles = scoreFiles.filter((file) => file.partLinkCount === 0);

  if (piece.fileOrganization === 'distributed') {
    if (units.length > 1) {
      return 'distributed_single_unit';
    }
    const unit = units[0];
    if (!unit) {
      return null;
    }
    if (!scoreFileIds.has(unit.pieceFileId)) {
      return 'invalid_unit_file';
    }
    const file = scoreFiles.find((item) => item.id === unit.pieceFileId);
    if (file && file.partLinkCount > 0) {
      return 'distributed_general_score_only';
    }
    return validateProgramItemUnitReferences(unit, scoreFileIds, context, pieceId);
  }

  if (piece.fileOrganization === 'single') {
    if (units.length > 1) {
      return 'single_single_unit';
    }
    const unit = units[0];
    if (!unit) {
      return null;
    }
    return validateProgramItemUnitReferences(unit, scoreFileIds, context, pieceId);
  }

  const seenKeys = new Set<string>();
  for (const unit of units) {
    const refError = validateProgramItemUnitReferences(unit, scoreFileIds, context, pieceId);
    if (refError) {
      return refError;
    }

    const key = unitDedupeKey(unit);
    if (seenKeys.has(key)) {
      return unit.pieceFileTocEntryId ? 'duplicate_toc_entry' : 'duplicate_unit_file';
    }
    seenKeys.add(key);
  }

  if (generalScoreFiles.length === 0 && units.length === 0) {
    return null;
  }

  return null;
}

export function validateProgramItems(
  items: ProgramItemInput[],
  context?: ProgramItemValidationContext,
): string | null {
  for (const item of items) {
    if (!item.pieceId.trim()) {
      return 'invalid_piece';
    }
    if (item.status !== undefined && !isValidProgramItemStatus(item.status)) {
      return 'invalid_status';
    }

    const unitsError = validateProgramItemUnits(item.units, item.pieceId, context);
    if (unitsError) {
      return unitsError;
    }
  }

  return null;
}

export function resolveEventColor(type: Pick<EventType, 'color' | 'kind'>): string {
  if (type.color?.trim()) {
    return type.color.trim();
  }
  return EVENT_KIND_COLORS[type.kind];
}

export function eventDisplayTitle(
  event: { title: string | null },
  type: Pick<EventType, 'name'>,
): string {
  const custom = event.title?.trim();
  if (custom) {
    return custom;
  }
  return type.name;
}

export function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids.filter((id) => id.trim().length > 0))];
}

export function eventHasNoAudience(groupIds: string[], musicianIds: string[]): boolean {
  return groupIds.length === 0 && musicianIds.length === 0;
}

export function extraAudienceMusicianIds(
  musicianIds: string[],
  creatorMusicianId: string | null,
): string[] {
  if (!creatorMusicianId) {
    return musicianIds;
  }
  return musicianIds.filter((id) => id !== creatorMusicianId);
}

export function validateEventAudienceForGroupWriter(input: {
  groupIds: string[];
  musicianIds: string[];
  writableGroupIds: string[];
  musicianGroupIdsByMusicianId: Record<string, string[]>;
  creatorMusicianId: string | null;
}): string | null {
  const writableGroups = new Set(input.writableGroupIds);

  for (const groupId of input.groupIds) {
    if (!writableGroups.has(groupId)) {
      return 'audience_group_not_allowed';
    }
  }

  for (const musicianId of input.musicianIds) {
    if (musicianId === input.creatorMusicianId) {
      continue;
    }
    const groups = input.musicianGroupIdsByMusicianId[musicianId] ?? [];
    if (!groups.some((groupId) => writableGroups.has(groupId))) {
      return 'audience_musician_not_allowed';
    }
  }

  return null;
}

export function canWriteEvent(input: {
  isPrivileged: boolean;
  isGroupWriter: boolean;
  userId: string;
  createdBy: string | null;
  eventGroupIds: string[];
  writableGroupIds: string[];
}): boolean {
  if (input.isPrivileged) {
    return true;
  }
  if (!input.isGroupWriter) {
    return false;
  }
  if (input.createdBy === input.userId) {
    return true;
  }
  const writableGroups = new Set(input.writableGroupIds);
  return input.eventGroupIds.some((groupId) => writableGroups.has(groupId));
}

export function resolveEventParticipants(input: {
  groupAssignments: Array<{ musicianId: string; musicianName: string; groupName: string }>;
  directMusicians: EventAudienceMusician[];
  partNamesByMusicianId: Map<string, string[]>;
}): EventParticipant[] {
  const byMusicianId = new Map<string, EventParticipant>();

  for (const assignment of input.groupAssignments) {
    const existing = byMusicianId.get(assignment.musicianId);
    if (existing) {
      if (!existing.groupNames.includes(assignment.groupName)) {
        existing.groupNames.push(assignment.groupName);
      }
      continue;
    }

    byMusicianId.set(assignment.musicianId, {
      musicianId: assignment.musicianId,
      fullName: assignment.musicianName,
      groupNames: [assignment.groupName],
      partNames: input.partNamesByMusicianId.get(assignment.musicianId) ?? [],
    });
  }

  for (const musician of input.directMusicians) {
    if (!byMusicianId.has(musician.id)) {
      byMusicianId.set(musician.id, {
        musicianId: musician.id,
        fullName: musician.fullName,
        groupNames: [],
        partNames: input.partNamesByMusicianId.get(musician.id) ?? [],
      });
    }
  }

  return [...byMusicianId.values()]
    .map((participant) => ({
      ...participant,
      groupNames: [...participant.groupNames].sort((left, right) =>
        left.localeCompare(right, 'pt-BR'),
      ),
    }))
    .sort((left, right) => left.fullName.localeCompare(right.fullName, 'pt-BR'));
}
