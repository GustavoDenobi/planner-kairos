import type { SectionRepository } from '@/application/ports/section-repository';
import type { SectionInput } from '@/domain/ensemble';
import { nextSortOrder } from '@/domain/ensemble/sort-order';
import { validateSectionInput } from '@/domain/ensemble';
import { Result } from '@/domain/shared';
export async function listSections(
  sectionRepo: SectionRepository,
  organizationId: string,
  groupId: string,
) {
  const sections = await sectionRepo.listForGroup(organizationId, groupId);
  return Result.ok(sections);
}

export async function registerSection(
  sectionRepo: SectionRepository,
  organizationId: string,
  groupId: string,
  input: SectionInput,
) {
  const validationError = validateSectionInput(input);
  if (validationError) {
    return Result.fail(validationError);
  }

  try {
    const sections = await sectionRepo.listForGroup(organizationId, groupId);
    const section = await sectionRepo.create(organizationId, groupId, {
      name: input.name.trim(),
      sortOrder: input.sortOrder ?? nextSortOrder(sections),
      notes: input.notes?.trim() || null,
    });

    if (input.partIds) {
      await sectionRepo.setSectionParts(organizationId, section.id, input.partIds);
    }

    return Result.ok(section);
  } catch {
    return Result.fail('create_failed');
  }
}

export async function updateSection(
  sectionRepo: SectionRepository,
  organizationId: string,
  sectionId: string,
  input: SectionInput,
) {
  const validationError = validateSectionInput(input);
  if (validationError) {
    return Result.fail(validationError);
  }

  try {
    const section = await sectionRepo.update(organizationId, sectionId, {
      name: input.name.trim(),
      sortOrder: input.sortOrder,
      notes: input.notes?.trim() || null,
    });

    if (input.partIds) {
      await sectionRepo.setSectionParts(organizationId, sectionId, input.partIds);
    }

    return Result.ok(section);
  } catch {
    return Result.fail('update_failed');
  }
}

export async function removeSection(
  sectionRepo: SectionRepository,
  organizationId: string,
  sectionId: string,
) {
  try {
    await sectionRepo.remove(organizationId, sectionId);
    return Result.ok(undefined);
  } catch {
    return Result.fail('delete_failed');
  }
}

export async function listSectionPartIds(
  sectionRepo: SectionRepository,
  organizationId: string,
  sectionId: string,
) {
  const partIds = await sectionRepo.listPartIdsForSection(organizationId, sectionId);
  return Result.ok(partIds);
}

export async function listSectionPartIdsByGroup(
  sectionRepo: SectionRepository,
  organizationId: string,
  groupId: string,
) {
  const partIdsBySection = await sectionRepo.listPartIdsByGroup(organizationId, groupId);
  return Result.ok(partIdsBySection);
}

export async function reorderSections(
  sectionRepo: SectionRepository,
  organizationId: string,
  groupId: string,
  orderedSectionIds: string[],
) {
  if (orderedSectionIds.length === 0) {
    return Result.ok(undefined);
  }

  try {
    await sectionRepo.reorderSections(organizationId, groupId, orderedSectionIds);
    return Result.ok(undefined);
  } catch {
    return Result.fail('reorder_failed');
  }
}