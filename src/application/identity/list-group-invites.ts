import type { GroupInviteRepository } from '@/application/ports';
import { Result } from '@/domain/shared';

export async function listGroupInvites(
  inviteRepo: GroupInviteRepository,
  organizationId: string,
) {
  const invites = await inviteRepo.listForOrg(organizationId);
  return Result.ok(invites);
}
