import type { OrganizationRepository } from '@/application/ports';
import { Result } from '@/domain/shared';

export async function setCurrentOrganization(
  orgRepo: OrganizationRepository,
  userId: string,
  organizationSlug: string,
) {
  try {
    const orgs = await orgRepo.listForUser(userId);
    const match = orgs.find((o) => o.slug === organizationSlug);
    if (!match) {
      return Result.fail('not_a_member');
    }
    return Result.ok(match);
  } catch {
    return Result.fail('list_failed');
  }
}
