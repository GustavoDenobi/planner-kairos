import type { AssignmentRepository } from '@/application/ports/assignment-repository';
import type { MembershipRepository } from '@/application/ports/membership-repository';
import type { MusicianRepository } from '@/application/ports/musician-repository';
import type { EventInput } from '@/domain/agenda';
import { uniqueIds, validateEventAudienceForGroupWriter } from '@/domain/agenda';
import { isGroupWriterRole } from '@/domain/ensemble';
import { Result } from '@/domain/shared';

export type EventWriterContext = {
  isPrivileged: boolean;
  isGroupWriter: boolean;
  writableGroupIds: string[];
  memberGroupIds: string[];
  myMusicianId: string | null;
  musicianGroupIdsByMusicianId: Record<string, string[]>;
};

export async function loadWriterContext(
  membershipRepo: MembershipRepository,
  musicianRepo: MusicianRepository,
  assignmentRepo: AssignmentRepository,
  organizationId: string,
  userId: string,
): Promise<Result<EventWriterContext, 'not_a_member'>> {
  const membership = await membershipRepo.getByUserAndOrg(organizationId, userId);
  if (!membership) {
    return Result.fail('not_a_member');
  }

  const isPrivileged = membership.accessRole === 'owner' || membership.accessRole === 'admin';
  const musician = await musicianRepo.getByUserId(organizationId, userId);
  const assignments = musician
    ? await assignmentRepo.listForMusician(organizationId, musician.id)
    : [];
  const writableGroupIds = [
    ...new Set(
      assignments
        .filter((assignment) => isGroupWriterRole(assignment.ensembleRole))
        .map((assignment) => assignment.groupId),
    ),
  ];
  const memberGroupIds = [...new Set(assignments.map((assignment) => assignment.groupId))];
  const isGroupWriter = writableGroupIds.length > 0;

  const audienceRows = isGroupWriter
    ? await assignmentRepo.listForGroups(organizationId, writableGroupIds)
    : [];
  const musicianGroupIdsByMusicianId: Record<string, string[]> = {};
  for (const row of audienceRows) {
    const current = musicianGroupIdsByMusicianId[row.musicianId] ?? [];
    current.push(row.groupId);
    musicianGroupIdsByMusicianId[row.musicianId] = current;
  }

  return Result.ok({
    isPrivileged,
    isGroupWriter,
    writableGroupIds,
    memberGroupIds,
    myMusicianId: musician?.id ?? null,
    musicianGroupIdsByMusicianId,
  });
}

export function mergeAudienceIds(
  input: EventInput,
  creatorMusicianId: string | null,
): { groupIds: string[]; musicianIds: string[] } {
  const groupIds = uniqueIds(input.groupIds ?? []);
  const musicianIds = uniqueIds([
    ...(input.musicianIds ?? []),
    ...(creatorMusicianId ? [creatorMusicianId] : []),
  ]);
  return { groupIds, musicianIds };
}

export function validateGroupWriterAudience(
  context: EventWriterContext,
  groupIds: string[],
  musicianIds: string[],
): string | null {
  if (context.isPrivileged) {
    return null;
  }
  return validateEventAudienceForGroupWriter({
    groupIds,
    musicianIds,
    writableGroupIds: context.writableGroupIds,
    musicianGroupIdsByMusicianId: context.musicianGroupIdsByMusicianId,
    creatorMusicianId: context.myMusicianId,
  });
}
