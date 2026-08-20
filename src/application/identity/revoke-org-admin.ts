import type { MembershipRepository } from '@/application/ports';
import type { AccessRole } from '@/domain/identity';
import { canManageAdminRole, canRevokeAdminRole } from '@/domain/identity';
import { Result } from '@/domain/shared';

export async function revokeOrgAdmin(
  membershipRepo: MembershipRepository,
  actorUserId: string,
  actorAccessRole: AccessRole,
  organizationId: string,
  targetUserId: string,
) {
  const membership = await membershipRepo.getByUserAndOrg(organizationId, targetUserId);
  if (!membership) {
    return Result.fail('membership_not_found' as const);
  }

  const manageError = canManageAdminRole(
    actorAccessRole,
    actorUserId,
    targetUserId,
    membership.accessRole,
  );
  if (manageError) {
    return Result.fail(manageError);
  }

  const revokeError = canRevokeAdminRole(membership.accessRole);
  if (revokeError) {
    return Result.fail(revokeError);
  }

  try {
    await membershipRepo.revokeAdmin(organizationId, targetUserId);
    return Result.ok(undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'operation_failed';
    return Result.fail(message as 'operation_failed');
  }
}
