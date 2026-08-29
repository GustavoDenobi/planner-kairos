import type { AssignmentRepository } from '@/application/ports/assignment-repository';
import type { EventRecurrenceRepository } from '@/application/ports/event-recurrence-repository';
import type { EventRepository } from '@/application/ports/event-repository';
import type { MembershipRepository } from '@/application/ports/membership-repository';
import type { MusicianRepository } from '@/application/ports/musician-repository';
import type { OrganizationRepository } from '@/application/ports/organization-repository';
import type {
  EventDetail,
  EventInput,
  EventRecurrence,
  RecurrenceEditScope,
  RecurrenceRule,
  ScheduleRecurrenceInput,
} from '@/domain/agenda';
import {
  canWriteEvent,
  generateOccurrenceDates,
  uniqueIds,
  validateEventInput,
  validateRecurrenceEndDate,
  validateRecurrenceInput,
  validateRecurrenceRule,
} from '@/domain/agenda';
import { durationMinutesBetween, parseDateInputEndOfDayUtc } from '@/domain/agenda/date-utils';
import { Result } from '@/domain/shared';
import type { EventWriterContext } from './event-use-cases';
import { loadWriterContext, mergeAudienceIds, validateGroupWriterAudience } from './event-use-cases-helpers';

function canWriteRecurrence(input: {
  context: EventWriterContext;
  userId: string;
  createdBy: string | null;
  recurrenceGroupIds: string[];
}): boolean {
  return canWriteEvent({
    isPrivileged: input.context.isPrivileged,
    isGroupWriter: input.context.isGroupWriter,
    userId: input.userId,
    createdBy: input.createdBy,
    eventGroupIds: input.recurrenceGroupIds,
    writableGroupIds: input.context.writableGroupIds,
  });
}

function mergePreservedAudience(
  context: EventWriterContext,
  existingGroupIds: string[],
  existingMusicianIds: string[],
  audience: { groupIds: string[]; musicianIds: string[] },
) {
  const preservedGroupIds = context.isPrivileged
    ? []
    : existingGroupIds.filter((groupId) => !context.writableGroupIds.includes(groupId));
  const preservedMusicianIds = context.isPrivileged
    ? []
    : existingMusicianIds.filter((musicianId) => {
        if (musicianId === context.myMusicianId) {
          return false;
        }
        const groups = context.musicianGroupIdsByMusicianId[musicianId] ?? [];
        return !groups.some((groupId) => context.writableGroupIds.includes(groupId));
      });
  return {
    groupIds: uniqueIds([...preservedGroupIds, ...audience.groupIds]),
    musicianIds: uniqueIds([...preservedMusicianIds, ...audience.musicianIds]),
  };
}

export async function scheduleRecurrence(
  eventRepo: EventRepository,
  recurrenceRepo: EventRecurrenceRepository,
  membershipRepo: MembershipRepository,
  musicianRepo: MusicianRepository,
  assignmentRepo: AssignmentRepository,
  orgRepo: OrganizationRepository,
  organizationId: string,
  userId: string,
  input: ScheduleRecurrenceInput,
) {
  const contextResult = await loadWriterContext(
    membershipRepo,
    musicianRepo,
    assignmentRepo,
    orgRepo,
    organizationId,
    userId,
  );
  if (!contextResult.ok) {
    return contextResult;
  }

  const context = contextResult.value;
  if (!context.isPrivileged && !context.isGroupWriter) {
    return Result.fail('cannot_create_event' as const);
  }

  const limitAnchorAt = new Date().toISOString();
  const validationError = validateRecurrenceInput(input, limitAnchorAt);
  if (validationError) {
    return Result.fail(validationError);
  }

  const audience = mergeAudienceIds(input, context.myMusicianId);
  const audienceError = validateGroupWriterAudience(context, audience.groupIds, audience.musicianIds);
  if (audienceError) {
    return Result.fail(audienceError);
  }

  const durationMinutes = durationMinutesBetween(input.startsAt, input.endsAt);
  const occurrences = generateOccurrenceDates({
    rule: input.rule,
    seriesStartsAt: input.startsAt,
    seriesEndsAt: input.seriesEndsAt,
    durationMinutes,
  });

  try {
    const { recurrence, firstEventId } = await recurrenceRepo.createWithOccurrences(organizationId, {
      input: {
        ...input,
        createdBy: userId,
        groupIds: audience.groupIds,
        musicianIds: audience.musicianIds,
      },
      occurrences,
      durationMinutes,
      limitAnchorAt,
    });

    const event = await eventRepo.getById(organizationId, firstEventId);
    if (!event) {
      return Result.fail('create_failed');
    }

    return Result.ok({ event, recurrence });
  } catch {
    return Result.fail('create_failed');
  }
}

