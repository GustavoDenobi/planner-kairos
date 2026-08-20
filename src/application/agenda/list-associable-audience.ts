import type { AssignmentRepository } from '@/application/ports/assignment-repository';
import type { GroupRepository } from '@/application/ports/group-repository';
import type { MembershipRepository } from '@/application/ports/membership-repository';
import type { MusicianRepository } from '@/application/ports/musician-repository';
import type { GroupKind } from '@/domain/ensemble';
import { Result } from '@/domain/shared';
import { getEventWriterContext } from './event-use-cases';

export type AssociableAudienceItem = {
  id: string;
  name: string;
};

export type AssociableAudienceGroup = AssociableAudienceItem & {
  kind: GroupKind;
};

export type AssociableAudienceMusician = AssociableAudienceItem & {
  partNames: string[];
};

export type AssociableAudience = {
  groups: AssociableAudienceGroup[];
  filterGroups: AssociableAudienceGroup[];
  musicians: AssociableAudienceMusician[];
  myMusicianId: string | null;
  writableGroupIds: string[];
  canCreateEvents: boolean;
  isPrivileged: boolean;
  isGroupWriter: boolean;
  memberGroupIds: string[];
};

function attachPartNames(
  musicians: AssociableAudienceItem[],
  partNamesByMusician: Map<string, string[]>,
): AssociableAudienceMusician[] {
  return musicians.map((musician) => ({
    ...musician,
    partNames: partNamesByMusician.get(musician.id) ?? [],
  }));
}

async function musiciansWithParts(
  assignmentRepo: AssignmentRepository,
  organizationId: string,
  musicians: AssociableAudienceItem[],
) {
  const partNamesByMusician = await assignmentRepo.listPartNamesByMusicianIds(
    organizationId,
    musicians.map((musician) => musician.id),
  );
  return attachPartNames(musicians, partNamesByMusician);
}

export async function listAssociableAudience(
  membershipRepo: MembershipRepository,
  musicianRepo: MusicianRepository,
  assignmentRepo: AssignmentRepository,
  groupRepo: GroupRepository,
  organizationId: string,
  userId: string,
) {
  const contextResult = await getEventWriterContext(
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
  const canCreateEvents = context.isPrivileged || context.isGroupWriter;
  const allGroups = await groupRepo.listForOrg(organizationId);
  const toAudienceGroup = (group: { id: string; name: string; kind: GroupKind }): AssociableAudienceGroup => ({
    id: group.id,
    name: group.name,
    kind: group.kind,
  });
  const filterGroups = context.isPrivileged
    ? allGroups.map(toAudienceGroup)
    : allGroups.filter((group) => context.memberGroupIds.includes(group.id)).map(toAudienceGroup);

  if (context.isPrivileged) {
    const musicians = await musicianRepo.listNamesForOrg(organizationId);
    return Result.ok({
      groups: allGroups.map(toAudienceGroup),
      filterGroups,
      musicians: await musiciansWithParts(
        assignmentRepo,
        organizationId,
        musicians.map((musician) => ({ id: musician.id, name: musician.fullName })),
      ),
      myMusicianId: context.myMusicianId,
      writableGroupIds: context.writableGroupIds,
      canCreateEvents,
      isPrivileged: true,
      isGroupWriter: context.isGroupWriter,
      memberGroupIds: context.memberGroupIds,
    } satisfies AssociableAudience);
  }

  if (!context.isGroupWriter) {
    return Result.ok({
      groups: filterGroups,
      filterGroups,
      musicians: [],
      myMusicianId: context.myMusicianId,
      writableGroupIds: [],
      canCreateEvents: false,
      isPrivileged: false,
      isGroupWriter: false,
      memberGroupIds: context.memberGroupIds,
    } satisfies AssociableAudience);
  }

  const audienceRows = await assignmentRepo.listForGroups(
    organizationId,
    context.writableGroupIds,
  );
  const writableGroups = allGroups.filter((group) =>
    context.writableGroupIds.includes(group.id),
  );
  const musiciansById = new Map<string, string>();
  for (const row of audienceRows) {
    musiciansById.set(row.musicianId, row.musicianName);
  }

  return Result.ok({
    groups: writableGroups.map(toAudienceGroup),
    filterGroups,
    musicians: await musiciansWithParts(
      assignmentRepo,
      organizationId,
      [...musiciansById.entries()]
        .map(([id, name]) => ({ id, name }))
        .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR')),
    ),
    myMusicianId: context.myMusicianId,
    writableGroupIds: context.writableGroupIds,
    canCreateEvents,
    isPrivileged: false,
    isGroupWriter: true,
    memberGroupIds: context.memberGroupIds,
  } satisfies AssociableAudience);
}
