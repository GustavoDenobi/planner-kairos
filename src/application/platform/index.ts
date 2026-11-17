import type {
  PlatformAdminGateway,
  PlatformRepository,
} from '@/application/ports/platform-repository';
import type { PlanInput } from '@/domain/platform/plan';
import type {
  OrganizationBillingInput,
  PlatformBillingSettings,
  RecordPaymentInput,
} from '@/domain/platform/billing';
import type { AccessRole } from '@/domain/identity';
import { Result } from '@/domain/shared';

export type PlatformDeps = {
  platformRepo: PlatformRepository;
  platformAdminGateway: PlatformAdminGateway;
};

export function createPlatformUseCases(deps: PlatformDeps) {
  return {
    listOrganizations: () => wrap(() => deps.platformRepo.listOrganizations()),
    getOrganization: (organizationId: string) =>
      wrap(() => deps.platformRepo.getOrganization(organizationId)),
    createOrganization: (input: {
      name: string;
      slug: string;
      ownerUserId: string;
      planId: string;
    }) => wrap(() => deps.platformRepo.createOrganization(input)),
    assignOrganizationPlan: (
      organizationId: string,
      planId: string,
      options?: { note?: string | null; stopBilling?: boolean },
    ) => wrap(() => deps.platformRepo.assignOrganizationPlan(organizationId, planId, options)),
    getOrganizationBilling: (organizationId: string) =>
      wrap(() => deps.platformRepo.getOrganizationBilling(organizationId)),
    upsertOrganizationBilling: (organizationId: string, input: OrganizationBillingInput) =>
      wrap(async () => {
        if (input.amountCents < 0 || !Number.isInteger(input.amountCents)) {
          throw new Error('invalid_amount');
        }
        if (input.graceDays < 0 || input.graceDays > 90) {
          throw new Error('invalid_grace_days');
        }
        await deps.platformRepo.upsertOrganizationBilling(organizationId, input);
      }),
    listOrganizationBillingEntries: (organizationId: string) =>
      wrap(() => deps.platformRepo.listOrganizationBillingEntries(organizationId)),
    recordOrganizationPayment: (organizationId: string, input: RecordPaymentInput) =>
      wrap(async () => {
        if (input.amountCents < 0 || !Number.isInteger(input.amountCents)) {
          throw new Error('invalid_amount');
        }
        return deps.platformRepo.recordOrganizationPayment(organizationId, input);
      }),
    addOrganizationBillingNote: (organizationId: string, note: string) =>
      wrap(async () => {
        if (!note.trim()) {
          throw new Error('invalid_input');
        }
        return deps.platformRepo.addOrganizationBillingNote(organizationId, note.trim());
      }),
    deleteOrganizationBillingEntry: (entryId: string) =>
      wrap(() => deps.platformRepo.deleteOrganizationBillingEntry(entryId)),
    getBillingSettings: () => wrap(() => deps.platformRepo.getBillingSettings()),
    updateBillingSettings: (settings: PlatformBillingSettings) =>
      wrap(() => deps.platformRepo.updateBillingSettings(settings)),
    listUsers: (search: string | null, limit: number, offset: number) =>
      wrap(() => deps.platformRepo.listUsers(search, limit, offset)),
    getUser: (userId: string) => wrap(() => deps.platformRepo.getUser(userId)),
    findUserByEmail: (email: string) => wrap(() => deps.platformRepo.findUserByEmail(email)),
    upsertMembership: (organizationId: string, userId: string, accessRole: AccessRole) =>
      wrap(() => deps.platformRepo.upsertMembership(organizationId, userId, accessRole)),
    removeMembership: (organizationId: string, userId: string) =>
      wrap(() => deps.platformRepo.removeMembership(organizationId, userId)),
    listPlans: () => wrap(() => deps.platformRepo.listPlans()),
    getPlan: (planId: string) => wrap(() => deps.platformRepo.getPlan(planId)),
    upsertPlan: (input: PlanInput) => wrap(() => deps.platformRepo.upsertPlan(input)),
    setUserPassword: (userId: string, newPassword: string) =>
      wrap(() => deps.platformAdminGateway.setUserPassword(userId, newPassword)),
    deleteUser: (userId: string) => wrap(() => deps.platformAdminGateway.deleteUser(userId)),
  };
}

async function wrap<T>(fn: () => Promise<T>) {
  try {
    return Result.ok(await fn());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    return Result.fail(message);
  }
}

export type PlatformUseCases = ReturnType<typeof createPlatformUseCases>;