export async function cancelRecurrence(
  recurrenceRepo: EventRecurrenceRepository,
  membershipRepo: MembershipRepository,
  musicianRepo: MusicianRepository,
  assignmentRepo: AssignmentRepository,
  orgRepo: OrganizationRepository,
  organizationId: string,
  userId: string,
  recurrenceId: string,
  fromInstant: string = new Date().toISOString(),
) {
  const contextResult = await loadWriterContext(
    membershipRepo,
    musicianRepo,
    assignmentRepo,
    orgRepo,
    organizationId,
    userId,
  );
  if (!contextResult.ok) {
    return contextResult;
  }

  const recurrence = await recurrenceRepo.getById(organizationId, recurrenceId);
  if (!recurrence) {
    return Result.fail('not_found');
  }

  if (
    !canWriteRecurrence({
      context: contextResult.value,
      userId,
      createdBy: recurrence.createdBy,
      recurrenceGroupIds: recurrence.groupIds,
    })
  ) {
    return Result.fail('not_allowed' as const);
  }

  try {
    await recurrenceRepo.cancel(organizationId, recurrenceId, fromInstant);
    return Result.ok(undefined);
  } catch {
    return Result.fail('delete_failed');
  }
}

export async function getRecurrence(
  recurrenceRepo: EventRecurrenceRepository,
  membershipRepo: MembershipRepository,
  musicianRepo: MusicianRepository,
  assignmentRepo: AssignmentRepository,
  orgRepo: OrganizationRepository,
  organizationId: string,
  userId: string,
  recurrenceId: string,
): Promise<Result<EventRecurrence, 'not_found' | 'not_allowed' | 'not_a_member'>> {
  const contextResult = await loadWriterContext(
    membershipRepo,
    musicianRepo,
    assignmentRepo,
    orgRepo,
    organizationId,
    userId,
  );
  if (!contextResult.ok) {
    return contextResult;
  }

  const recurrence = await recurrenceRepo.getById(organizationId, recurrenceId);
  if (!recurrence) {
    return Result.fail('not_found');
  }

  if (
    !canWriteRecurrence({
      context: contextResult.value,
      userId,
      createdBy: recurrence.createdBy,
      recurrenceGroupIds: recurrence.groupIds,
    })
  ) {
    return Result.fail('not_allowed' as const);
  }

  return Result.ok(recurrence);
}

export type UpdateRecurrenceSeriesInput = {
  rule: RecurrenceRule;
  seriesEndsAt: string;
};

