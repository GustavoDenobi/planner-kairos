import type { MembershipRepository } from '@/application/ports/membership-repository';
import type { MusicianRepository } from '@/application/ports/musician-repository';
import { listMusicianBirthdaysInRange, type MusicianBirthdayItem } from '@/domain/agenda';
import { Result } from '@/domain/shared';

export type ListMusicianBirthdaysInRangeOptions = {
  from: string;
  to: string;
  groupId?: string | null;
};

export async function listMusicianBirthdaysInRangeForAdmin(
  membershipRepo: MembershipRepository,
  musicianRepo: MusicianRepository,
  organizationId: string,
  userId: string,
  options: ListMusicianBirthdaysInRangeOptions,
) {
  const membership = await membershipRepo.getByUserAndOrg(organizationId, userId);
  if (!membership) {
    return Result.fail('not_a_member' as const);
  }

  if (membership.accessRole !== 'owner' && membership.accessRole !== 'admin') {
    return Result.fail('not_allowed' as const);
  }

  const musicians = await musicianRepo.listBirthdaysForOrg(organizationId, {
    groupId: options.groupId ?? undefined,
  });

  const birthdays = listMusicianBirthdaysInRange(musicians, options.from, options.to, {
    groupId: options.groupId ?? null,
  });
  return Result.ok(birthdays satisfies MusicianBirthdayItem[]);
}
