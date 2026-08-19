import type { GroupInviteRepository } from '@/application/ports';
import { Result } from '@/domain/shared';

export async function updateGroupInviteMaxUses(
  inviteRepo: GroupInviteRepository,
  inviteId: string,
  maxUses: number,
) {
  try {
    await inviteRepo.updateMaxUses(inviteId, maxUses);
    return Result.ok(undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'update_max_uses_failed';
    return Result.fail(message);
  }
}
