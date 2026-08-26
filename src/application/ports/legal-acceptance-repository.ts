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

export type UserOrganizationRulesAcceptance = {
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
  getLatestOrganizationRulesAcceptance(
    organizationId: string,
    userId: string,
    currentRulesVersion: number,
  ): Promise<UserOrganizationRulesAcceptance | null>;
};
