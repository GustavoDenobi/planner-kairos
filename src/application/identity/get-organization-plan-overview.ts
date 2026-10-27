import type { OrganizationRepository } from '@/application/ports';
import { Result } from '@/domain/shared';

export async function getOrganizationPlanOverview(
  orgRepo: OrganizationRepository,
  organizationId: string,
) {
  try {
    const overview = await orgRepo.getPlanOverview(organizationId);
    if (!overview) {
      return Result.fail('not_found');
    }

    return Result.ok(overview);
  } catch {
    return Result.fail('load_failed');
  }
}
