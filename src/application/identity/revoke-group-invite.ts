import type { GroupInviteRepository } from '@/application/ports';
import { Result } from '@/domain/shared';

export async function revokeGroupInvite(
  inviteRepo: GroupInviteRepository,
  inviteId: string,
) {
  try {
    await inviteRepo.revoke(inviteId);
    return Result.ok(undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'revoke_invite_failed';
    return Result.fail(message);
  }
}
