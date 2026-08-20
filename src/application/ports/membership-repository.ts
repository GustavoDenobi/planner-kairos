import type { AccessRole, Membership } from '@/domain/identity';

export type MembershipRepository = {
  getByUserAndOrg(organizationId: string, userId: string): Promise<Membership | null>;
  grantAdmin(organizationId: string, userId: string): Promise<void>;
  revokeAdmin(organizationId: string, userId: string): Promise<void>;
};

export type { AccessRole, Membership };
