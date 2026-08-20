import type { MembershipRepository } from '@/application/ports';
import type { AccessRole } from '@/domain/identity';
import { Result } from '@/domain/shared';

export async function getMembershipAccessRole(
  membershipRepo: MembershipRepository,
  organizationId: string,
  userId: string,
) {
  const membership = await membershipRepo.getByUserAndOrg(organizationId, userId);
  if (!membership) {
    return Result.fail('membership_not_found' as const);
  }

  return Result.ok(membership.accessRole satisfies AccessRole);
}
