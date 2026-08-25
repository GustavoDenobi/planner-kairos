import type { LegalAcceptanceRepository } from '@/application/ports/legal-acceptance-repository';
import type { PendingLegalAcceptance } from '@/domain/identity/legal-documents';
import { recordOrganizationRulesAcceptance } from './record-organization-rules-acceptance';
import { recordPlatformLegalAcceptances } from './record-platform-legal-acceptances';

export async function recordPendingLegalAcceptances(
  legalRepo: LegalAcceptanceRepository,
  userId: string,
  pending: PendingLegalAcceptance[],
) {
  for (const item of pending) {
    if (item.documentType === 'terms_of_use' || item.documentType === 'privacy_policy') {
      continue;
    }

    if (item.documentType === 'organization_rules' && item.organizationId) {
      await recordOrganizationRulesAcceptance(legalRepo, {
        userId,
        organizationId: item.organizationId,
        rulesVersion: Number(item.documentVersion),
        context: 'reacceptance',
      });
    }
  }

  const needsPlatformTerms = pending.some((item) => item.documentType === 'terms_of_use');
  const needsPlatformPrivacy = pending.some((item) => item.documentType === 'privacy_policy');

  if (needsPlatformTerms || needsPlatformPrivacy) {
    if (needsPlatformTerms && needsPlatformPrivacy) {
      await recordPlatformLegalAcceptances(legalRepo, userId, 'reacceptance');
      return;
    }

    if (needsPlatformTerms) {
      await legalRepo.recordAcceptance({
        userId,
        scope: 'platform',
        documentType: 'terms_of_use',
        documentVersion: pending.find((item) => item.documentType === 'terms_of_use')!
          .documentVersion,
        context: 'reacceptance',
      });
    }

    if (needsPlatformPrivacy) {
      await legalRepo.recordAcceptance({
        userId,
        scope: 'platform',
        documentType: 'privacy_policy',
        documentVersion: pending.find((item) => item.documentType === 'privacy_policy')!
          .documentVersion,
        context: 'reacceptance',
      });
    }
  }
}
