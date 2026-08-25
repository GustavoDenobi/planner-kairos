import type {
  LegalAcceptance,
  LegalAcceptanceContext,
  LegalDocumentType,
  LegalAcceptanceScope,
} from '@/domain/identity/legal-documents';

export type RecordLegalAcceptanceInput = {
  userId: string;
  scope: LegalAcceptanceScope;
  organizationId?: string | null;
  documentType: LegalDocumentType;
  documentVersion: string;
  context: LegalAcceptanceContext;
};

export type OrganizationRulesAcceptanceListItem = {
  userId: string;
  displayName: string;
  email: string;
  documentVersion: string;
  acceptedAt: Date;
  isCurrentVersion: boolean;
};

export type LegalAcceptanceRepository = {
  recordAcceptance(input: RecordLegalAcceptanceInput): Promise<LegalAcceptance>;
  hasAcceptedVersion(
    userId: string,
    scope: LegalAcceptanceScope,
    documentType: LegalDocumentType,
    documentVersion: string,
    organizationId?: string | null,
  ): Promise<boolean>;
  listLatestByUser(userId: string): Promise<LegalAcceptance[]>;
  listOrganizationRulesAcceptances(
    organizationId: string,
    currentRulesVersion: number,
  ): Promise<OrganizationRulesAcceptanceListItem[]>;
};
