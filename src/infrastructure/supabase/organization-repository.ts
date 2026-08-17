import type { OrganizationRepository, OrganizationWithRole } from '@/application/ports';
import type { Organization } from '@/domain/identity';
import { supabase } from './client';

function mapOrganization(row: {
  id: string;
  name: string;
  slug: string;
  image_storage_key: string | null;
}): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    imageStorageKey: row.image_storage_key,
  };
}

export function createOrganizationRepository(): OrganizationRepository {
  return {
    async listForUser(userId) {
      const { data: membershipRows, error: membershipError } = await supabase
        .from('memberships')
        .select('access_role, organization_id')
        .eq('user_id', userId);

      if (membershipError || !membershipRows?.length) {
        return [];
      }

      const orgIds = membershipRows.map((row) => row.organization_id);
      const { data: orgRows, error: orgError } = await supabase
        .from('organizations')
        .select('id, name, slug, image_storage_key')
        .in('id', orgIds);

      if (orgError || !orgRows) {
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
        .select('id, name, slug, image_storage_key')
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
        .select('id, name, slug, image_storage_key')
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
        .select('id, name, slug, image_storage_key')
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
        .select('id, name, slug, image_storage_key')
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
        .select('id, name, slug, image_storage_key')
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'org_update_failed');
      }

      return mapOrganization(data);
    },
  };
}
