import type { PieceAccessRepository } from '@/application/ports/piece-access-repository';
import type { PieceAudienceGroup, PieceAudienceMusician } from '@/domain/repertoire';
import type { GroupKind } from '@/domain/ensemble';
import { supabase } from './client';

type AudienceByPiece = {
  groups: PieceAudienceGroup[];
  musicians: PieceAudienceMusician[];
};

export function createPieceAccessRepository(): PieceAccessRepository {
  return {
    async loadAudience(organizationId, pieceIds) {
      const byPiece = new Map<string, AudienceByPiece>();
      for (const pieceId of pieceIds) {
        byPiece.set(pieceId, { groups: [], musicians: [] });
      }

      if (pieceIds.length === 0) {
        return byPiece;
      }

      const [{ data: groupRows }, { data: musicianRows }] = await Promise.all([
        supabase
          .from('piece_groups')
          .select('piece_id, group_id, groups(name, kind)')
          .eq('organization_id', organizationId)
          .in('piece_id', pieceIds),
        supabase
          .from('piece_musicians')
          .select('piece_id, musician_id, musicians(full_name, user_id)')
          .eq('organization_id', organizationId)
          .in('piece_id', pieceIds),
      ]);

      for (const row of groupRows ?? []) {
        const entry = byPiece.get(row.piece_id) ?? { groups: [], musicians: [] };
        const group = row.groups as unknown as { name: string; kind: GroupKind } | null;
        entry.groups.push({
          id: row.group_id,
          name: group?.name ?? '',
          kind: group?.kind ?? 'other',
        });
        byPiece.set(row.piece_id, entry);
      }

      for (const row of musicianRows ?? []) {
        const entry = byPiece.get(row.piece_id) ?? { groups: [], musicians: [] };
        const musician = row.musicians as unknown as {
          full_name: string;
          user_id: string | null;
        } | null;
        entry.musicians.push({
          id: row.musician_id,
          fullName: musician?.full_name ?? '',
          userId: musician?.user_id ?? null,
        });
        byPiece.set(row.piece_id, entry);
      }

      return byPiece;
    },

    async replaceAudience(organizationId, pieceId, groupIds, musicianIds) {
      const { error: deleteGroupsError } = await supabase
        .from('piece_groups')
        .delete()
        .eq('organization_id', organizationId)
        .eq('piece_id', pieceId);

      if (deleteGroupsError) {
        throw new Error(deleteGroupsError.message);
      }

      const { error: deleteMusiciansError } = await supabase
        .from('piece_musicians')
        .delete()
        .eq('organization_id', organizationId)
        .eq('piece_id', pieceId);

      if (deleteMusiciansError) {
        throw new Error(deleteMusiciansError.message);
      }

      if (groupIds.length > 0) {
        const { error: insertGroupsError } = await supabase.from('piece_groups').insert(
          groupIds.map((groupId) => ({
            organization_id: organizationId,
            piece_id: pieceId,
            group_id: groupId,
          })),
        );

        if (insertGroupsError) {
          throw new Error(insertGroupsError.message);
        }
      }

      if (musicianIds.length > 0) {
        const { error: insertMusiciansError } = await supabase.from('piece_musicians').insert(
          musicianIds.map((musicianId) => ({
            organization_id: organizationId,
            piece_id: pieceId,
            musician_id: musicianId,
          })),
        );

        if (insertMusiciansError) {
          throw new Error(insertMusiciansError.message);
        }
      }
    },

    async updateAccessSettings(organizationId, pieceId, input) {
      const { error } = await supabase
        .from('pieces')
        .update({
          file_access_scope: input.fileAccessScope,
          allow_file_download: input.allowFileDownload,
        })
        .eq('organization_id', organizationId)
        .eq('id', pieceId)
        .is('deleted_at', null);

      if (error) {
        throw new Error(error.message);
      }
    },

    async listCategoryIdsByGroup(organizationId) {
      const { data, error } = await supabase
        .from('piece_groups')
        .select('group_id, pieces!inner(category_id, deleted_at)')
        .eq('organization_id', organizationId)
        .is('pieces.deleted_at', null);

      if (error || !data) {
        return new Map();
      }

      const byGroup = new Map<string, string[]>();

      for (const row of data) {
        const piece = row.pieces as unknown as { category_id: string } | null;
        if (!piece) {
          continue;
        }

        const list = byGroup.get(row.group_id) ?? [];
        if (!list.includes(piece.category_id)) {
          list.push(piece.category_id);
        }
        byGroup.set(row.group_id, list);
      }

      return byGroup;
    },

    async listUnlinkedCategoryIds(organizationId) {
      const { data: linkedRows, error: linkedError } = await supabase
        .from('piece_groups')
        .select('piece_id')
        .eq('organization_id', organizationId);

      if (linkedError) {
        return [];
      }

      const linkedPieceIds = new Set((linkedRows ?? []).map((row) => row.piece_id));

      const { data: pieces, error: piecesError } = await supabase
        .from('pieces')
        .select('id, category_id')
        .eq('organization_id', organizationId)
        .is('deleted_at', null);

      if (piecesError || !pieces) {
        return [];
      }

      const categoryIds = new Set<string>();
      for (const piece of pieces) {
        if (!linkedPieceIds.has(piece.id)) {
          categoryIds.add(piece.category_id);
        }
      }

      return [...categoryIds];
    },
  };
}
