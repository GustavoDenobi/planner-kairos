import type { AccessRole } from '@/domain/identity';

export type Plan = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  maxGroups: number | null;
  maxMusicians: number | null;
  maxPieces: number | null;
  maxStorageBytes: number | null;
  isActive: boolean;
  sortOrder: number;
  organizationsCount: number;
  createdAt: string;
  updatedAt: string;
};

export type PlanInput = {
  id?: string;
  name: string;
  slug: string;
  description: string | null;
  maxGroups: number | null;
  maxMusicians: number | null;
  maxPieces: number | null;
  maxStorageBytes: number | null;
  isActive: boolean;
  sortOrder: number;
};

export type PlatformOrganizationSummary = {
  id: string;
  name: string;
  slug: string;
  planId: string;
  planName: string;
  createdAt: string;
  membershipsCount: number;
  groupsCount: number;
  musiciansCount: number;
  piecesCount: number;
};

export type PlatformOrganizationDetail = PlatformOrganizationSummary & {
  planSlug: string;
  maxGroups: number | null;
  maxMusicians: number | null;
  maxPieces: number | null;
  maxStorageBytes: number | null;
  eventsCount: number;
  storageBytes: number;
};

export type PlatformUserMembership = {
  membershipId: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  accessRole: AccessRole;
};

export type PlatformUserSummary = {
  id: string;
  displayName: string;
  email: string;
  createdAt: string;
  membershipsCount: number;
  totalCount: number;
};

export type PlatformUserDetail = {
  id: string;
  displayName: string;
  email: string;
  theme: 'light' | 'dark';
  createdAt: string;
  memberships: PlatformUserMembership[];
};

export type PlatformUserLookup = {
  id: string;
  displayName: string;
  email: string;
};
