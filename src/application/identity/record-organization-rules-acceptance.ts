import type { LegalAcceptanceRepository } from '@/application/ports/legal-acceptance-repository';
import type { LegalAcceptanceContext } from '@/domain/identity/legal-documents';

export async function recordOrganizationRulesAcceptance(
  repo: LegalAcceptanceRepository,
  input: {
    userId: string;
    organizationId: string;
    rulesVersion: number;
    context: LegalAcceptanceContext;
  },
) {
  await repo.recordAcceptance({
    userId: input.userId,
    scope: 'organization',
    organizationId: input.organizationId,
    documentType: 'organization_rules',
    documentVersion: String(input.rulesVersion),
    context: input.context,
  });
}