export async function updateRecurrenceSeries(
  recurrenceRepo: EventRecurrenceRepository,
  membershipRepo: MembershipRepository,
  musicianRepo: MusicianRepository,
  assignmentRepo: AssignmentRepository,
  orgRepo: OrganizationRepository,
  organizationId: string,
  userId: string,
  recurrenceId: string,
  input: UpdateRecurrenceSeriesInput,
) {
  const contextResult = await loadWriterContext(
    membershipRepo,
    musicianRepo,
    assignmentRepo,
    orgRepo,
    organizationId,
    userId,
  );
  if (!contextResult.ok) {
    return contextResult;
  }

  const recurrence = await recurrenceRepo.getById(organizationId, recurrenceId);
  if (!recurrence) {
    return Result.fail('not_found');
  }

  if (
    !canWriteRecurrence({
      context: contextResult.value,
      userId,
      createdBy: recurrence.createdBy,
      recurrenceGroupIds: recurrence.groupIds,
    })
  ) {
    return Result.fail('not_allowed' as const);
  }

  const ruleError = validateRecurrenceRule(input.rule);
  if (ruleError) {
    return Result.fail(ruleError);
  }

  const endError = validateRecurrenceEndDate({
    seriesStartsAt: recurrence.seriesStartsAt,
    seriesEndsAt: input.seriesEndsAt,
    limitAnchorAt: recurrence.limitAnchorAt,
  });
  if (endError) {
    return Result.fail(endError);
  }

  const occurrences = generateOccurrenceDates({
    rule: input.rule,
    seriesStartsAt: recurrence.seriesStartsAt,
    seriesEndsAt: input.seriesEndsAt,
    durationMinutes: recurrence.durationMinutes,
  });
  if (occurrences.length === 0) {
    return Result.fail('recurrence_no_occurrences' as const);
  }

  try {
    const fromInstant = new Date().toISOString();
    const summaries = await recurrenceRepo.listOccurrenceSummaries(organizationId, recurrenceId);
    const maxKeptIndex = summaries
      .filter((item) => item.startsAt < fromInstant || item.isException)
      .reduce((max, item) => Math.max(max, item.occurrenceIndex), -1);

    const updatedRecurrence = await recurrenceRepo.updateTemplate(organizationId, recurrenceId, {
      rule: input.rule,
      seriesEndsAt: input.seriesEndsAt,
    });

    await recurrenceRepo.deleteNonExceptionOccurrencesFromInstant(
      organizationId,
      recurrenceId,
      fromInstant,
    );

    const endInstant = parseDateInputEndOfDayUtc(
      input.seriesEndsAt.split('T')[0] ?? input.seriesEndsAt,
    ).toISOString();
    await recurrenceRepo.deleteOccurrencesAfterDate(organizationId, recurrenceId, endInstant);

    const futureOccurrences = occurrences
      .filter((occurrence) => occurrence.startsAt >= fromInstant)
      .map((occurrence, index) => ({
        ...occurrence,
        occurrenceIndex: maxKeptIndex + 1 + index,
      }));

    await recurrenceRepo.insertOccurrences(organizationId, updatedRecurrence, futureOccurrences);

    return Result.ok(updatedRecurrence);
  } catch {
    return Result.fail('update_failed' as const);
  }
}

