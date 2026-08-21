import type { GroupRepository, GroupInput } from '@/application/ports/group-repository';
import type { Group, GroupListItem } from '@/domain/ensemble';
import { nextSortOrder, sortOrdersFromIds } from '@/domain/ensemble/sort-order';
import { supabase } from './client';

const GROUP_COLUMNS =
  'id, organization_id, name, kind, notes, archived_at, sort_order, file_access_scope, allow_file_download, allow_piece_access_override';

function mapGroup(row: {
  id: string;
  organization_id: string;
  name: string;
  kind: Group['kind'];
  notes: string | null;
  archived_at: string | null;
  sort_order: number;
  file_access_scope: Group['fileAccessScope'];
  allow_file_download: boolean;
  allow_piece_access_override: boolean;
}): Group {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    kind: row.kind,
    notes: row.notes,
    archivedAt: row.archived_at ? new Date(row.archived_at) : null,
    sortOrder: row.sort_order,
    fileAccessScope: row.file_access_scope,
    allowFileDownload: row.allow_file_download,
    allowPieceAccessOverride: row.allow_piece_access_override,
  };
}

function mapGroupListItem(row: {
  id: string;
  organization_id: string;
  name: string;
  kind: Group['kind'];
  notes: string | null;
  archived_at: string | null;
  sort_order: number;
  file_access_scope: Group['fileAccessScope'];
  allow_file_download: boolean;
  allow_piece_access_override: boolean;
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

      const { data, error } = await query.order('sort_order').order('name');

      if (error || !data) {
        return [];
      }

      return data.map((row) => {
        const assignments = row.assignments as { count: number } | { count: number }[];
        const count = Array.isArray(assignments)
          ? assignments[0]?.count ?? 0
          : assignments?.count ?? 0;

        return mapGroupListItem({
          id: row.id,
          organization_id: row.organization_id,
          name: row.name,
          kind: row.kind,
          notes: row.notes,
          archived_at: row.archived_at,
          sort_order: row.sort_order,
          file_access_scope: row.file_access_scope ?? 'own_parts',
          allow_file_download: row.allow_file_download ?? true,
          allow_piece_access_override: row.allow_piece_access_override ?? true,
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
      const existing = await this.listForOrg(organizationId, { includeArchived: true });
      const sortOrder = nextSortOrder(existing);

      const { data, error } = await supabase
        .from('groups')
        .insert({
          organization_id: organizationId,
          name: input.name,
          kind: input.kind,
          notes: input.notes,
          sort_order: sortOrder,
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

    async updateFileAccessSettings(organizationId, groupId, input) {
      const { data, error } = await supabase
        .from('groups')
        .update({
          file_access_scope: input.fileAccessScope,
          allow_file_download: input.allowFileDownload,
          allow_piece_access_override: input.allowPieceAccessOverride,
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

    async reorderGroups(organizationId, orderedGroupIds) {
      const sortOrders = sortOrdersFromIds(orderedGroupIds);

      const results = await Promise.all(
        [...sortOrders.entries()].map(([id, sortOrder]) =>
          supabase
            .from('groups')
            .update({ sort_order: sortOrder })
            .eq('organization_id', organizationId)
            .eq('id', id),
        ),
      );

      const failed = results.find((result) => result.error);
      if (failed?.error) {
        throw new Error(failed.error.message);
      }
    },
  };
}
