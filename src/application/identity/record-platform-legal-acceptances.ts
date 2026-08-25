import type { LegalAcceptanceRepository } from '@/application/ports/legal-acceptance-repository';
import type { LegalAcceptanceContext } from '@/domain/identity/legal-documents';
import { PLATFORM_LEGAL_VERSIONS } from '@/domain/identity/legal-documents';

export async function recordPlatformLegalAcceptances(
  repo: LegalAcceptanceRepository,
  userId: string,
  context: LegalAcceptanceContext,
) {
  await repo.recordAcceptance({
    userId,
    scope: 'platform',
    documentType: 'terms_of_use',
    documentVersion: PLATFORM_LEGAL_VERSIONS.terms_of_use,
    context,
  });

  await repo.recordAcceptance({
    userId,
    scope: 'platform',
    documentType: 'privacy_policy',
    documentVersion: PLATFORM_LEGAL_VERSIONS.privacy_policy,
    context,
  });
}
