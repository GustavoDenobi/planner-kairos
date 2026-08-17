import type { GroupRepository, GroupInput } from '@/application/ports/group-repository';
import type { Group, GroupListItem } from '@/domain/ensemble';
import { supabase } from './client';

const GROUP_COLUMNS = 'id, organization_id, name, kind, notes, archived_at';

function mapGroup(row: {
  id: string;
  organization_id: string;
  name: string;
  kind: Group['kind'];
  notes: string | null;
  archived_at: string | null;
}): Group {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    kind: row.kind,
    notes: row.notes,
    archivedAt: row.archived_at ? new Date(row.archived_at) : null,
  };
}

function mapGroupListItem(row: {
  id: string;
  organization_id: string;
  name: string;
  kind: Group['kind'];
  notes: string | null;
  archived_at: string | null;
  assignments: { count: number }[];
}): GroupListItem {
  return {
    ...mapGroup(row),
    memberCount: row.assignments[0]?.count ?? 0,
  };
}

export function createGroupRepository(): GroupRepository {
  return {
    async listForOrg(organizationId, options) {
      let query = supabase
        .from('groups')
        .select(`${GROUP_COLUMNS}, assignments(count)`)
        .eq('organization_id', organizationId);

      if (!options?.includeArchived) {
        query = query.is('archived_at', null);
      }

      const { data, error } = await query.order('name');

      if (error || !data) {
        return [];
      }

      return data.map((row) => {
        const assignments = row.assignments as { count: number } | { count: number }[];
        const count = Array.isArray(assignments)
          ? assignments[0]?.count ?? 0
          : assignments?.count ?? 0;

        return mapGroupListItem({
          ...row,
          assignments: [{ count }],
        });
      });
    },

    async getById(organizationId, groupId) {
      const { data, error } = await supabase
        .from('groups')
        .select(GROUP_COLUMNS)
        .eq('organization_id', organizationId)
        .eq('id', groupId)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return mapGroup(data);
    },

    async create(organizationId, input: GroupInput) {
      const { data, error } = await supabase
        .from('groups')
        .insert({
          organization_id: organizationId,
          name: input.name,
          kind: input.kind,
          notes: input.notes,
        })
        .select(GROUP_COLUMNS)
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'create_failed');
      }

      return mapGroup(data);
    },

    async update(organizationId, groupId, input: GroupInput) {
      const { data, error } = await supabase
        .from('groups')
        .update({
          name: input.name,
          kind: input.kind,
          notes: input.notes,
        })
        .eq('organization_id', organizationId)
        .eq('id', groupId)
        .select(GROUP_COLUMNS)
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'update_failed');
      }

      return mapGroup(data);
    },

    async archive(organizationId, groupId) {
      const { data, error } = await supabase
        .from('groups')
        .update({ archived_at: new Date().toISOString() })
        .eq('organization_id', organizationId)
        .eq('id', groupId)
        .is('archived_at', null)
        .select(GROUP_COLUMNS)
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'archive_failed');
      }

      return mapGroup(data);
    },

    async restore(organizationId, groupId) {
      const { data, error } = await supabase
        .from('groups')
        .update({ archived_at: null })
        .eq('organization_id', organizationId)
        .eq('id', groupId)
        .not('archived_at', 'is', null)
        .select(GROUP_COLUMNS)
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'restore_failed');
      }

      return mapGroup(data);
    },

    async delete(organizationId, groupId) {
      const { error } = await supabase
        .from('groups')
        .delete()
        .eq('organization_id', organizationId)
        .eq('id', groupId);

      if (error) {
        throw new Error(error.message);
      }
    },
  };
}
