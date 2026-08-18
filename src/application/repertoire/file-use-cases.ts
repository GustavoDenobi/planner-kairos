import type { FileStorage } from '@/application/ports/file-storage';
import type { PartRepository } from '@/application/ports/part-repository';
import type { PieceFileRepository } from '@/application/ports/piece-file-repository';
import type { PieceRepository } from '@/application/ports/piece-repository';
import type { PieceFilePartLink } from '@/domain/repertoire';
import {
  defaultPieceFileTitle,
  mimeToPieceFileKind,
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

  const mimeError = validatePieceFileMime(input.file.type);
  if (mimeError) {
    return Result.fail(mimeError);
  }

  const kind = mimeToPieceFileKind(input.file.type);
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
    );

    const pieceFile = await fileRepo.create(organizationId, {
      pieceId: input.pieceId,
      kind,
      storageKey,
      mimeType: input.file.type,
      title,
      originalName: input.file.name,
      byteSize: input.file.size,
      contentHash,
      partLinks,
    });

    return Result.ok(pieceFile);
  } catch {
    return Result.fail('upload_failed');
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
    if (existing.kind !== 'score') {
      return Result.fail('invalid_part_link');
    }

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
