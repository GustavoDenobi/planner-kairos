import type { PieceCategoryRepository } from '@/application/ports/piece-category-repository';
import type { PieceCategory, PieceCategoryInput } from '@/domain/repertoire';
import { slugifyName } from '@/domain/repertoire';
import { sortOrdersFromIds } from '@/domain/ensemble/sort-order';
import { supabase } from './client';

const CATEGORY_COLUMNS = 'id, organization_id, name, slug, sort_order, color';

function mapCategory(row: {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  sort_order: number;
  color: string | null;
}): PieceCategory {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    slug: row.slug,
    sortOrder: row.sort_order,
    color: row.color,
  };
}

export function createPieceCategoryRepository(): PieceCategoryRepository {
  return {
    async listForOrg(organizationId) {
      const { data, error } = await supabase
        .from('piece_categories')
        .select(CATEGORY_COLUMNS)
        .eq('organization_id', organizationId)
        .order('sort_order')
        .order('name');

      if (error || !data) {
        return [];
      }

      return data.map(mapCategory);
    },

    async create(organizationId, input: PieceCategoryInput) {
      const slug = input.slug ?? slugifyName(input.name);
      const { data, error } = await supabase
        .from('piece_categories')
        .insert({
          organization_id: organizationId,
          name: input.name.trim(),
          slug,
          sort_order: input.sortOrder ?? 0,
          color: input.color ?? null,
        })
        .select(CATEGORY_COLUMNS)
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'create_failed');
      }

      return mapCategory(data);
    },

    async update(organizationId, categoryId, input: PieceCategoryInput) {
      const slug = input.slug ?? slugifyName(input.name);
      const { data, error } = await supabase
        .from('piece_categories')
        .update({
          name: input.name.trim(),
          slug,
          sort_order: input.sortOrder,
          color: input.color ?? null,
        })
        .eq('organization_id', organizationId)
        .eq('id', categoryId)
        .select(CATEGORY_COLUMNS)
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'update_failed');
      }

      return mapCategory(data);
    },

    async delete(organizationId, categoryId) {
      const { error } = await supabase
        .from('piece_categories')
        .delete()
        .eq('organization_id', organizationId)
        .eq('id', categoryId);

      if (error) {
        throw new Error(error.message);
      }
    },

    async countPiecesUsingCategory(organizationId, categoryId) {
      const { count, error } = await supabase
        .from('pieces')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('category_id', categoryId)
        .is('deleted_at', null);

      if (error) {
        return 0;
      }

      return count ?? 0;
    },

    async reorderCategories(organizationId, orderedCategoryIds) {
      const sortOrders = sortOrdersFromIds(orderedCategoryIds);

      const results = await Promise.all(
        [...sortOrders.entries()].map(([id, sortOrder]) =>
          supabase
            .from('piece_categories')
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
