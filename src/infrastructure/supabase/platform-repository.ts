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
import {
  isBillingCycleMonths,
  type BillingEntry,
  type BillingEntryKind,
  type OrganizationBilling,
} from '@/domain/platform/billing';
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
  billing_is_active: boolean | null;
  billing_amount_cents: number | null;
  billing_cycle_months: number | null;
  billing_next_due_date: string | null;
  billing_grace_days: number | null;
  billing_last_payment_on: string | null;
};

function cycleMonths(value: number): OrganizationBilling['cycleMonths'] {
  return isBillingCycleMonths(value) ? value : 1;
}

function mapListBilling(row: PlatformOrganizationRow): OrganizationBilling | null {
  if (row.billing_is_active === null || row.billing_next_due_date === null) {
    return null;
  }

  return {
    organizationId: row.id,
    isActive: row.billing_is_active,
    amountCents: row.billing_amount_cents ?? 0,
    cycleMonths: cycleMonths(row.billing_cycle_months ?? 1),
    nextDueDate: row.billing_next_due_date,
    graceDays: row.billing_grace_days ?? 0,
    notes: null,
  };
}

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
          billing: mapListBilling(row),
          lastPaymentOn: row.billing_last_payment_on,
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

    async assignOrganizationPlan(organizationId, planId, options) {
      const { error } = await supabase.rpc('platform_assign_organization_plan', {
        p_org_id: organizationId,
        p_plan_id: planId,
        p_note: options?.note ?? null,
        p_stop_billing: options?.stopBilling ?? false,
      });

      if (error) {
        throw new Error(error.message);
      }
    },

    async getOrganizationBilling(organizationId) {
      const { data, error } = await supabase.rpc('platform_get_org_billing', {
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
        organizationId: row.organization_id,
        isActive: row.is_active,
        amountCents: row.amount_cents,
        cycleMonths: cycleMonths(row.cycle_months),
        nextDueDate: row.next_due_date,
        graceDays: row.grace_days,
        notes: row.notes,
      } satisfies OrganizationBilling;
    },

    async upsertOrganizationBilling(organizationId, input) {
      const { error } = await supabase.rpc('platform_upsert_org_billing', {
        p_org_id: organizationId,
        p_is_active: input.isActive,
        p_amount_cents: input.amountCents,
        p_cycle_months: input.cycleMonths,
        p_next_due_date: input.nextDueDate,
        p_grace_days: input.graceDays,
        p_notes: input.notes,
      });

      if (error) {
        throw new Error(error.message);
      }
    },

    async listOrganizationBillingEntries(organizationId) {
      const { data, error } = await supabase.rpc('platform_list_org_billing_entries', {
        p_org_id: organizationId,
      });

      if (error) {
        throw new Error(error.message);
      }

      type BillingEntryRow = {
        id: string;
        kind: string;
        occurred_on: string;
        amount_cents: number | null;
        from_plan_name: string | null;
        to_plan_name: string | null;
        note: string | null;
        created_by_name: string | null;
        created_at: string;
      };

      return ((data ?? []) as BillingEntryRow[]).map(
        (row): BillingEntry => ({
          id: row.id,
          kind: row.kind as BillingEntryKind,
          occurredOn: row.occurred_on,
          amountCents: row.amount_cents,
          fromPlanName: row.from_plan_name,
          toPlanName: row.to_plan_name,
          note: row.note,
          createdByName: row.created_by_name,
          createdAt: row.created_at,
        }),
      );
    },

    async recordOrganizationPayment(organizationId, input) {
      const { data, error } = await supabase.rpc('platform_record_org_payment', {
        p_org_id: organizationId,
        p_paid_on: input.paidOn,
        p_amount_cents: input.amountCents,
        p_next_due_date: input.nextDueDate,
        p_note: input.note,
      });

      if (error) {
        throw new Error(error.message);
      }

      return data as string;
    },

    async addOrganizationBillingNote(organizationId, note) {
      const { data, error } = await supabase.rpc('platform_add_org_billing_note', {
        p_org_id: organizationId,
        p_note: note,
      });

      if (error) {
        throw new Error(error.message);
      }

      return data as string;
    },

    async deleteOrganizationBillingEntry(entryId) {
      const { error } = await supabase.rpc('platform_delete_org_billing_entry', {
        p_entry_id: entryId,
      });

      if (error) {
        throw new Error(error.message);
      }
    },

    async getBillingSettings() {
      const { data, error } = await supabase.rpc('platform_get_billing_settings');

      if (error) {
        throw new Error(error.message);
      }

      const row = data?.[0];
      return {
        pixKey: row?.pix_key ?? null,
        pixRecipientName: row?.pix_recipient_name ?? null,
        instructions: row?.instructions ?? null,
      };
    },

    async updateBillingSettings(settings) {
      const { error } = await supabase.rpc('platform_update_billing_settings', {
        p_pix_key: settings.pixKey,
        p_pix_recipient_name: settings.pixRecipientName,
        p_instructions: settings.instructions,
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
