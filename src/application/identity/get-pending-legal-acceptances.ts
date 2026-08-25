import type { LegalAcceptanceRepository } from '@/application/ports/legal-acceptance-repository';
import type { OrganizationRepository } from '@/application/ports';
import type { PendingLegalAcceptance } from '@/domain/identity/legal-documents';
import {
  PLATFORM_LEGAL_VERSIONS,
  organizationRulesRequireAcceptance,
} from '@/domain/identity/legal-documents';

export async function getPendingLegalAcceptances(
  legalRepo: LegalAcceptanceRepository,
  orgRepo: OrganizationRepository,
  userId: string,
  orgSlug?: string | null,
): Promise<PendingLegalAcceptance[]> {
  const pending: PendingLegalAcceptance[] = [];

  const [termsAccepted, privacyAccepted] = await Promise.all([
    legalRepo.hasAcceptedVersion(
      userId,
      'platform',
      'terms_of_use',
      PLATFORM_LEGAL_VERSIONS.terms_of_use,
    ),
    legalRepo.hasAcceptedVersion(
      userId,
      'platform',
      'privacy_policy',
      PLATFORM_LEGAL_VERSIONS.privacy_policy,
    ),
  ]);

  if (!termsAccepted) {
    pending.push({
      scope: 'platform',
      organizationId: null,
      organizationName: null,
      documentType: 'terms_of_use',
      documentVersion: PLATFORM_LEGAL_VERSIONS.terms_of_use,
      title: 'Termos de Uso',
      contentKind: 'platform_terms',
      markdown: null,
    });
  }

  if (!privacyAccepted) {
    pending.push({
      scope: 'platform',
      organizationId: null,
      organizationName: null,
      documentType: 'privacy_policy',
      documentVersion: PLATFORM_LEGAL_VERSIONS.privacy_policy,
      title: 'Política de Privacidade',
      contentKind: 'platform_privacy',
      markdown: null,
    });
  }

  if (!orgSlug) {
    return pending;
  }

  const org = await orgRepo.getBySlug(orgSlug);
  if (!org?.rules || !organizationRulesRequireAcceptance(org.rules)) {
    return pending;
  }

  const rulesAccepted = await legalRepo.hasAcceptedVersion(
    userId,
    'organization',
    'organization_rules',
    String(org.rules.version),
    org.id,
  );

  if (!rulesAccepted) {
    pending.push({
      scope: 'organization',
      organizationId: org.id,
      organizationName: org.name,
      documentType: 'organization_rules',
      documentVersion: String(org.rules.version),
      title: org.rules.title,
      contentKind: 'organization_rules',
      markdown: org.rules.markdown,
    });
  }

  return pending;
}
