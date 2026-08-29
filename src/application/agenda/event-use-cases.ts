import type { AssignmentRepository } from '@/application/ports/assignment-repository';
import type { EventRepository, ListEventsInRangeOptions } from '@/application/ports/event-repository';
import type { MembershipRepository } from '@/application/ports/membership-repository';
import type { MusicianRepository } from '@/application/ports/musician-repository';
import type { EventInput } from '@/domain/agenda';
import {
  canWriteEvent,
  uniqueIds,
  validateEventInput,
} from '@/domain/agenda';
import { Result } from '@/domain/shared';
import {
  loadWriterContext,
  mergeAudienceIds,
  validateGroupWriterAudience,
} from './event-use-cases-helpers';

export type { EventWriterContext } from './event-use-cases-helpers';

export async function listEventsInRange(
  eventRepo: EventRepository,
  membershipRepo: MembershipRepository,
  musicianRepo: MusicianRepository,
  assignmentRepo: AssignmentRepository,
  organizationId: string,
  userId: string,
  options: ListEventsInRangeOptions,
) {
  const contextResult = await loadWriterContext(
    membershipRepo,
    musicianRepo,
    assignmentRepo,
    organizationId,
    userId,
  );
  if (!contextResult.ok) {
    return contextResult;
  }

  const context = contextResult.value;
  const events = await eventRepo.listInRange(organizationId, {
    ...options,
    viewerUserId: userId,
     viewerMusicianId: context.myMusicianId,
    viewerGroupIds: context.memberGroupIds,
  });
  return Result.ok(events);
}

export async function getEvent(
  eventRepo: EventRepository,
  organizationId: string,
  eventId: string,
) {
  const event = await eventRepo.getById(organizationId, eventId);
  if (!event) {
    return Result.fail('not_found');
  }
  return Result.ok(event);
}

export async function scheduleEvent(
  eventRepo: EventRepository,
  membershipRepo: MembershipRepository,
  musicianRepo: MusicianRepository,
  assignmentRepo: AssignmentRepository,
  organizationId: string,
  userId: string,
  input: EventInput,
) {
  const contextResult = await loadWriterContext(
    membershipRepo,
    musicianRepo,
    assignmentRepo,
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

  const validationError = validateEventInput(input);
  if (validationError) {
    return Result.fail(validationError);
  }

  const audience = mergeAudienceIds(input, context.myMusicianId);
  const audienceError = validateGroupWriterAudience(context, audience.groupIds, audience.musicianIds);
  if (audienceError) {
    return Result.fail(audienceError);
  }

  try {
    const event = await eventRepo.create(organizationId, {
      ...input,
      createdBy: userId,
      groupIds: audience.groupIds,
      musicianIds: audience.musicianIds,
    });
    return Result.ok(event);
  } catch {
    return Result.fail('create_failed');
  }
}

export async function updateEvent(
  eventRepo: EventRepository,
  membershipRepo: MembershipRepository,
  musicianRepo: MusicianRepository,
  assignmentRepo: AssignmentRepository,
  organizationId: string,
  userId: string,
  eventId: string,
  input: EventInput,
) {
  const contextResult = await loadWriterContext(
    membershipRepo,
    musicianRepo,
    assignmentRepo,
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

  const preservedGroupIds = context.isPrivileged
    ? []
    : existing.groups
        .map((group) => group.id)
        .filter((groupId) => !context.writableGroupIds.includes(groupId));
  const preservedMusicianIds = context.isPrivileged
    ? []
    : existing.musicians
        .map((musician) => musician.id)
        .filter((musicianId) => {
          if (musicianId === context.myMusicianId) {
            return false;
          }
          const groups = context.musicianGroupIdsByMusicianId[musicianId] ?? [];
          return !groups.some((groupId) => context.writableGroupIds.includes(groupId));
        });
  const groupIds = uniqueIds([...preservedGroupIds, ...audience.groupIds]);
  const musicianIds = uniqueIds([...preservedMusicianIds, ...audience.musicianIds]);

  try {
    const event = await eventRepo.update(organizationId, eventId, {
      ...input,
      groupIds,
      musicianIds,
    });
    return Result.ok(event);
  } catch {
    return Result.fail('update_failed');
  }
}

export async function deleteEvent(
  eventRepo: EventRepository,
  membershipRepo: MembershipRepository,
  musicianRepo: MusicianRepository,
  assignmentRepo: AssignmentRepository,
  organizationId: string,
  userId: string,
  eventId: string,
) {
  const contextResult = await loadWriterContext(
    membershipRepo,
    musicianRepo,
    assignmentRepo,
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

  try {
    await eventRepo.delete(organizationId, eventId);
    return Result.ok(undefined);
  } catch {
    return Result.fail('delete_failed');
  }
}

export async function getEventWriterContext(
  membershipRepo: MembershipRepository,
  musicianRepo: MusicianRepository,
  assignmentRepo: AssignmentRepository,
  organizationId: string,
  userId: string,
) {
  return loadWriterContext(membershipRepo, musicianRepo, assignmentRepo, organizationId, userId);
}
