import type { PieceAccessRepository } from '@/application/ports/piece-access-repository';
import type { PieceAudienceGroup, PieceAudienceMusician, PiecePartLink } from '@/domain/repertoire';
import type { GroupKind } from '@/domain/ensemble';
import { supabase } from './client';
import { fetchAllPages } from './fetch-all-pages';

type PieceMembershipRow = {
  id: string;
  category_id: string;
  piece_groups: { group_id: string }[] | null;
};

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

    async loadPartLinks(organizationId, pieceIds) {
      const byPiece = new Map<string, PiecePartLink[]>();
      for (const pieceId of pieceIds) {
        byPiece.set(pieceId, []);
      }
      if (pieceIds.length === 0) {
        return byPiece;
      }

      const { data, error } = await supabase
        .from('piece_part_links')
        .select('piece_id, part_id, part_division_id')
        .eq('organization_id', organizationId)
        .in('piece_id', pieceIds);

      if (error || !data) {
        return byPiece;
      }

      for (const row of data) {
        const list = byPiece.get(row.piece_id) ?? [];
        list.push({
          partId: row.part_id,
          partDivisionId: row.part_division_id,
        });
        byPiece.set(row.piece_id, list);
      }

      return byPiece;
    },

    async replacePartLinks(organizationId, pieceId, partLinks) {
      const { error: deleteError } = await supabase
        .from('piece_part_links')
        .delete()
        .eq('organization_id', organizationId)
        .eq('piece_id', pieceId);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      if (partLinks.length === 0) {
        return;
      }

      const { error: insertError } = await supabase.from('piece_part_links').insert(
        partLinks.map((link) => ({
          organization_id: organizationId,
          piece_id: pieceId,
          part_id: link.partId,
          part_division_id: link.partDivisionId,
        })),
      );

      if (insertError) {
        throw new Error(insertError.message);
      }
    },

    async updateAccessSettings(organizationId, pieceId, input) {
      const { error } = await supabase
        .from('pieces')
        .update({
          file_access_scope: input.fileAccessScope,
          allow_file_download: input.allowFileDownload,
          audio_access_scope: input.audioAccessScope,
          audio_allow_download: input.audioAllowDownload,
        })
        .eq('organization_id', organizationId)
        .eq('id', pieceId)
        .is('deleted_at', null);

      if (error) {
        throw new Error(error.message);
      }
    },

    async listPieceGroupMemberships(organizationId) {
      // Uma única consulta a partir de `pieces` (índice por organização), embutindo os vínculos
      // por `piece_id`. Evita varrer `piece_groups` pela organização (sem índice) e reduz as
      // avaliações de RLS por linha em relação às três consultas anteriores.
      const rows = await fetchAllPages<PieceMembershipRow>((from, to) =>
        supabase
          .from('pieces')
          .select('id, category_id, piece_groups(group_id)')
          .eq('organization_id', organizationId)
          .is('deleted_at', null)
          .order('id')
          .range(from, to),
      );

      if (!rows) {
        throw new Error('list_piece_group_memberships_failed');
      }

      return rows.map((row) => ({
        pieceId: row.id,
        categoryId: row.category_id,
        groupIds: (row.piece_groups ?? []).map((link) => link.group_id),
      }));
    },
  };
}
