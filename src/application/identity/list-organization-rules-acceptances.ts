import type { LegalAcceptanceRepository } from '@/application/ports/legal-acceptance-repository';
import type { OrganizationRepository } from '@/application/ports';

export async function listOrganizationRulesAcceptances(
  legalRepo: LegalAcceptanceRepository,
  orgRepo: OrganizationRepository,
  organizationId: string,
) {
  const org = await orgRepo.getById(organizationId);
  if (!org) {
    return [];
  }

  const currentVersion = org.rules?.version ?? 0;
  return legalRepo.listOrganizationRulesAcceptances(organizationId, currentVersion);
}
