import type { FileStorage } from '@/application/ports/file-storage';
import type { MembershipRepository } from '@/application/ports/membership-repository';
import type { OrganizationRepository } from '@/application/ports/organization-repository';
import type { PartRepository } from '@/application/ports/part-repository';
import type { PieceFileRepository } from '@/application/ports/piece-file-repository';
import type { PieceRepository } from '@/application/ports/piece-repository';
import type { PieceFilePartLink } from '@/domain/repertoire';
import {
  defaultPieceFileTitle,
  mimeToPieceFileKind,
  resolvePieceFileMime,
  validatePieceFileMime,
  validatePieceFilePartLinks,
  validatePieceFileTitle,
} from '@/domain/repertoire';
import { computeFileSha256Hex, Result } from '@/domain/shared';

export type AttachPieceFileInput = {
  pieceId: string;
  file: File;
  title?: string;
  partLinks?: PieceFilePartLink[];
  contentHash?: string;
};

export type UpdatePieceFileInput = {
  title: string;
  partLinks?: PieceFilePartLink[];
  sortOrder?: number;
};

export async function attachPieceFile(
  pieceRepo: PieceRepository,
  fileRepo: PieceFileRepository,
  partRepo: PartRepository,
  fileStorage: FileStorage,
  organizationId: string,
  input: AttachPieceFileInput,
) {
  const piece = await pieceRepo.getById(organizationId, input.pieceId);
  if (!piece) {
    return Result.fail('not_found');
  }

  const mimeType = resolvePieceFileMime(input.file);
  if (!mimeType) {
    return Result.fail('invalid_mime_type');
  }

  const mimeError = validatePieceFileMime(mimeType);
  if (mimeError) {
    return Result.fail(mimeError);
  }

  const kind = mimeToPieceFileKind(mimeType);
  if (!kind) {
    return Result.fail('invalid_mime_type');
  }

  const partLinks = input.partLinks ?? [];
  const parts = await partRepo.listForOrg(organizationId);
  const divisionPartIds = new Map<string, string>();
  for (const part of parts) {
    for (const division of part.divisions) {
      divisionPartIds.set(division.id, part.id);
    }
  }

  const linksError = validatePieceFilePartLinks(partLinks, divisionPartIds);
  if (linksError) {
    return Result.fail(linksError);
  }

  const fileId = crypto.randomUUID();
  const title = (input.title?.trim() || defaultPieceFileTitle(input.file.name)).trim();
  const titleError = validatePieceFileTitle(title);
  if (titleError) {
    return Result.fail(titleError);
  }

  const contentHash = input.contentHash ?? (await computeFileSha256Hex(input.file));

  try {
    const storageKey = await fileStorage.uploadPieceFile(
      organizationId,
      input.pieceId,
      fileId,
      input.file,
      mimeType,
    );

    const pieceFile = await fileRepo.create(organizationId, {
      id: fileId,
      pieceId: input.pieceId,
      kind,
      storageKey,
      mimeType,
      title,
      originalName: input.file.name,
      byteSize: input.file.size,
      contentHash,
      partLinks,
    });

    return Result.ok(pieceFile);
  } catch (error) {
    const detail = error instanceof Error ? error.message.trim() : '';
    return Result.fail(detail ? `upload_failed:${detail}` : 'upload_failed');
  }
}

export async function updatePieceFile(
  pieceRepo: PieceRepository,
  fileRepo: PieceFileRepository,
  partRepo: PartRepository,
  organizationId: string,
  pieceId: string,
  fileId: string,
  input: UpdatePieceFileInput,
) {
  const piece = await pieceRepo.getById(organizationId, pieceId);
  if (!piece) {
    return Result.fail('not_found');
  }

  const existing = await fileRepo.getById(organizationId, pieceId, fileId);
  if (!existing) {
    return Result.fail('not_found');
  }

  const title = input.title.trim();
  const titleError = validatePieceFileTitle(title);
  if (titleError) {
    return Result.fail(titleError);
  }

  if (input.partLinks !== undefined) {
    const parts = await partRepo.listForOrg(organizationId);
    const divisionPartIds = new Map<string, string>();
    for (const part of parts) {
      for (const division of part.divisions) {
        divisionPartIds.set(division.id, part.id);
      }
    }

    const linksError = validatePieceFilePartLinks(input.partLinks, divisionPartIds);
    if (linksError) {
      return Result.fail(linksError);
    }
  }

  const updated = await fileRepo.update(organizationId, pieceId, fileId, {
    title,
    partLinks: input.partLinks,
  });
  if (!updated) {
    return Result.fail('not_found');
  }

  return Result.ok(updated);
}

