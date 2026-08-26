import type { LegalAcceptanceRepository } from '@/application/ports/legal-acceptance-repository';
import type { OrganizationRepository } from '@/application/ports';
import { organizationRulesRequireAcceptance } from '@/domain/identity/legal-documents';

export type UserOrganizationRulesAcceptanceInfo =
  | { status: 'not_required' }
  | { status: 'no_account' }
  | { status: 'pending' }
  | {
      status: 'accepted';
      documentVersion: string;
      acceptedAt: Date;
      isCurrentVersion: boolean;
    };

export async function getUserOrganizationRulesAcceptance(
  legalRepo: LegalAcceptanceRepository,
  orgRepo: OrganizationRepository,
  organizationId: string,
  userId: string | null,
): Promise<UserOrganizationRulesAcceptanceInfo> {
  const org = await orgRepo.getById(organizationId);

  if (!organizationRulesRequireAcceptance(org?.rules)) {
    return { status: 'not_required' };
  }

  if (!userId) {
    return { status: 'no_account' };
  }

  const acceptance = await legalRepo.getLatestOrganizationRulesAcceptance(
    organizationId,
    userId,
    org!.rules!.version,
  );

  if (!acceptance) {
    return { status: 'pending' };
  }

  return {
    status: 'accepted',
    documentVersion: acceptance.documentVersion,
    acceptedAt: acceptance.acceptedAt,
    isCurrentVersion: acceptance.isCurrentVersion,
  };
}
