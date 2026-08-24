import type { PieceFileNavigationShortcutRepository } from '@/application/ports/piece-file-navigation-shortcut-repository';
import type { PieceFileRepository } from '@/application/ports/piece-file-repository';
import type {
  CreatePdfNavigationShortcutInput,
  UpdatePdfNavigationShortcutInput,
} from '@/domain/repertoire';
import {
  pickNavigationShortcutColor,
  validateCreatePdfNavigationShortcutInput,
  validateUpdatePdfNavigationShortcutInput,
} from '@/domain/repertoire';
import { Result } from '@/domain/shared';

export async function listPieceFileNavigationShortcuts(
  shortcutRepo: PieceFileNavigationShortcutRepository,
  organizationId: string,
  pieceFileId: string,
) {
  const shortcuts = await shortcutRepo.listForFile(organizationId, pieceFileId);
  return Result.ok(shortcuts);
}

export async function createPieceFileNavigationShortcut(
  fileRepo: PieceFileRepository,
  shortcutRepo: PieceFileNavigationShortcutRepository,
  organizationId: string,
  pieceId: string,
  authorUserId: string,
  input: CreatePdfNavigationShortcutInput,
) {
  const validationError = validateCreatePdfNavigationShortcutInput(input);
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
    const existing = await shortcutRepo.listForFile(organizationId, input.pieceFileId);
    const color =
      input.color?.trim()
      || pickNavigationShortcutColor(existing.map((item) => item.color));
    const shortcut = await shortcutRepo.create(organizationId, authorUserId, {
      ...input,
      color,
    });
    return Result.ok(shortcut);
  } catch {
    return Result.fail('create_failed');
  }
}

export async function updatePieceFileNavigationShortcut(
  shortcutRepo: PieceFileNavigationShortcutRepository,
  organizationId: string,
  pieceFileId: string,
  shortcutId: string,
  input: UpdatePdfNavigationShortcutInput,
) {
  const existing = (await shortcutRepo.listForFile(organizationId, pieceFileId)).find(
    (item) => item.id === shortcutId,
  );
  if (!existing) {
    return Result.fail('not_found');
  }

  const validationError = validateUpdatePdfNavigationShortcutInput(input, existing);
  if (validationError) {
    return Result.fail(validationError);
  }

  try {
    const updated = await shortcutRepo.update(organizationId, pieceFileId, shortcutId, input);
    if (!updated) {
      return Result.fail('not_found');
    }
    return Result.ok(updated);
  } catch {
    return Result.fail('update_failed');
  }
}

export async function deletePieceFileNavigationShortcut(
  shortcutRepo: PieceFileNavigationShortcutRepository,
  organizationId: string,
  pieceFileId: string,
  shortcutId: string,
) {
  try {
    const removed = await shortcutRepo.remove(organizationId, pieceFileId, shortcutId);
    if (!removed) {
      return Result.fail('not_found');
    }
    return Result.ok(undefined);
  } catch {
    return Result.fail('delete_failed');
  }
}

export async function reorderPieceFileNavigationShortcuts(
  shortcutRepo: PieceFileNavigationShortcutRepository,
  organizationId: string,
  pieceFileId: string,
  orderedIds: string[],
) {
  if (orderedIds.length === 0) {
    return Result.ok([] as import('@/domain/repertoire').PdfNavigationShortcut[]);
  }

  const existing = await shortcutRepo.listForFile(organizationId, pieceFileId);
  if (existing.length !== orderedIds.length) {
    return Result.fail('invalid_reorder');
  }

  const existingIds = new Set(existing.map((item) => item.id));
  for (const id of orderedIds) {
    if (!existingIds.has(id)) {
      return Result.fail('invalid_reorder');
    }
  }

  try {
    const reordered = await shortcutRepo.reorder(organizationId, pieceFileId, orderedIds);
    return Result.ok(reordered);
  } catch {
    return Result.fail('reorder_failed');
  }
}
