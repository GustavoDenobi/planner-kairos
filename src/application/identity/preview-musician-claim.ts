import type { MusicianClaimRepository } from '@/application/ports/musician-claim-repository';
import { Result } from '@/domain/shared';

export async function previewMusicianClaim(
  claimRepo: MusicianClaimRepository,
  claimToken: string,
) {
  const preview = await claimRepo.previewByToken(claimToken);
  if (!preview) {
    return Result.fail('not_found' as const);
  }
  return Result.ok(preview);
}
