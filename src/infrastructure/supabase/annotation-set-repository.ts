import type { AnnotationSetRepository } from '@/application/ports/annotation-set-repository';
import type { AnnotationSet, CreateAnnotationSetInput, UpdateAnnotationSetInput } from '@/domain/repertoire';
import type { GroupKind } from '@/domain/ensemble';
import { supabase } from './client';

const SET_COLUMNS =
  'id, organization_id, piece_file_id, author_user_id, title, created_at, updated_at';

type SetRow = {
  id: string;
  organization_id: string;
  piece_file_id: string;
  author_user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
};

type AudienceBySet = {
  groups: AnnotationSet['groups'];
  musicians: AnnotationSet['musicians'];
};

function mapSet(row: SetRow, audience: AudienceBySet): AnnotationSet {
  return {
    id: row.id,
    organizationId: row.organization_id,
    pieceFileId: row.piece_file_id,
    authorUserId: row.author_user_id,
    title: row.title,
    groups: audience.groups,
    musicians: audience.musicians,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadAudience(
  organizationId: string,
  setIds: string[],
): Promise<Map<string, AudienceBySet>> {
  const bySet = new Map<string, AudienceBySet>();
  for (const setId of setIds) {
    bySet.set(setId, { groups: [], musicians: [] });
  }

  if (setIds.length === 0) {
    return bySet;
  }

  const [{ data: groupRows }, { data: musicianRows }] = await Promise.all([
    supabase
      .from('annotation_set_groups')
      .select('annotation_set_id, group_id, groups(name, kind)')
      .eq('organization_id', organizationId)
      .in('annotation_set_id', setIds),
    supabase
      .from('annotation_set_musicians')
      .select('annotation_set_id, musician_id, musicians(full_name)')
      .eq('organization_id', organizationId)
      .in('annotation_set_id', setIds),
  ]);

  for (const row of groupRows ?? []) {
    const audience = bySet.get(row.annotation_set_id);
    const group = row.groups as { name: string; kind: GroupKind } | { name: string; kind: GroupKind }[] | null;
    const resolved = Array.isArray(group) ? group[0] : group;
    if (audience && resolved) {
      audience.groups.push({
        id: row.group_id,
        name: resolved.name,
        kind: resolved.kind,
      });
    }
  }

  for (const row of musicianRows ?? []) {
    const audience = bySet.get(row.annotation_set_id);
    const musician = row.musicians as { full_name: string } | { full_name: string }[] | null;
    const resolved = Array.isArray(musician) ? musician[0] : musician;
    if (audience && resolved) {
      audience.musicians.push({
        id: row.musician_id,
        fullName: resolved.full_name,
      });
    }
  }

  return bySet;
}

async function replaceAudience(
  organizationId: string,
  setId: string,
  groupIds: string[],
  musicianIds: string[],
): Promise<void> {
  await Promise.all([
    supabase
      .from('annotation_set_groups')
      .delete()
      .eq('organization_id', organizationId)
      .eq('annotation_set_id', setId),
    supabase
      .from('annotation_set_musicians')
      .delete()
      .eq('organization_id', organizationId)
      .eq('annotation_set_id', setId),
  ]);

  if (groupIds.length > 0) {
    const { error } = await supabase.from('annotation_set_groups').insert(
      groupIds.map((groupId) => ({
        organization_id: organizationId,
        annotation_set_id: setId,
        group_id: groupId,
      })),
    );
    if (error) {
      throw new Error(error.message);
    }
  }

  if (musicianIds.length > 0) {
    const { error } = await supabase.from('annotation_set_musicians').insert(
      musicianIds.map((musicianId) => ({
        organization_id: organizationId,
        annotation_set_id: setId,
        musician_id: musicianId,
      })),
    );
    if (error) {
      throw new Error(error.message);
    }
  }
}

export function createAnnotationSetRepository(): AnnotationSetRepository {
  return {
    async listForFile(organizationId, pieceFileId) {
      const { data, error } = await supabase
        .from('annotation_sets')
        .select(SET_COLUMNS)
        .eq('organization_id', organizationId)
        .eq('piece_file_id', pieceFileId)
        .order('created_at');

      if (error || !data) {
        return [];
      }

      const rows = data as SetRow[];
      const audienceBySet = await loadAudience(
        organizationId,
        rows.map((row) => row.id),
      );

      return rows.map((row) =>
        mapSet(row, audienceBySet.get(row.id) ?? { groups: [], musicians: [] }),
      );
    },

    async getById(organizationId, setId) {
      const { data, error } = await supabase
        .from('annotation_sets')
        .select(SET_COLUMNS)
        .eq('organization_id', organizationId)
        .eq('id', setId)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      const audienceBySet = await loadAudience(organizationId, [setId]);
      return mapSet(data as SetRow, audienceBySet.get(setId) ?? { groups: [], musicians: [] });
    },

    async create(organizationId, authorUserId, input: CreateAnnotationSetInput) {
      const { data, error } = await supabase
        .from('annotation_sets')
        .insert({
          organization_id: organizationId,
          piece_file_id: input.pieceFileId,
          author_user_id: authorUserId,
          title: input.title?.trim() || null,
        })
        .select(SET_COLUMNS)
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'create_failed');
      }

      const row = data as SetRow;
      await replaceAudience(organizationId, row.id, input.groupIds, input.musicianIds);
      const audienceBySet = await loadAudience(organizationId, [row.id]);
      return mapSet(row, audienceBySet.get(row.id) ?? { groups: [], musicians: [] });
    },

    async update(organizationId, setId, input: UpdateAnnotationSetInput) {
      const patch: { title?: string | null } = {};
      if (input.title !== undefined) {
        patch.title = input.title?.trim() || null;
      }

      if (Object.keys(patch).length > 0) {
        const { error } = await supabase
          .from('annotation_sets')
          .update(patch)
          .eq('organization_id', organizationId)
          .eq('id', setId);

        if (error) {
          return null;
        }
      }

      if (input.groupIds !== undefined && input.musicianIds !== undefined) {
        await replaceAudience(organizationId, setId, input.groupIds, input.musicianIds);
      }

      return this.getById(organizationId, setId);
    },

    async remove(organizationId, setId) {
      const { error } = await supabase
        .from('annotation_sets')
        .delete()
        .eq('organization_id', organizationId)
        .eq('id', setId);

      return !error;
    },
  };
}
