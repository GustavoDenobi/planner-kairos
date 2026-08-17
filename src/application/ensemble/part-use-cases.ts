import type { PartRepository } from '@/application/ports/part-repository';
import type { PartDivisionInput, PartInput } from '@/domain/ensemble';
import { nextSortOrder } from '@/domain/ensemble/sort-order';
import { validatePartDivisionInput, validatePartInput } from '@/domain/ensemble';
import { Result } from '@/domain/shared';
export async function listParts(partRepo: PartRepository, organizationId: string) {
  const parts = await partRepo.listForOrg(organizationId);
  return Result.ok(parts);
}

export async function getPart(
  partRepo: PartRepository,
  organizationId: string,
  partId: string,
) {
  const part = await partRepo.getById(organizationId, partId);
  if (!part) {
    return Result.fail('not_found');
  }
  return Result.ok(part);
}

export async function registerPart(
  partRepo: PartRepository,
  organizationId: string,
  input: PartInput,
) {
  const validationError = validatePartInput(input);
  if (validationError) {
    return Result.fail(validationError);
  }

  try {
    const parts = await partRepo.listForOrg(organizationId);
    const part = await partRepo.create(organizationId, {
      name: input.name.trim(),
      kind: input.kind,
      sortOrder: input.sortOrder ?? nextSortOrder(parts),
    });    return Result.ok(part);
  } catch (error) {
    if (error instanceof Error && /duplicate|unique/i.test(error.message)) {
      return Result.fail('duplicate_name');
    }
    return Result.fail('create_failed');
  }
}

export async function updatePart(
  partRepo: PartRepository,
  organizationId: string,
  partId: string,
  input: PartInput,
) {
  const validationError = validatePartInput(input);
  if (validationError) {
    return Result.fail(validationError);
  }

  try {
    const part = await partRepo.update(organizationId, partId, {
      name: input.name.trim(),
      kind: input.kind,
      sortOrder: input.sortOrder,
    });    return Result.ok(part);
  } catch (error) {
    if (error instanceof Error && /duplicate|unique/i.test(error.message)) {
      return Result.fail('duplicate_name');
    }
    return Result.fail('update_failed');
  }
}

export async function registerPartDivision(
  partRepo: PartRepository,
  organizationId: string,
  partId: string,
  input: PartDivisionInput,
) {
  const validationError = validatePartDivisionInput(input);
  if (validationError) {
    return Result.fail(validationError);
  }

  try {
    const division = await partRepo.addDivision(organizationId, partId, {
      name: input.name.trim(),
    });    return Result.ok(division);
  } catch {
    return Result.fail('create_failed');
  }
}

export async function updatePartDivision(
  partRepo: PartRepository,
  organizationId: string,
  divisionId: string,
  input: PartDivisionInput,
) {
  const validationError = validatePartDivisionInput(input);
  if (validationError) {
    return Result.fail(validationError);
  }

  try {
    const division = await partRepo.updateDivision(organizationId, divisionId, {
      name: input.name.trim(),
      sortOrder: input.sortOrder,
    });    return Result.ok(division);
  } catch (error) {
    if (error instanceof Error && /duplicate|unique/i.test(error.message)) {
      return Result.fail('duplicate_name');
    }
    return Result.fail('update_failed');
  }
}

export async function removePartDivision(
  partRepo: PartRepository,
  organizationId: string,
  divisionId: string,
) {
  try {
    await partRepo.removeDivision(organizationId, divisionId);
    return Result.ok(undefined);
  } catch {
    return Result.fail('delete_failed');
  }
}

export async function reorderParts(
  partRepo: PartRepository,
  organizationId: string,
  orderedPartIds: string[],
) {
  if (orderedPartIds.length === 0) {
    return Result.ok(undefined);
  }

  try {
    await partRepo.reorderParts(organizationId, orderedPartIds);
    return Result.ok(undefined);
  } catch {
    return Result.fail('reorder_failed');
  }
}