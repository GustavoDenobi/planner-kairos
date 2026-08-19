import type { OrganizationWithRole } from './organization-repository';

export type IdentitySnapshot = {
  userId: string;
  email: string;
  organizations: OrganizationWithRole[];
  currentOrgSlug: string | null;
  cachedAt: string;
};

export type OfflineIdentityStore = {
  get(): Promise<IdentitySnapshot | null>;
  put(snapshot: IdentitySnapshot): Promise<void>;
  clear(): Promise<void>;
};
