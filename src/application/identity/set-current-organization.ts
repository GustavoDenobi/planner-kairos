import type { OrganizationRepository } from '@/application/ports';
import { Result } from '@/domain/shared';

export async function setCurrentOrganization(
  orgRepo: OrganizationRepository,
  userId: string,
  organizationSlug: string,
) {
  try {
    const isPlatformAdmin = await orgRepo.isPlatformAdmin(userId);
    const orgs = isPlatformAdmin
      ? await orgRepo.listAllForPlatformAdmin(userId)
      : await orgRepo.listForUser(userId);

    const match = orgs.find((o) => o.slug === organizationSlug);
    if (match) {
      return Result.ok(match);
    }

    if (isPlatformAdmin) {
      const org = await orgRepo.getBySlug(organizationSlug);
      if (org) {
        return Result.ok({
          ...org,
          accessRole: 'owner' as const,
        });
      }
    }

    return Result.fail('not_a_member');
  } catch {
    return Result.fail('list_failed');
  }
}
