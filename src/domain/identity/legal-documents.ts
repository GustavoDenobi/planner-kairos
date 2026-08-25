export const PLATFORM_LEGAL_VERSIONS = {
  terms_of_use: '2026-08-25',
  privacy_policy: '2026-08-25',
} as const;

export type PlatformLegalDocumentType = keyof typeof PLATFORM_LEGAL_VERSIONS;

export type LegalAcceptanceScope = 'platform' | 'organization';

export type LegalDocumentType =
  | PlatformLegalDocumentType
  | 'organization_rules';

export type LegalAcceptanceContext =
  | 'signup'
  | 'invite'
  | 'musician_claim'
  | 'reacceptance';

export type OrganizationRules = {
  title: string;
  markdown: string;
  version: number;
  requiresAcceptance: boolean;
};

export type LegalAcceptance = {
  id: string;
  userId: string;
  scope: LegalAcceptanceScope;
  organizationId: string | null;
  documentType: LegalDocumentType;
  documentVersion: string;
  context: LegalAcceptanceContext;
  acceptedAt: Date;
};

export type PendingLegalAcceptance = {
  scope: LegalAcceptanceScope;
  organizationId: string | null;
  organizationName: string | null;
  documentType: LegalDocumentType;
  documentVersion: string;
  title: string;
  contentKind: 'platform_terms' | 'platform_privacy' | 'organization_rules';
  markdown: string | null;
};

export function organizationRulesRequireAcceptance(
  rules: OrganizationRules | null | undefined,
): rules is OrganizationRules {
  return (
    rules !== null &&
    rules !== undefined &&
    rules.requiresAcceptance &&
    rules.markdown.trim().length > 0
  );
}
