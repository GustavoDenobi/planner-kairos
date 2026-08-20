import type { AssignmentRepository } from '@/application/ports/assignment-repository';
import type { SectionRepository } from '@/application/ports/section-repository';
import type { AssignmentInput } from '@/domain/ensemble';
import { validateAssignmentInput } from '@/domain/ensemble';
import { Result } from '@/domain/shared';

export async function listAssignmentsForMusician(
  assignmentRepo: AssignmentRepository,
  organizationId: string,
  musicianId: string,
) {
  const assignments = await assignmentRepo.listForMusician(organizationId, musicianId);
  return Result.ok(assignments);
}

export async function listAssignmentsForGroup(
  assignmentRepo: AssignmentRepository,
  organizationId: string,
  groupId: string,
) {
  const assignments = await assignmentRepo.listForGroup(organizationId, groupId);
  return Result.ok(assignments);
}

export async function assignMusician(
  assignmentRepo: AssignmentRepository,
  sectionRepo: SectionRepository,
  organizationId: string,
  musicianId: string,
  input: AssignmentInput,
) {
  const section = input.sectionId
    ? await sectionRepo.getById(organizationId, input.sectionId)
    : null;

  if (input.sectionId && !section) {
    return Result.fail('section_not_found');
  }

  const sectionPartIds = input.sectionId
    ? await sectionRepo.listPartIdsForSection(organizationId, input.sectionId)
    : null;

  const validationError = validateAssignmentInput(input, section, sectionPartIds);
  if (validationError) {
    return Result.fail(validationError);
  }

  try {
    const assignment = await assignmentRepo.create(organizationId, musicianId, {
      groupId: input.groupId,
      sectionId: input.sectionId ?? null,
      partId: input.partId ?? null,
      ensembleRole: input.ensembleRole,
    });
    return Result.ok(assignment);
  } catch (error) {
    if (error instanceof Error && error.message.includes('duplicate')) {
      return Result.fail('duplicate_assignment');
    }
    return Result.fail('create_failed');
  }
}

export async function updateAssignment(
  assignmentRepo: AssignmentRepository,
  sectionRepo: SectionRepository,
  organizationId: string,
  assignmentId: string,
  input: AssignmentInput,
) {
  const section = input.sectionId
    ? await sectionRepo.getById(organizationId, input.sectionId)
    : null;

  if (input.sectionId && !section) {
    return Result.fail('section_not_found');
  }

  const sectionPartIds = input.sectionId
    ? await sectionRepo.listPartIdsForSection(organizationId, input.sectionId)
    : null;

  const validationError = validateAssignmentInput(input, section, sectionPartIds);
  if (validationError) {
    return Result.fail(validationError);
  }

  try {
    const assignment = await assignmentRepo.update(organizationId, assignmentId, {
      groupId: input.groupId,
      sectionId: input.sectionId ?? null,
      partId: input.partId ?? null,
      ensembleRole: input.ensembleRole,
    });
    return Result.ok(assignment);
  } catch (error) {
    if (error instanceof Error && error.message.includes('duplicate')) {
      return Result.fail('duplicate_assignment');
    }
    return Result.fail('update_failed');
  }
}

export async function removeAssignment(
  assignmentRepo: AssignmentRepository,
  organizationId: string,
  assignmentId: string,
) {
  try {
    await assignmentRepo.remove(organizationId, assignmentId);
    return Result.ok(undefined);
  } catch {
    return Result.fail('delete_failed');
  }
}