export async function updateRecurrenceOccurrence(
  eventRepo: EventRepository,
  recurrenceRepo: EventRecurrenceRepository,
  membershipRepo: MembershipRepository,
  musicianRepo: MusicianRepository,
  assignmentRepo: AssignmentRepository,
  orgRepo: OrganizationRepository,
  organizationId: string,
  userId: string,
  eventId: string,
  scope: RecurrenceEditScope,
  input: EventInput,
  options?: { seriesEndsAt?: string; rule?: ScheduleRecurrenceInput['rule'] },
) {
  const contextResult = await loadWriterContext(
    membershipRepo,
    musicianRepo,
    assignmentRepo,
    orgRepo,
    organizationId,
    userId,
  );
  if (!contextResult.ok) {
    return contextResult;
  }

  const context = contextResult.value;
  const existing = await eventRepo.getById(organizationId, eventId);
  if (!existing) {
    return Result.fail('not_found');
  }

  if (!existing.recurrenceId || existing.occurrenceIndex == null) {
    return Result.fail('not_recurrence_event');
  }

  if (
    !canWriteEvent({
      isPrivileged: context.isPrivileged,
      isGroupWriter: context.isGroupWriter,
      userId,
      createdBy: existing.createdBy,
      eventGroupIds: existing.groups.map((group) => group.id),
      writableGroupIds: context.writableGroupIds,
    })
  ) {
    return Result.fail('not_allowed' as const);
  }

  const validationError = validateEventInput(input);
  if (validationError) {
    return Result.fail(validationError);
  }

  const audience = mergeAudienceIds(input, context.myMusicianId);
  const audienceError = validateGroupWriterAudience(context, audience.groupIds, audience.musicianIds);
  if (audienceError) {
    return Result.fail(audienceError);
  }

  const mergedAudience = mergePreservedAudience(
    context,
    existing.groups.map((group) => group.id),
    existing.musicians.map((musician) => musician.id),
    audience,
  );

  const recurrence = await recurrenceRepo.getById(organizationId, existing.recurrenceId);
  if (!recurrence) {
    return Result.fail('not_found');
  }

  try {
    if (scope === 'this') {
      const event = await eventRepo.update(organizationId, eventId, {
        ...input,
        groupIds: mergedAudience.groupIds,
        musicianIds: mergedAudience.musicianIds,
      });
      await eventRepo.markAsException(organizationId, eventId);
      return Result.ok(await eventRepo.getById(organizationId, eventId) ?? event);
    }

    if (scope === 'all_future') {
      if (options?.seriesEndsAt) {
        const endError = validateRecurrenceEndDate({
          seriesStartsAt: input.startsAt,
          seriesEndsAt: options.seriesEndsAt,
          limitAnchorAt: recurrence.limitAnchorAt,
        });
        if (endError) {
          return Result.fail(endError);
        }
      }

      const durationMinutes = durationMinutesBetween(input.startsAt, input.endsAt);
      const nextSeriesEndsAt = options?.seriesEndsAt ?? recurrence.seriesEndsAt.split('T')[0] ?? recurrence.seriesEndsAt;

      await recurrenceRepo.updateTemplate(organizationId, existing.recurrenceId, {
        typeId: input.typeId,
        title: input.title,
        location: input.location,
        notes: input.notes,
        durationMinutes,
        seriesEndsAt: nextSeriesEndsAt,
        rule: options?.rule ?? recurrence.rule,
      });
      await recurrenceRepo.replaceAudience(
        organizationId,
        existing.recurrenceId,
        mergedAudience.groupIds,
        mergedAudience.musicianIds,
      );

      await eventRepo.bulkUpdateFutureOccurrences(
        organizationId,
        existing.recurrenceId,
        existing.occurrenceIndex,
        {
          typeId: input.typeId,
          title: input.title,
          location: input.location,
          notes: input.notes,
        },
        true,
      );
      await eventRepo.replaceAudienceForFutureOccurrences(
        organizationId,
        existing.recurrenceId,
        existing.occurrenceIndex,
        mergedAudience.groupIds,
        mergedAudience.musicianIds,
        true,
      );

      if (options?.seriesEndsAt) {
        const endInstant = parseDateInputEndOfDayUtc(nextSeriesEndsAt).toISOString();
        await recurrenceRepo.deleteOccurrencesAfterDate(organizationId, existing.recurrenceId, endInstant);
        await recurrenceRepo.truncateSeriesEnd(organizationId, existing.recurrenceId, nextSeriesEndsAt);
      }

      const updated = await eventRepo.getById(organizationId, eventId);
      return updated ? Result.ok(updated) : Result.fail('update_failed');
    }

    // following: split series
    const previousIndex = existing.occurrenceIndex - 1;
    if (previousIndex >= 0) {
      const summaries = await recurrenceRepo.listOccurrenceSummaries(organizationId, existing.recurrenceId);
      const previous = summaries.find((item) => item.occurrenceIndex === previousIndex);
      if (previous) {
        const prevDate = previous.startsAt.split('T')[0] ?? previous.startsAt;
        await recurrenceRepo.truncateSeriesEnd(organizationId, existing.recurrenceId, prevDate);
      }
    } else {
      await recurrenceRepo.cancel(organizationId, existing.recurrenceId, existing.startsAt);
    }

    await recurrenceRepo.deleteOccurrencesFromIndex(
      organizationId,
      existing.recurrenceId,
      existing.occurrenceIndex,
      true,
    );

    const seriesEndsAt = options?.seriesEndsAt ?? recurrence.seriesEndsAt.split('T')[0] ?? recurrence.seriesEndsAt;
    const splitValidation = validateRecurrenceInput(
      {
        ...input,
        rule: options?.rule ?? recurrence.rule,
        seriesEndsAt,
        groupIds: mergedAudience.groupIds,
        musicianIds: mergedAudience.musicianIds,
        createdBy: userId,
      },
      recurrence.limitAnchorAt,
    );
    if (splitValidation) {
      return Result.fail(splitValidation);
    }

    const durationMinutes = durationMinutesBetween(input.startsAt, input.endsAt);
    const occurrences = generateOccurrenceDates({
      rule: options?.rule ?? recurrence.rule,
      seriesStartsAt: input.startsAt,
      seriesEndsAt,
      durationMinutes,
    });

    const { firstEventId } = await recurrenceRepo.createWithOccurrences(organizationId, {
      input: {
        ...input,
        rule: options?.rule ?? recurrence.rule,
        seriesEndsAt,
        createdBy: userId,
        groupIds: mergedAudience.groupIds,
        musicianIds: mergedAudience.musicianIds,
      },
      occurrences,
      durationMinutes,
      limitAnchorAt: recurrence.limitAnchorAt,
    });

    const event = await eventRepo.getById(organizationId, firstEventId);
    return event ? Result.ok(event) : Result.fail('update_failed');
  } catch {
    return Result.fail('update_failed');
  }
}