export async function removePieceFile(
  pieceRepo: PieceRepository,
  fileRepo: PieceFileRepository,
  fileStorage: FileStorage,
  organizationId: string,
  pieceId: string,
  fileId: string,
) {
  const piece = await pieceRepo.getById(organizationId, pieceId);
  if (!piece) {
    return Result.fail('not_found');
  }

  try {
    const removed = await fileRepo.remove(organizationId, pieceId, fileId);
    if (!removed) {
      return Result.fail('not_found');
    }

    await fileStorage.remove(removed.storageKey);
    return Result.ok(undefined);
  } catch {
    return Result.fail('delete_failed');
  }
}

export type PieceAdminDownloadFile = {
  fileId: string;
  filename: string;
  url: string;
};

async function assertOrgAdminAccess(
  membershipRepo: MembershipRepository,
  orgRepo: OrganizationRepository,
  organizationId: string,
  userId: string,
): Promise<Result<void, 'not_a_member' | 'not_allowed'>> {
  const [membership, isPlatformAdmin] = await Promise.all([
    membershipRepo.getByUserAndOrg(organizationId, userId),
    orgRepo.isPlatformAdmin(userId),
  ]);

  if (!membership && !isPlatformAdmin) {
    return Result.fail('not_a_member');
  }

  const isPrivileged =
    isPlatformAdmin || membership?.accessRole === 'owner' || membership?.accessRole === 'admin';

  if (!isPrivileged) {
    return Result.fail('not_allowed');
  }

  return Result.ok(undefined);
}

export async function preparePieceAdminDownload(
  pieceRepo: PieceRepository,
  fileStorage: FileStorage,
  membershipRepo: MembershipRepository,
  orgRepo: OrganizationRepository,
  organizationId: string,
  pieceId: string,
  userId: string,
) {
  const access = await assertOrgAdminAccess(membershipRepo, orgRepo, organizationId, userId);
  if (!access.ok) {
    return access;
  }

  const piece = await pieceRepo.getById(organizationId, pieceId);
  if (!piece) {
    return Result.fail('not_found');
  }

  const files: PieceAdminDownloadFile[] = [];

  for (const file of piece.files) {
    try {
      const url = await fileStorage.getSignedUrl(file.storageKey);
      files.push({
        fileId: file.id,
        filename: file.originalName || file.title,
        url,
      });
    } catch {
      return Result.fail('signed_url_failed');
    }
  }

  return Result.ok({ pieceTitle: piece.title, files });
}

export async function getPieceFileDownloadUrl(
  pieceRepo: PieceRepository,
  fileRepo: PieceFileRepository,
  fileStorage: FileStorage,
  organizationId: string,
  pieceId: string,
  fileId: string,
) {
  const piece = await pieceRepo.getById(organizationId, pieceId);
  if (!piece) {
    return Result.fail('not_found');
  }

  const file = await fileRepo.getById(organizationId, pieceId, fileId);
  if (!file) {
    return Result.fail('not_found');
  }

  try {
    const url = await fileStorage.getSignedUrl(file.storageKey);
    return Result.ok(url);
  } catch {
    return Result.fail('signed_url_failed');
  }
}

export async function reorderPieceScoreFiles(
  pieceRepo: PieceRepository,
  fileRepo: PieceFileRepository,
  organizationId: string,
  pieceId: string,
  orderedFileIds: string[],
) {
  const piece = await pieceRepo.getById(organizationId, pieceId);
  if (!piece) {
    return Result.fail('not_found');
  }

  if (piece.fileOrganization !== 'sequential') {
    return Result.fail('invalid_file_organization');
  }

  const scoreIds = new Set(
    piece.files.filter((file) => file.kind === 'score').map((file) => file.id),
  );

  if (
    orderedFileIds.length !== scoreIds.size ||
    orderedFileIds.some((fileId) => !scoreIds.has(fileId))
  ) {
    return Result.fail('invalid_order');
  }

  try {
    const files = await fileRepo.reorderScores(organizationId, pieceId, orderedFileIds);
    return Result.ok(files);
  } catch {
    return Result.fail('reorder_failed');
  }
}
