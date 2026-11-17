import type { AccessRole } from '@/domain/identity';
import type { OrganizationBilling } from '@/domain/platform/billing';

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
  /** Cobrança manual configurada (null quando a organização nunca foi cobrada). */
  billing: OrganizationBilling | null;
  lastPaymentOn: string | null;
};

export type PlatformOrganizationDetail = Omit<
  PlatformOrganizationSummary,
  'billing' | 'lastPaymentOn'
> & {
  planSlug: string;
  maxGroups: number | null;
  maxMusicians: number | null;
  maxPieces: number | null;
  maxStorageBytes: number | null;
  eventsCount: number;
  storageBytes: number;
};

/** Tipos de conteúdo que ocupam o armazenamento da organização (ordem fixa de exibição). */
export const STORAGE_USAGE_CATEGORIES = [
  'piece_score',
  'piece_audio',
  'practice_audio',
  'branding',
  'other',
] as const;

export type StorageUsageCategory = (typeof STORAGE_USAGE_CATEGORIES)[number];

export type StorageUsageEntry = {
  category: StorageUsageCategory;
  bytes: number;
  fileCount: number;
};

/** Normaliza as linhas do banco: todas as categorias, na ordem fixa; desconhecidas viram "other". */
export function normalizeStorageBreakdown(
  rows: readonly { category: string; bytes: number; fileCount: number }[],
): StorageUsageEntry[] {
  const totals = new Map<StorageUsageCategory, StorageUsageEntry>(
    STORAGE_USAGE_CATEGORIES.map((category) => [category, { category, bytes: 0, fileCount: 0 }]),
  );
  for (const row of rows) {
    const category = (STORAGE_USAGE_CATEGORIES as readonly string[]).includes(row.category)
      ? (row.category as StorageUsageCategory)
      : 'other';
    const entry = totals.get(category)!;
    entry.bytes += row.bytes;
    entry.fileCount += row.fileCount;
  }
  return STORAGE_USAGE_CATEGORIES.map((category) => totals.get(category)!);
}

/** Plano ativo e uso atual, visível a administradores da organização. */
export type OrganizationPlanOverview = {
  planId: string;
  planName: string;
  planSlug: string;
  planDescription: string | null;
  maxGroups: number | null;
  maxMusicians: number | null;
  maxPieces: number | null;
  maxStorageBytes: number | null;
  groupsCount: number;
  musiciansCount: number;
  piecesCount: number;
  eventsCount: number;
  storageBytes: number;
  /** Uso por tipo de conteúdo, na ordem de STORAGE_USAGE_CATEGORIES. */
  storageBreakdown: StorageUsageEntry[];
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
