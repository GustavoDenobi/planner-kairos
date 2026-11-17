import type {
  Plan,
  PlanInput,
  PlatformOrganizationDetail,
  PlatformOrganizationSummary,
  PlatformUserDetail,
  PlatformUserLookup,
  PlatformUserSummary,
} from '@/domain/platform/plan';
import type {
  BillingEntry,
  OrganizationBilling,
  OrganizationBillingInput,
  PlatformBillingSettings,
  RecordPaymentInput,
} from '@/domain/platform/billing';
import type { AccessRole } from '@/domain/identity';

export type PlatformRepository = {
  listOrganizations(): Promise<PlatformOrganizationSummary[]>;
  getOrganization(organizationId: string): Promise<PlatformOrganizationDetail | null>;
  createOrganization(input: {
    name: string;
    slug: string;
    ownerUserId: string;
    planId: string;
  }): Promise<string>;
  assignOrganizationPlan(
    organizationId: string,
    planId: string,
    options?: { note?: string | null; stopBilling?: boolean },
  ): Promise<void>;
  getOrganizationBilling(organizationId: string): Promise<OrganizationBilling | null>;
  upsertOrganizationBilling(organizationId: string, input: OrganizationBillingInput): Promise<void>;
  listOrganizationBillingEntries(organizationId: string): Promise<BillingEntry[]>;
  recordOrganizationPayment(organizationId: string, input: RecordPaymentInput): Promise<string>;
  addOrganizationBillingNote(organizationId: string, note: string): Promise<string>;
  deleteOrganizationBillingEntry(entryId: string): Promise<void>;
  getBillingSettings(): Promise<PlatformBillingSettings>;
  updateBillingSettings(settings: PlatformBillingSettings): Promise<void>;
  listUsers(search: string | null, limit: number, offset: number): Promise<PlatformUserSummary[]>;
  getUser(userId: string): Promise<PlatformUserDetail | null>;
  findUserByEmail(email: string): Promise<PlatformUserLookup[]>;
  upsertMembership(organizationId: string, userId: string, accessRole: AccessRole): Promise<string>;
  removeMembership(organizationId: string, userId: string): Promise<void>;
  listPlans(): Promise<Plan[]>;
  getPlan(planId: string): Promise<Plan | null>;
  upsertPlan(input: PlanInput): Promise<string>;
};

export type PlatformAdminGateway = {
  setUserPassword(userId: string, newPassword: string): Promise<void>;
  deleteUser(userId: string): Promise<void>;
};
