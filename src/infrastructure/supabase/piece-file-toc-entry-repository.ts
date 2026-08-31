import type { PieceFileTocEntryRepository } from '@/application/ports/piece-file-toc-entry-repository';
import type {
  CreatePieceFileTocEntryInput,
  PieceFileTocEntry,
  UpdatePieceFileTocEntryInput,
} from '@/domain/repertoire';
import { supabase } from './client';

const TOC_COLUMNS =
  'id, organization_id, piece_file_id, label, sort_order, target_page_number, target_x, target_y, end_page_number, created_at, updated_at';

function mapTocEntry(row: {
  id: string;
  organization_id: string;
  piece_file_id: string;
  label: string;
  sort_order: number;
  target_page_number: number;
  target_x?: number | null;
  target_y?: number | null;
  end_page_number?: number | null;
  created_at: string;
  updated_at: string;
}): PieceFileTocEntry {
  return {
    id: row.id,
    organizationId: row.organization_id,
    pieceFileId: row.piece_file_id,
    label: row.label,
    sortOrder: row.sort_order,
    targetPageNumber: row.target_page_number,
    targetX: row.target_x ?? null,
    targetY: row.target_y ?? null,
    endPageNumber: row.end_page_number ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createPieceFileTocEntryRepository(): PieceFileTocEntryRepository {
  return {
    async listForFile(organizationId, pieceFileId) {
      const { data, error } = await supabase
        .from('piece_file_toc_entries')
        .select(TOC_COLUMNS)
        .eq('organization_id', organizationId)
        .eq('piece_file_id', pieceFileId)
        .order('sort_order')
        .order('created_at');

      if (error || !data) {
        return [];
      }

      return data.map((row) => mapTocEntry(row as Parameters<typeof mapTocEntry>[0]));
    },

    async listForPiece(organizationId, pieceId) {
      const { data, error } = await supabase
        .from('piece_file_toc_entries')
        .select(`${TOC_COLUMNS}, piece_files!inner(piece_id)`)
        .eq('organization_id', organizationId)
        .eq('piece_files.piece_id', pieceId)
        .order('sort_order')
        .order('created_at');

      if (error || !data) {
        return [];
      }

      return data.map((row) =>
        mapTocEntry(row as Parameters<typeof mapTocEntry>[0]),
      );
    },

    async create(organizationId, input: CreatePieceFileTocEntryInput) {
      const existing = await this.listForFile(organizationId, input.pieceFileId);
      const sortOrder = input.sortOrder ?? existing.length;

      const { data, error } = await supabase
        .from('piece_file_toc_entries')
        .insert({
          organization_id: organizationId,
          piece_file_id: input.pieceFileId,
          label: input.label.trim(),
          sort_order: sortOrder,
          target_page_number: input.targetPageNumber,
          target_x: input.targetX ?? null,
          target_y: input.targetY ?? null,
          end_page_number: input.endPageNumber ?? null,
        })
        .select(TOC_COLUMNS)
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'create_failed');
      }

      return mapTocEntry(data as Parameters<typeof mapTocEntry>[0]);
    },

    async update(organizationId, pieceFileId, entryId, input: UpdatePieceFileTocEntryInput) {
      const patch: Record<string, unknown> = {};
      if (input.label !== undefined) {
        patch.label = input.label.trim();
      }
      if (input.sortOrder !== undefined) {
        patch.sort_order = input.sortOrder;
      }
      if (input.targetPageNumber !== undefined) {
        patch.target_page_number = input.targetPageNumber;
      }
      if (input.targetX !== undefined) {
        patch.target_x = input.targetX;
      }
      if (input.targetY !== undefined) {
        patch.target_y = input.targetY;
      }
      if (input.endPageNumber !== undefined) {
        patch.end_page_number = input.endPageNumber;
      }

      if (Object.keys(patch).length === 0) {
        const { data, error } = await supabase
          .from('piece_file_toc_entries')
          .select(TOC_COLUMNS)
          .eq('organization_id', organizationId)
          .eq('piece_file_id', pieceFileId)
          .eq('id', entryId)
          .maybeSingle();

        if (error || !data) {
          return null;
        }

        return mapTocEntry(data as Parameters<typeof mapTocEntry>[0]);
      }

      const { data, error } = await supabase
        .from('piece_file_toc_entries')
        .update(patch)
        .eq('organization_id', organizationId)
        .eq('piece_file_id', pieceFileId)
        .eq('id', entryId)
        .select(TOC_COLUMNS)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return mapTocEntry(data as Parameters<typeof mapTocEntry>[0]);
    },

    async remove(organizationId, pieceFileId, entryId) {
      const { error, count } = await supabase
        .from('piece_file_toc_entries')
        .delete({ count: 'exact' })
        .eq('organization_id', organizationId)
        .eq('piece_file_id', pieceFileId)
        .eq('id', entryId);

      if (error) {
        return false;
      }

      return (count ?? 0) > 0;
    },

    async reorder(organizationId, pieceFileId, orderedIds) {
      const updates = orderedIds.map((id, index) =>
        supabase
          .from('piece_file_toc_entries')
          .update({ sort_order: index })
          .eq('organization_id', organizationId)
          .eq('piece_file_id', pieceFileId)
          .eq('id', id),
      );

      const results = await Promise.all(updates);
      for (const result of results) {
        if (result.error) {
          throw new Error(result.error.message);
        }
      }

      return this.listForFile(organizationId, pieceFileId);
    },
  };
}
