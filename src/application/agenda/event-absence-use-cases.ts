import type { EventAbsenceRepository } from '@/application/ports/event-absence-repository';
import type { AssignmentRepository } from '@/application/ports/assignment-repository';
import type { EventRepository } from '@/application/ports/event-repository';
import type { MembershipRepository } from '@/application/ports/membership-repository';
import type { MusicianRepository } from '@/application/ports/musician-repository';
import type { OrganizationRepository } from '@/application/ports/organization-repository';
import type { EventParticipant } from '@/domain/agenda';
import { canWriteEvent, resolveEventParticipants } from '@/domain/agenda';
import { Result } from '@/domain/shared';

import { getEventWriterContext } from './event-use-cases';

export type EventAbsencesSnapshot = {
  participants: EventParticipant[];
  absentMusicianIds: string[];
};

async function loadEventAbsencesSnapshot(
  eventRepo: EventRepository,
  assignmentRepo: AssignmentRepository,
  absenceRepo: EventAbsenceRepository,
  organizationId: string,
  eventId: string,
): Promise<Result<EventAbsencesSnapshot, 'not_found'>> {
  const event = await eventRepo.getById(organizationId, eventId);
  if (!event) {
    return Result.fail('not_found');
  }

  const groupIds = event.groups.map((group) => group.id);
  const [groupAssignments, absences] = await Promise.all([
    assignmentRepo.listForGroups(organizationId, groupIds),
    absenceRepo.listForEvent(organizationId, eventId),
  ]);

  const musicianIds = [
    ...new Set([
      ...groupAssignments.map((row) => row.musicianId),
      ...event.musicians.map((musician) => musician.id),
    ]),
  ];
  const partNamesByMusicianId = await assignmentRepo.listPartNamesByMusicianIds(
    organizationId,
    musicianIds,
  );

  const groupNameById = new Map(event.groups.map((group) => [group.id, group.name]));

  const participants = resolveEventParticipants({
    groupAssignments: groupAssignments.map((row) => ({
      musicianId: row.musicianId,
      musicianName: row.musicianName,
      groupName: groupNameById.get(row.groupId) ?? '',
    })).filter((row) => row.groupName.length > 0),
    directMusicians: event.musicians,
    partNamesByMusicianId,
  });

  return Result.ok({
    participants,
    absentMusicianIds: absences.map((absence) => absence.musicianId),
  });
}

async function assertCanManageAbsences(
  membershipRepo: MembershipRepository,
  musicianRepo: MusicianRepository,
  assignmentRepo: AssignmentRepository,
  orgRepo: OrganizationRepository,
  eventRepo: EventRepository,
  organizationId: string,
  userId: string,
  eventId: string,
) {
  const contextResult = await getEventWriterContext(
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

  const event = await eventRepo.getById(organizationId, eventId);
  if (!event) {
    return Result.fail('not_found' as const);
  }

  const context = contextResult.value;
  if (
    !canWriteEvent({
      isPrivileged: context.isPrivileged,
      isGroupWriter: context.isGroupWriter,
      userId,
      createdBy: event.createdBy,
      eventGroupIds: event.groups.map((group) => group.id),
      writableGroupIds: context.writableGroupIds,
    })
  ) {
    return Result.fail('not_allowed' as const);
  }

  return Result.ok({ event, context });
}

export async function listEventAbsences(
  eventRepo: EventRepository,
  membershipRepo: MembershipRepository,
  musicianRepo: MusicianRepository,
  assignmentRepo: AssignmentRepository,
  orgRepo: OrganizationRepository,
  absenceRepo: EventAbsenceRepository,
  organizationId: string,
  userId: string,
  eventId: string,
) {
  const accessResult = await assertCanManageAbsences(
    membershipRepo,
    musicianRepo,
    assignmentRepo,
    orgRepo,
    eventRepo,
    organizationId,
    userId,
    eventId,
  );
  if (!accessResult.ok) {
    return accessResult;
  }

  return loadEventAbsencesSnapshot(
    eventRepo,
    assignmentRepo,
    absenceRepo,
    organizationId,
    eventId,
  );
}

export async function toggleEventAbsence(
  eventRepo: EventRepository,
  membershipRepo: MembershipRepository,
  musicianRepo: MusicianRepository,
  assignmentRepo: AssignmentRepository,
  orgRepo: OrganizationRepository,
  absenceRepo: EventAbsenceRepository,
  organizationId: string,
  userId: string,
  eventId: string,
  musicianId: string,
) {
  const accessResult = await assertCanManageAbsences(
    membershipRepo,
    musicianRepo,
    assignmentRepo,
    orgRepo,
    eventRepo,
    organizationId,
    userId,
    eventId,
  );
  if (!accessResult.ok) {
    return accessResult;
  }

  const snapshotResult = await loadEventAbsencesSnapshot(
    eventRepo,
    assignmentRepo,
    absenceRepo,
    organizationId,
    eventId,
  );
  if (!snapshotResult.ok) {
    return snapshotResult;
  }

  const participantIds = new Set(
    snapshotResult.value.participants.map((participant) => participant.musicianId),
  );
  if (!participantIds.has(musicianId)) {
    return Result.fail('invalid_musician' as const);
  }

  const isAbsent = snapshotResult.value.absentMusicianIds.includes(musicianId);

  try {
    if (isAbsent) {
      await absenceRepo.unmarkAbsent(organizationId, eventId, musicianId);
    } else {
      await absenceRepo.markAbsent(organizationId, eventId, musicianId, userId);
    }
  } catch {
    return Result.fail('absence_failed' as const);
  }

  return loadEventAbsencesSnapshot(
    eventRepo,
    assignmentRepo,
    absenceRepo,
    organizationId,
    eventId,
  );
}
