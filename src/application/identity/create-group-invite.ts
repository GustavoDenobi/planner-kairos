import type { GroupInviteRepository } from '@/application/ports';
import { Result } from '@/domain/shared';

export async function createGroupInvite(
  inviteRepo: GroupInviteRepository,
  groupId: string,
  expiresAt: Date,
) {
  try {
    const result = await inviteRepo.create(groupId, expiresAt);
    return Result.ok(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'create_invite_failed';
    return Result.fail(message);
  }
}
