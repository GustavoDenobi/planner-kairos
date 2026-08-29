import type { MembershipRepository } from '@/application/ports/membership-repository';
import type { MusicianRepository } from '@/application/ports/musician-repository';
import type { OrganizationRepository } from '@/application/ports/organization-repository';
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
  orgRepo: OrganizationRepository,
  organizationId: string,
  userId: string,
  options: ListMusicianBirthdaysInRangeOptions,
) {
  const [membership, isPlatformAdmin] = await Promise.all([
    membershipRepo.getByUserAndOrg(organizationId, userId),
    orgRepo.isPlatformAdmin(userId),
  ]);

  if (!membership && !isPlatformAdmin) {
    return Result.fail('not_a_member' as const);
  }

  if (
    !isPlatformAdmin &&
    membership?.accessRole !== 'owner' &&
    membership?.accessRole !== 'admin'
  ) {
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
