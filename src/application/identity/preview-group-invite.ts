import type { GroupInviteRepository } from '@/application/ports';
import { Result } from '@/domain/shared';

export async function previewGroupInvite(
  inviteRepo: GroupInviteRepository,
  token: string,
) {
  const preview = await inviteRepo.previewByToken(token);
  if (!preview) {
    return Result.fail('invalid_invite');
  }
  return Result.ok(preview);
}
