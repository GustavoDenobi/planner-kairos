import type { GroupRepository, ListGroupsOptions } from '@/application/ports/group-repository';
import { Result } from '@/domain/shared';

export async function listGroups(
  groupRepo: GroupRepository,
  organizationId: string,
  options?: ListGroupsOptions,
) {
  const groups = await groupRepo.listForOrg(organizationId, options);
  return Result.ok(groups);
}