export async function deleteRecurrenceOccurrence(
  eventRepo: EventRepository,
  recurrenceRepo: EventRecurrenceRepository,
  membershipRepo: MembershipRepository,
  musicianRepo: MusicianRepository,
  assignmentRepo: AssignmentRepository,
  orgRepo: OrganizationRepository,
  organizationId: string,
  userId: string,
  eventId: string,
  scope: RecurrenceEditScope,
) {
  const contextResult = await loadWriterContext(
    membershipRepo,
    musicianRepo,
    assignmentRepo,
    orgRepo,
    organizationId,
    userId,
  );
  if (!contextResult.ok) {
    return contextResult;
  }

  const existing = await eventRepo.getById(organizationId, eventId);
  if (!existing) {
    return Result.fail('not_found');
  }

  if (!existing.recurrenceId) {
    return Result.fail('not_recurrence_event');
  }

  if (
    !canWriteEvent({
      isPrivileged: contextResult.value.isPrivileged,
      isGroupWriter: contextResult.value.isGroupWriter,
      userId,
      createdBy: existing.createdBy,
      eventGroupIds: existing.groups.map((group) => group.id),
      writableGroupIds: contextResult.value.writableGroupIds,
    })
  ) {
    return Result.fail('not_allowed' as const);
  }

  try {
    if (scope === 'this') {
      await eventRepo.delete(organizationId, eventId);
      return Result.ok(undefined);
    }

    if (scope === 'all_future') {
      return cancelRecurrence(
        recurrenceRepo,
        membershipRepo,
        musicianRepo,
        assignmentRepo,
        orgRepo,
        organizationId,
        userId,
        existing.recurrenceId,
        existing.startsAt,
      );
    }

    // following
    if (existing.occurrenceIndex == null) {
      return Result.fail('not_recurrence_event');
    }

    const previousIndex = existing.occurrenceIndex - 1;
    if (previousIndex >= 0) {
      const summaries = await recurrenceRepo.listOccurrenceSummaries(organizationId, existing.recurrenceId);
      const previous = summaries.find((item) => item.occurrenceIndex === previousIndex);
      if (previous) {
        const prevDate = previous.startsAt.split('T')[0] ?? previous.startsAt;
        await recurrenceRepo.truncateSeriesEnd(organizationId, existing.recurrenceId, prevDate);
      }
    } else {
      await recurrenceRepo.cancel(organizationId, existing.recurrenceId, existing.startsAt);
    }

    await recurrenceRepo.deleteOccurrencesFromIndex(
      organizationId,
      existing.recurrenceId,
      existing.occurrenceIndex,
      true,
    );

    return Result.ok(undefined);
  } catch {
    return Result.fail('delete_failed');
  }
}

export type ScheduleRecurrenceResult = {
  event: EventDetail;
  recurrence: Awaited<ReturnType<EventRecurrenceRepository['getById']>>;
};
