import type { PlatformRepository } from '@/application/ports/platform-repository';
import type { AccessRole } from '@/domain/identity';
import type {
  Plan,
  PlatformOrganizationDetail,
  PlatformOrganizationSummary,
  PlatformUserDetail,
  PlatformUserLookup,
  PlatformUserSummary,
} from '@/domain/platform/plan';
import { supabase } from './client';

type PlatformOrganizationRow = {
  id: string;
  name: string;
  slug: string;
  plan_id: string;
  plan_name: string;
  created_at: string;
  memberships_count: number;
  groups_count: number;
  musicians_count: number;
  pieces_count: number;
};

type PlatformUserSummaryRow = {
  id: string;
  display_name: string;
  email: string;
  created_at: string;
  memberships_count: number;
  total_count: number | string;
};

type PlatformUserLookupRow = {
  id: string;
  display_name: string;
  email: string;
};

function mapPlan(row: {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  max_groups: number | null;
  max_musicians: number | null;
  max_pieces: number | null;
  max_storage_bytes: number | null;
  is_active: boolean;
  sort_order: number;
  organizations_count: number;
  created_at: string;
  updated_at: string;
}): Plan {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    maxGroups: row.max_groups,
    maxMusicians: row.max_musicians,
    maxPieces: row.max_pieces,
    maxStorageBytes: row.max_storage_bytes,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    organizationsCount: row.organizations_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createPlatformRepository(): PlatformRepository {
  return {
    async listOrganizations() {
      const { data, error } = await supabase.rpc('platform_list_organizations');

      if (error) {
        throw new Error(error.message);
      }

      return ((data ?? []) as PlatformOrganizationRow[]).map(
        (row): PlatformOrganizationSummary => ({
          id: row.id,
          name: row.name,
          slug: row.slug,
          planId: row.plan_id,
          planName: row.plan_name,
          createdAt: row.created_at,
          membershipsCount: row.memberships_count,
          groupsCount: row.groups_count,
          musiciansCount: row.musicians_count,
          piecesCount: row.pieces_count,
        }),
      );
    },

    async getOrganization(organizationId) {
      const { data, error } = await supabase.rpc('platform_get_organization', {
        p_org_id: organizationId,
      });

      if (error) {
        throw new Error(error.message);
      }

      const row = data?.[0];
      if (!row) {
        return null;
      }

      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        planId: row.plan_id,
        planName: row.plan_name,
        planSlug: row.plan_slug,
        createdAt: row.created_at,
        membershipsCount: row.memberships_count,
        groupsCount: row.groups_count,
        musiciansCount: row.musicians_count,
        piecesCount: row.pieces_count,
        maxGroups: row.max_groups,
        maxMusicians: row.max_musicians,
        maxPieces: row.max_pieces,
        maxStorageBytes: row.max_storage_bytes,
        eventsCount: row.events_count,
        storageBytes: Number(row.storage_bytes),
      } satisfies PlatformOrganizationDetail;
    },

    async createOrganization(input) {
      const { data, error } = await supabase.rpc('platform_create_organization', {
        p_name: input.name,
        p_slug: input.slug,
        p_owner_user_id: input.ownerUserId,
        p_plan_id: input.planId,
      });

      if (error) {
        throw new Error(error.message);
      }

      return data as string;
    },

    async assignOrganizationPlan(organizationId, planId) {
      const { error } = await supabase.rpc('platform_assign_organization_plan', {
        p_org_id: organizationId,
        p_plan_id: planId,
      });

      if (error) {
        throw new Error(error.message);
      }
    },

    async listUsers(search, limit, offset) {
      const { data, error } = await supabase.rpc('platform_list_users', {
        p_search: search,
        p_limit: limit,
        p_offset: offset,
      });

      if (error) {
        throw new Error(error.message);
      }

      return ((data ?? []) as PlatformUserSummaryRow[]).map(
        (row): PlatformUserSummary => ({
          id: row.id,
          displayName: row.display_name,
          email: row.email,
          createdAt: row.created_at,
          membershipsCount: row.memberships_count,
          totalCount: Number(row.total_count),
        }),
      );
    },

    async getUser(userId) {
      const { data, error } = await supabase.rpc('platform_get_user', {
        p_user_id: userId,
      });

      if (error) {
        throw new Error(error.message);
      }

      const row = data?.[0];
      if (!row) {
        return null;
      }

      const memberships = Array.isArray(row.memberships) ? row.memberships : [];

      return {
        id: row.id,
        displayName: row.display_name,
        email: row.email,
        theme: row.theme,
        createdAt: row.created_at,
        memberships: memberships.map((item: unknown) => {
          const membership = item as Record<string, unknown>;
          return {
            membershipId: String(membership.membershipId),
            organizationId: String(membership.organizationId),
            organizationName: String(membership.organizationName),
            organizationSlug: String(membership.organizationSlug),
            accessRole: membership.accessRole as AccessRole,
          };
        }),
      } satisfies PlatformUserDetail;
    },

    async findUserByEmail(email) {
      const { data, error } = await supabase.rpc('platform_find_user_by_email', {
        p_email: email,
      });

      if (error) {
        throw new Error(error.message);
      }

      return ((data ?? []) as PlatformUserLookupRow[]).map(
        (row): PlatformUserLookup => ({
          id: row.id,
          displayName: row.display_name,
          email: row.email,
        }),
      );
    },

    async upsertMembership(organizationId, userId, accessRole) {
      const { data, error } = await supabase.rpc('platform_upsert_membership', {
        p_org_id: organizationId,
        p_user_id: userId,
        p_role: accessRole,
      });

      if (error) {
        throw new Error(error.message);
      }

      return data as string;
    },

    async removeMembership(organizationId, userId) {
      const { error } = await supabase.rpc('platform_remove_membership', {
        p_org_id: organizationId,
        p_user_id: userId,
      });

      if (error) {
        throw new Error(error.message);
      }
    },

    async listPlans() {
      const { data, error } = await supabase.rpc('platform_list_plans');

      if (error) {
        throw new Error(error.message);
      }

      return (data ?? []).map(mapPlan);
    },

    async getPlan(planId) {
      const { data, error } = await supabase.rpc('platform_get_plan', {
        p_plan_id: planId,
      });

      if (error) {
        throw new Error(error.message);
      }

      const row = data?.[0];
      return row ? mapPlan(row) : null;
    },

    async upsertPlan(input) {
      const { data, error } = await supabase.rpc('platform_upsert_plan', {
        p_plan_id: input.id ?? null,
        p_name: input.name,
        p_slug: input.slug,
        p_description: input.description,
        p_max_groups: input.maxGroups,
        p_max_musicians: input.maxMusicians,
        p_max_pieces: input.maxPieces,
        p_max_storage_bytes: input.maxStorageBytes,
        p_is_active: input.isActive,
        p_sort_order: input.sortOrder,
      });

      if (error) {
        throw new Error(error.message);
      }

      return data as string;
    },
  };
}
