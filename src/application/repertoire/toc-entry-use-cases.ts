import type { PieceFileRepository } from '@/application/ports/piece-file-repository';
import type { PieceFileTocEntryRepository } from '@/application/ports/piece-file-toc-entry-repository';
import type {
  CreatePieceFileTocEntryInput,
  UpdatePieceFileTocEntryInput,
} from '@/domain/repertoire';
import {
  validateCreatePieceFileTocEntryInput,
  validateUpdatePieceFileTocEntryInput,
} from '@/domain/repertoire';
import { Result } from '@/domain/shared';

export async function listPieceFileTocEntries(
  tocRepo: PieceFileTocEntryRepository,
  organizationId: string,
  pieceFileId: string,
) {
  const entries = await tocRepo.listForFile(organizationId, pieceFileId);
  return Result.ok(entries);
}

export async function listPieceTocEntries(
  tocRepo: PieceFileTocEntryRepository,
  organizationId: string,
  pieceId: string,
) {
  const entries = await tocRepo.listForPiece(organizationId, pieceId);
  return Result.ok(entries);
}

export async function createPieceFileTocEntry(
  fileRepo: PieceFileRepository,
  tocRepo: PieceFileTocEntryRepository,
  organizationId: string,
  pieceId: string,
  input: CreatePieceFileTocEntryInput,
) {
  const validationError = validateCreatePieceFileTocEntryInput(input);
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

  try {
    const entry = await tocRepo.create(organizationId, input);
    return Result.ok(entry);
  } catch {
    return Result.fail('create_failed');
  }
}

export async function updatePieceFileTocEntry(
  tocRepo: PieceFileTocEntryRepository,
  organizationId: string,
  pieceFileId: string,
  entryId: string,
  input: UpdatePieceFileTocEntryInput,
) {
  const existing = (await tocRepo.listForFile(organizationId, pieceFileId)).find(
    (item) => item.id === entryId,
  );
  if (!existing) {
    return Result.fail('not_found');
  }

  const validationError = validateUpdatePieceFileTocEntryInput(input, existing);
  if (validationError) {
    return Result.fail(validationError);
  }

  try {
    const updated = await tocRepo.update(organizationId, pieceFileId, entryId, input);
    if (!updated) {
      return Result.fail('update_failed');
    }
    return Result.ok(updated);
  } catch {
    return Result.fail('update_failed');
  }
}

export async function deletePieceFileTocEntry(
  tocRepo: PieceFileTocEntryRepository,
  organizationId: string,
  pieceFileId: string,
  entryId: string,
) {
  try {
    const removed = await tocRepo.remove(organizationId, pieceFileId, entryId);
    if (!removed) {
      return Result.fail('not_found');
    }
    return Result.ok(undefined);
  } catch {
    return Result.fail('delete_failed');
  }
}

export async function reorderPieceFileTocEntries(
  tocRepo: PieceFileTocEntryRepository,
  organizationId: string,
  pieceFileId: string,
  orderedIds: string[],
) {
  const existing = await tocRepo.listForFile(organizationId, pieceFileId);
  if (orderedIds.length !== existing.length) {
    return Result.fail('invalid_order');
  }

  const existingIds = new Set(existing.map((item) => item.id));
  if (!orderedIds.every((id) => existingIds.has(id))) {
    return Result.fail('invalid_order');
  }

  try {
    const reordered = await tocRepo.reorder(organizationId, pieceFileId, orderedIds);
    return Result.ok(reordered);
  } catch {
    return Result.fail('reorder_failed');
  }
}
