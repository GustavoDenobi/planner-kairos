import type { AnnotationSetRepository } from '@/application/ports/annotation-set-repository';
import type { AssignmentRepository } from '@/application/ports/assignment-repository';
import type { MembershipRepository } from '@/application/ports/membership-repository';
import type { MusicianRepository } from '@/application/ports/musician-repository';
import type { OrganizationRepository } from '@/application/ports/organization-repository';
import type { PieceFileRepository } from '@/application/ports/piece-file-repository';
import type { CreateAnnotationSetInput, UpdateAnnotationSetInput } from '@/domain/repertoire';
import {
  validateCreateAnnotationSetInput,
  validateDirectedAnnotationAudience,
  validateUpdateAnnotationSetInput,
} from '@/domain/repertoire';
import { uniqueIds } from '@/domain/agenda';
import { Result } from '@/domain/shared';
import { loadWriterContext } from '@/application/agenda/event-use-cases-helpers';

async function validateAudienceForWriter(
  membershipRepo: MembershipRepository,
  musicianRepo: MusicianRepository,
  assignmentRepo: AssignmentRepository,
  orgRepo: OrganizationRepository,
  organizationId: string,
  userId: string,
  groupIds: string[],
  musicianIds: string[],
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
    return Result.fail('not_allowed' as const);
  }

  if (context.isPrivileged) {
    return Result.ok(context);
  }

  const audienceError = validateDirectedAnnotationAudience({
    groupIds,
    musicianIds,
    writableGroupIds: context.writableGroupIds,
    musicianGroupIdsByMusicianId: context.musicianGroupIdsByMusicianId,
    creatorMusicianId: context.myMusicianId,
  });
  if (audienceError) {
    return Result.fail(audienceError);
  }

  return Result.ok(context);
}

export async function listAnnotationSetsForFile(
  setRepo: AnnotationSetRepository,
  organizationId: string,
  pieceFileId: string,
) {
  const sets = await setRepo.listForFile(organizationId, pieceFileId);
  return Result.ok(sets);
}

export async function createAnnotationSet(
  fileRepo: PieceFileRepository,
  setRepo: AnnotationSetRepository,
  membershipRepo: MembershipRepository,
  musicianRepo: MusicianRepository,
  assignmentRepo: AssignmentRepository,
  orgRepo: OrganizationRepository,
  organizationId: string,
  pieceId: string,
  authorUserId: string,
  input: CreateAnnotationSetInput,
) {
  const validationError = validateCreateAnnotationSetInput(input);
  if (validationError) {
    return Result.fail(validationError);
  }

  const file = await fileRepo.getById(organizationId, pieceId, input.pieceFileId);
  if (!file) {
    return Result.fail('not_found');
  }

  if (file.kind !== 'score') {
    return Result.fail('invalid_file_kind');
  }

  const audienceResult = await validateAudienceForWriter(
    membershipRepo,
    musicianRepo,
    assignmentRepo,
    orgRepo,
    organizationId,
    authorUserId,
    input.groupIds,
    input.musicianIds,
  );
  if (!audienceResult.ok) {
    return audienceResult;
  }

  try {
    const set = await setRepo.create(organizationId, authorUserId, {
      ...input,
      groupIds: uniqueIds(input.groupIds),
      musicianIds: uniqueIds(input.musicianIds),
    });
    return Result.ok(set);
  } catch {
    return Result.fail('create_failed');
  }
}

export async function updateAnnotationSet(
  setRepo: AnnotationSetRepository,
  membershipRepo: MembershipRepository,
  musicianRepo: MusicianRepository,
  assignmentRepo: AssignmentRepository,
  orgRepo: OrganizationRepository,
  organizationId: string,
  userId: string,
  setId: string,
  input: UpdateAnnotationSetInput,
) {
  const validationError = validateUpdateAnnotationSetInput(input);
  if (validationError) {
    return Result.fail(validationError);
  }

  const existing = await setRepo.getById(organizationId, setId);
  if (!existing) {
    return Result.fail('not_found');
  }

  const nextGroupIds = input.groupIds ?? existing.groups.map((group) => group.id);
  const nextMusicianIds = input.musicianIds ?? existing.musicians.map((musician) => musician.id);

  const audienceResult = await validateAudienceForWriter(
    membershipRepo,
    musicianRepo,
    assignmentRepo,
    orgRepo,
    organizationId,
    userId,
    nextGroupIds,
    nextMusicianIds,
  );
  if (!audienceResult.ok) {
    return audienceResult;
  }

  const context = audienceResult.value;
  let groupIds = uniqueIds(nextGroupIds);
  let musicianIds = uniqueIds(nextMusicianIds);

  if (!context.isPrivileged && (input.groupIds !== undefined || input.musicianIds !== undefined)) {
    const preservedGroupIds = existing.groups
      .map((group) => group.id)
      .filter((groupId) => !context.writableGroupIds.includes(groupId));
    const preservedMusicianIds = existing.musicians
      .map((musician) => musician.id)
      .filter((musicianId) => {
        if (musicianId === context.myMusicianId) {
          return false;
        }
        const groups = context.musicianGroupIdsByMusicianId[musicianId] ?? [];
        return !groups.some((groupId) => context.writableGroupIds.includes(groupId));
      });
    groupIds = uniqueIds([...preservedGroupIds, ...(input.groupIds ?? [])]);
    musicianIds = uniqueIds([...preservedMusicianIds, ...(input.musicianIds ?? [])]);
  }

  try {
    const updated = await setRepo.update(organizationId, setId, {
      ...input,
      groupIds,
      musicianIds,
    });
    if (!updated) {
      return Result.fail('update_failed');
    }
    return Result.ok(updated);
  } catch {
    return Result.fail('update_failed');
  }
}

export async function deleteAnnotationSet(
  setRepo: AnnotationSetRepository,
  organizationId: string,
  setId: string,
) {
  const removed = await setRepo.remove(organizationId, setId);
  if (!removed) {
    return Result.fail('delete_failed');
  }
  return Result.ok(undefined);
}
