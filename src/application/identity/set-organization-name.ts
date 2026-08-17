import type { OrganizationRepository } from '@/application/ports';
import { Result } from '@/domain/shared';

export async function setOrganizationName(
  orgRepo: OrganizationRepository,
  organizationId: string,
  name: string,
) {
  const trimmed = name.trim();
  if (!trimmed) {
    return Result.fail('invalid_name');
  }

  const org = await orgRepo.updateName(organizationId, trimmed);
  return Result.ok(org);
}
