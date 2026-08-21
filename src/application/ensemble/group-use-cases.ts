import type { GroupRepository, GroupFileAccessInput, GroupInput } from '@/application/ports/group-repository';
import { Result } from '@/domain/shared';

export async function reorderGroups(
  groupRepo: GroupRepository,
  organizationId: string,
  orderedGroupIds: string[],
) {
  if (orderedGroupIds.length === 0) {
    return Result.ok(undefined);
  }

  try {
    await groupRepo.reorderGroups(organizationId, orderedGroupIds);
    return Result.ok(undefined);
  } catch {
    return Result.fail('reorder_failed');
  }
}

export async function getGroup(
  groupRepo: GroupRepository,
  organizationId: string,
  groupId: string,
) {
  const group = await groupRepo.getById(organizationId, groupId);
  if (!group) {
    return Result.fail('not_found');
  }
  return Result.ok(group);
}

export async function createGroup(
  groupRepo: GroupRepository,
  organizationId: string,
  input: GroupInput,
) {
  if (!input.name.trim()) {
    return Result.fail('invalid_name');
  }

  try {
    const group = await groupRepo.create(organizationId, {
      name: input.name.trim(),
      kind: input.kind,
      notes: input.notes?.trim() || null,
    });
    return Result.ok(group);
  } catch {
    return Result.fail('create_failed');
  }
}

export async function updateGroup(
  groupRepo: GroupRepository,
  organizationId: string,
  groupId: string,
  input: GroupInput,
) {
  if (!input.name.trim()) {
    return Result.fail('invalid_name');
  }

  try {
    const group = await groupRepo.update(organizationId, groupId, {
      name: input.name.trim(),
      kind: input.kind,
      notes: input.notes?.trim() || null,
    });
    return Result.ok(group);
  } catch {
    return Result.fail('update_failed');
  }
}

export async function deleteGroup(
  groupRepo: GroupRepository,
  organizationId: string,
  groupId: string,
) {
  try {
    await groupRepo.delete(organizationId, groupId);
    return Result.ok(undefined);
  } catch {
    return Result.fail('delete_failed');
  }
}

export async function archiveGroup(
  groupRepo: GroupRepository,
  organizationId: string,
  groupId: string,
) {
  try {
    const group = await groupRepo.archive(organizationId, groupId);
    return Result.ok(group);
  } catch {
    return Result.fail('archive_failed');
  }
}

export async function restoreGroup(
  groupRepo: GroupRepository,
  organizationId: string,
  groupId: string,
) {
  try {
    const group = await groupRepo.restore(organizationId, groupId);
    return Result.ok(group);
  } catch {
    return Result.fail('restore_failed');
  }
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
