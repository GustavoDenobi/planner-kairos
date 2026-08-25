import type { MusicianClaimRepository } from '@/application/ports/musician-claim-repository';
import { Result } from '@/domain/shared';

export async function previewMusicianClaim(
  claimRepo: MusicianClaimRepository,
  musicianId: string,
) {
  const preview = await claimRepo.previewByMusicianId(musicianId);
  if (!preview) {
    return Result.fail('not_found' as const);
  }
  return Result.ok(preview);
}
