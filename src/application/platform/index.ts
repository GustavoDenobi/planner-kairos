import type {
  PlatformAdminGateway,
  PlatformRepository,
} from '@/application/ports/platform-repository';
import type { PlanInput } from '@/domain/platform/plan';
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
    assignOrganizationPlan: (organizationId: string, planId: string) =>
      wrap(() => deps.platformRepo.assignOrganizationPlan(organizationId, planId)),
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
