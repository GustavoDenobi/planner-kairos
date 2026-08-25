import type { OrganizationRepository, OrganizationWithRole } from '@/application/ports';
import type { Organization } from '@/domain/identity';
import { mapOrganizationRules } from './map-organization-rules';
import { supabase } from './client';

function mapOrganization(row: {
  id: string;
  name: string;
  slug: string;
  image_storage_key: string | null;
  rules_title?: string | null;
  rules_markdown?: string | null;
  rules_version?: number | null;
  requires_rules_acceptance?: boolean | null;
}): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    imageStorageKey: row.image_storage_key,
    rules: mapOrganizationRules({
      rules_title: row.rules_title ?? null,
      rules_markdown: row.rules_markdown ?? null,
      rules_version: row.rules_version ?? null,
      requires_rules_acceptance: row.requires_rules_acceptance ?? null,
    }),
  };
}

const ORG_SELECT =
  'id, name, slug, image_storage_key, rules_title, rules_markdown, rules_version, requires_rules_acceptance';

export function createOrganizationRepository(): OrganizationRepository {
  return {
    async listForUser(userId) {
      const { data: membershipRows, error: membershipError } = await supabase
        .from('memberships')
        .select('access_role, organization_id')
        .eq('user_id', userId);

      if (membershipError) {
        throw new Error(membershipError.message);
      }

      if (!membershipRows?.length) {
        return [];
      }

      const orgIds = membershipRows.map((row) => row.organization_id);
      const { data: orgRows, error: orgError } = await supabase
        .from('organizations')
        .select(ORG_SELECT)
        .in('id', orgIds);

      if (orgError) {
        throw new Error(orgError.message);
      }

      if (!orgRows) {
        return [];
      }

      const orgMap = new Map(orgRows.map((row) => [row.id, mapOrganization(row)]));

      return membershipRows
        .map((row) => {
          const org = orgMap.get(row.organization_id);
          if (!org) {
            return null;
          }
          return {
            ...org,
            accessRole: row.access_role,
          } satisfies OrganizationWithRole;
        })
        .filter((item): item is OrganizationWithRole => item !== null);
    },

    async getBySlug(slug) {
      const { data, error } = await supabase
        .from('organizations')
        .select(ORG_SELECT)
        .eq('slug', slug)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return mapOrganization(data);
    },

    async getById(id) {
      const { data, error } = await supabase
        .from('organizations')
        .select(ORG_SELECT)
        .eq('id', id)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return mapOrganization(data);
    },

    async updateImageKey(organizationId, imageStorageKey) {
      const { data, error } = await supabase
        .from('organizations')
        .update({ image_storage_key: imageStorageKey })
        .eq('id', organizationId)
        .select(ORG_SELECT)
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'org_update_failed');
      }

      return mapOrganization(data);
    },

    async clearImage(organizationId) {
      const { data, error } = await supabase
        .from('organizations')
        .update({ image_storage_key: null })
        .eq('id', organizationId)
        .select(ORG_SELECT)
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'org_update_failed');
      }

      return mapOrganization(data);
    },

    async updateName(organizationId, name) {
      const { data, error } = await supabase
        .from('organizations')
        .update({ name })
        .eq('id', organizationId)
        .select(ORG_SELECT)
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'org_update_failed');
      }

      return mapOrganization(data);
    },

    async updateRules(organizationId, input) {
      const current = await this.getById(organizationId);
      if (!current) {
        throw new Error('org_not_found');
      }

      const contentChanged =
        current.rules?.markdown.trim() !== input.markdown.trim() ||
        current.rules?.title.trim() !== input.title.trim() ||
        current.rules?.requiresAcceptance !== input.requiresAcceptance;

      const nextVersion = contentChanged
        ? (current.rules?.version ?? 0) + 1
        : (current.rules?.version ?? 0);

      const { data, error } = await supabase
        .from('organizations')
        .update({
          rules_title: input.title,
          rules_markdown: input.markdown,
          requires_rules_acceptance: input.requiresAcceptance,
          rules_version: nextVersion,
        })
        .eq('id', organizationId)
        .select(ORG_SELECT)
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'org_rules_update_failed');
      }

      return mapOrganization(data).rules!;
    },
  };
}
