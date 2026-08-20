import type { OrganizationRepository } from '@/application/ports';
import { Result } from '@/domain/shared';

export async function listMyOrganizations(
  orgRepo: OrganizationRepository,
  userId: string,
) {
  try {
    const orgs = await orgRepo.listForUser(userId);
    return Result.ok(orgs);
  } catch {
    return Result.fail('list_failed');
  }
}
