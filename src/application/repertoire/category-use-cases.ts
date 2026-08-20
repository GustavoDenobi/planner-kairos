import type { PieceCategoryRepository } from '@/application/ports/piece-category-repository';
import type { PieceCategoryInput } from '@/domain/repertoire';
import { validatePieceCategoryInput } from '@/domain/repertoire';
import { nextSortOrder } from '@/domain/ensemble/sort-order';
import { Result } from '@/domain/shared';

export async function listPieceCategories(
  categoryRepo: PieceCategoryRepository,
  organizationId: string,
) {
  const categories = await categoryRepo.listForOrg(organizationId);
  return Result.ok(categories);
}

export async function createPieceCategory(
  categoryRepo: PieceCategoryRepository,
  organizationId: string,
  input: PieceCategoryInput,
) {
  const validationError = validatePieceCategoryInput(input);
  if (validationError) {
    return Result.fail(validationError);
  }

  try {
    const categories = await categoryRepo.listForOrg(organizationId);
    const category = await categoryRepo.create(organizationId, {
      ...input,
      sortOrder: input.sortOrder ?? nextSortOrder(categories),
    });
    return Result.ok(category);
  } catch (error) {
    if (error instanceof Error && /duplicate|unique/i.test(error.message)) {
      return Result.fail('duplicate_slug');
    }
    return Result.fail('create_failed');
  }
}

export async function updatePieceCategory(
  categoryRepo: PieceCategoryRepository,
  organizationId: string,
  categoryId: string,
  input: PieceCategoryInput,
) {
  const validationError = validatePieceCategoryInput(input);
  if (validationError) {
    return Result.fail(validationError);
  }

  try {
    const category = await categoryRepo.update(organizationId, categoryId, input);
    return Result.ok(category);
  } catch (error) {
    if (error instanceof Error && /duplicate|unique/i.test(error.message)) {
      return Result.fail('duplicate_slug');
    }
    return Result.fail('update_failed');
  }
}

export async function deletePieceCategory(
  categoryRepo: PieceCategoryRepository,
  organizationId: string,
  categoryId: string,
) {
  const count = await categoryRepo.countPiecesUsingCategory(organizationId, categoryId);
  if (count > 0) {
    return Result.fail('category_in_use');
  }

  try {
    await categoryRepo.delete(organizationId, categoryId);
    return Result.ok(undefined);
  } catch {
    return Result.fail('delete_failed');
  }
}

export async function reorderPieceCategories(
  categoryRepo: PieceCategoryRepository,
  organizationId: string,
  orderedCategoryIds: string[],
) {
  if (orderedCategoryIds.length === 0) {
    return Result.ok(undefined);
  }

  try {
    await categoryRepo.reorderCategories(organizationId, orderedCategoryIds);
    return Result.ok(undefined);
  } catch {
    return Result.fail('reorder_failed');
  }
}
