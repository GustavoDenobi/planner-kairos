import type { AccessRole, Organization } from '@/domain/identity';

export type OrganizationWithRole = Organization & {
  accessRole: AccessRole;
};

export type OrganizationRepository = {
  listForUser(userId: string): Promise<OrganizationWithRole[]>;
  getBySlug(slug: string): Promise<Organization | null>;
  getById(id: string): Promise<Organization | null>;
  updateImageKey(organizationId: string, imageStorageKey: string): Promise<Organization>;
  clearImage(organizationId: string): Promise<Organization>;
  updateName(organizationId: string, name: string): Promise<Organization>;
};
