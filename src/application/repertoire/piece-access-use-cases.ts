import type { GroupRepository, GroupFileAccessInput } from '@/application/ports/group-repository';
import type { PieceAccessRepository } from '@/application/ports/piece-access-repository';
import type { PieceRepository } from '@/application/ports/piece-repository';
import type { PieceAccessInput } from '@/domain/repertoire';
import { pieceHasNoAudience } from '@/domain/repertoire';
import { REPERTOIRE_UNLINKED_FILTER } from '@/domain/repertoire/repertoire-filters';
import { Result } from '@/domain/shared';

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

export async function updateGroupFileAccessSettings(
  groupRepo: GroupRepository,
  organizationId: string,
  groupId: string,
  input: GroupFileAccessInput,
) {
  try {
    const group = await groupRepo.updateFileAccessSettings(organizationId, groupId, input);
    return Result.ok(group);
  } catch {
    return Result.fail('update_failed');
  }
}

export async function updatePieceAccess(
  pieceRepo: PieceRepository,
  accessRepo: PieceAccessRepository,
  organizationId: string,
  pieceId: string,
  input: PieceAccessInput,
) {
  const existing = await pieceRepo.getById(organizationId, pieceId);
  if (!existing) {
    return Result.fail('not_found');
  }

  const groupIds = uniqueIds(input.groupIds ?? []);
  const musicianIds = uniqueIds(input.musicianIds ?? []);

  try {
    await accessRepo.replaceAudience(organizationId, pieceId, groupIds, musicianIds);
    await accessRepo.updateAccessSettings(organizationId, pieceId, {
      fileAccessScope: input.fileAccessScope,
      allowFileDownload: input.allowFileDownload,
      audioAccessScope: input.audioAccessScope,
      audioAllowDownload: input.audioAllowDownload,
    });
  } catch {
    return Result.fail('update_failed');
  }

  const piece = await pieceRepo.getById(organizationId, pieceId);
  if (!piece) {
    return Result.fail('not_found');
  }

  return Result.ok(piece);
}

export function shouldWarnEmptyPieceAudience(
  isAdmin: boolean,
  groupIds: string[],
  musicianIds: string[],
): boolean {
  return isAdmin && pieceHasNoAudience(groupIds, musicianIds);
}

export async function listPieceCategoryIdsByGroup(
  accessRepo: PieceAccessRepository,
  organizationId: string,
) {
  const [categoryIdsByGroup, unlinkedCategoryIds] = await Promise.all([
    accessRepo.listCategoryIdsByGroup(organizationId),
    accessRepo.listUnlinkedCategoryIds(organizationId),
  ]);

  const record = Object.fromEntries(categoryIdsByGroup);
  record[REPERTOIRE_UNLINKED_FILTER] = unlinkedCategoryIds;
  return Result.ok(record);
}
