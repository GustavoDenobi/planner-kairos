import type { AccessRole, Organization } from '@/domain/identity';
import type { OrganizationRules } from '@/domain/identity/legal-documents';
import type { OrganizationPlanOverview } from '@/domain/platform/plan';
import type { OrganizationBillingOverview } from '@/domain/platform/billing';

export type OrganizationWithRole = Organization & {
  accessRole: AccessRole;
};

export type OrganizationRulesUpdateInput = {
  title: string;
  markdown: string;
  requiresAcceptance: boolean;
};

export type OrganizationRepository = {
  isPlatformAdmin(userId: string): Promise<boolean>;
  listForUser(userId: string): Promise<OrganizationWithRole[]>;
  listAllForPlatformAdmin(userId: string): Promise<OrganizationWithRole[]>;
  getBySlug(slug: string): Promise<Organization | null>;
  getById(id: string): Promise<Organization | null>;
  updateImageKey(organizationId: string, imageStorageKey: string): Promise<Organization>;
  clearImage(organizationId: string): Promise<Organization>;
  updateName(organizationId: string, name: string): Promise<Organization>;
  updateTimeZone(organizationId: string, timeZone: string): Promise<Organization>;
  updateRules(
    organizationId: string,
    input: OrganizationRulesUpdateInput,
  ): Promise<OrganizationRules>;
  getPlanOverview(organizationId: string): Promise<OrganizationPlanOverview | null>;
  /** null quando a organização não tem cobrança ativa. */
  getBillingOverview(organizationId: string): Promise<OrganizationBillingOverview | null>;
};
