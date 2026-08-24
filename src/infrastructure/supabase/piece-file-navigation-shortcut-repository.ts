import type { PieceFileNavigationShortcutRepository } from '@/application/ports/piece-file-navigation-shortcut-repository';
import type {
  CreatePdfNavigationShortcutInput,
  PdfNavigationShortcut,
  UpdatePdfNavigationShortcutInput,
} from '@/domain/repertoire';
import { pickNavigationShortcutColor, resolveNavigationShortcutColor } from '@/domain/repertoire';
import { supabase } from './client';

const SHORTCUT_COLUMNS =
  'id, organization_id, piece_file_id, label, color, sort_order, target_page_number, target_x, target_y, anchor_page_number, anchor_x, anchor_y, author_user_id, created_at, updated_at';

function mapShortcut(row: {
  id: string;
  organization_id: string;
  piece_file_id: string;
  label: string;
  color?: string | null;
  sort_order: number;
  target_page_number: number;
  target_x?: number | null;
  target_y: number | null;
  anchor_page_number: number | null;
  anchor_x: number | null;
  anchor_y: number | null;
  author_user_id: string;
  created_at: string;
  updated_at: string;
}): PdfNavigationShortcut {
  return {
    id: row.id,
    organizationId: row.organization_id,
    pieceFileId: row.piece_file_id,
    label: row.label,
    color: resolveNavigationShortcutColor(row.color, row.sort_order),
    sortOrder: row.sort_order,
    targetPageNumber: row.target_page_number,
    targetX: row.target_x ?? null,
    targetY: row.target_y,
    anchorPageNumber: row.anchor_page_number,
    anchorX: row.anchor_x,
    anchorY: row.anchor_y,
    authorUserId: row.author_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createPieceFileNavigationShortcutRepository(): PieceFileNavigationShortcutRepository {
  return {
    async listForFile(organizationId, pieceFileId) {
      const { data, error } = await supabase
        .from('piece_file_navigation_shortcuts')
        .select(SHORTCUT_COLUMNS)
        .eq('organization_id', organizationId)
        .eq('piece_file_id', pieceFileId)
        .order('sort_order')
        .order('created_at');

      if (error || !data) {
        return [];
      }

      return data.map((row) =>
        mapShortcut(row as Parameters<typeof mapShortcut>[0]),
      );
    },

    async create(organizationId, authorUserId, input: CreatePdfNavigationShortcutInput) {
      const existing = await this.listForFile(organizationId, input.pieceFileId);
      const sortOrder = input.sortOrder ?? existing.length;
      const color = input.color?.trim() || pickNavigationShortcutColor(existing.map((item) => item.color));

      const { data, error } = await supabase
        .from('piece_file_navigation_shortcuts')
        .insert({
          organization_id: organizationId,
          piece_file_id: input.pieceFileId,
          label: input.label.trim(),
          color,
          sort_order: sortOrder,
          target_page_number: input.targetPageNumber,
          target_x: input.targetX ?? null,
          target_y: input.targetY ?? null,
          anchor_page_number: input.anchorPageNumber ?? null,
          anchor_x: input.anchorX ?? null,
          anchor_y: input.anchorY ?? null,
          author_user_id: authorUserId,
        })
        .select(SHORTCUT_COLUMNS)
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'create_failed');
      }

      return mapShortcut(data as Parameters<typeof mapShortcut>[0]);
    },

    async update(organizationId, pieceFileId, shortcutId, input: UpdatePdfNavigationShortcutInput) {
      const patch: Record<string, unknown> = {};
      if (input.label !== undefined) {
        patch.label = input.label.trim();
      }
      if (input.sortOrder !== undefined) {
        patch.sort_order = input.sortOrder;
      }
      if (input.color !== undefined) {
        patch.color = input.color;
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
      if (input.anchorPageNumber !== undefined) {
        patch.anchor_page_number = input.anchorPageNumber;
      }
      if (input.anchorX !== undefined) {
        patch.anchor_x = input.anchorX;
      }
      if (input.anchorY !== undefined) {
        patch.anchor_y = input.anchorY;
      }

      if (Object.keys(patch).length === 0) {
        const { data, error } = await supabase
          .from('piece_file_navigation_shortcuts')
          .select(SHORTCUT_COLUMNS)
          .eq('organization_id', organizationId)
          .eq('piece_file_id', pieceFileId)
          .eq('id', shortcutId)
          .maybeSingle();

        if (error || !data) {
          return null;
        }

        return mapShortcut(data as Parameters<typeof mapShortcut>[0]);
      }

      const { data, error } = await supabase
        .from('piece_file_navigation_shortcuts')
        .update(patch)
        .eq('organization_id', organizationId)
        .eq('piece_file_id', pieceFileId)
        .eq('id', shortcutId)
        .select(SHORTCUT_COLUMNS)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return mapShortcut(data as Parameters<typeof mapShortcut>[0]);
    },

    async remove(organizationId, pieceFileId, shortcutId) {
      const { error, count } = await supabase
        .from('piece_file_navigation_shortcuts')
        .delete({ count: 'exact' })
        .eq('organization_id', organizationId)
        .eq('piece_file_id', pieceFileId)
        .eq('id', shortcutId);

      if (error) {
        return false;
      }

      return (count ?? 0) > 0;
    },

    async reorder(organizationId, pieceFileId, orderedIds) {
      const updates = orderedIds.map((id, index) =>
        supabase
          .from('piece_file_navigation_shortcuts')
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
