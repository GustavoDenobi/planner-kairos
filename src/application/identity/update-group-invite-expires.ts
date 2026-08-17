import type { GroupInviteRepository } from '@/application/ports';
import { Result } from '@/domain/shared';

export async function updateGroupInviteExpires(
  inviteRepo: GroupInviteRepository,
  inviteId: string,
  expiresAt: Date,
) {
  try {
    await inviteRepo.updateExpires(inviteId, expiresAt);
    return Result.ok(undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'update_invite_failed';
    return Result.fail(message);
  }
}
