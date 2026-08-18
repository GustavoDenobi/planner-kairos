import type { PieceThemeRepository } from '@/application/ports/piece-theme-repository';
import type { PieceTheme, PieceThemeInput } from '@/domain/repertoire';
import { slugifyName } from '@/domain/repertoire';
import { supabase } from './client';

const THEME_COLUMNS = 'id, organization_id, name, slug, sort_order';

function mapTheme(row: {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  sort_order: number;
}): PieceTheme {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    slug: row.slug,
    sortOrder: row.sort_order,
  };
}

export function createPieceThemeRepository(): PieceThemeRepository {
  return {
    async listForOrg(organizationId) {
      const { data, error } = await supabase
        .from('piece_themes')
        .select(THEME_COLUMNS)
        .eq('organization_id', organizationId)
        .order('sort_order')
        .order('name');

      if (error || !data) {
        return [];
      }

      return data.map(mapTheme);
    },

    async create(organizationId, input: PieceThemeInput) {
      const slug = input.slug ?? slugifyName(input.name);
      const { data, error } = await supabase
        .from('piece_themes')
        .insert({
          organization_id: organizationId,
          name: input.name.trim(),
          slug,
          sort_order: input.sortOrder ?? 0,
        })
        .select(THEME_COLUMNS)
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'create_failed');
      }

      return mapTheme(data);
    },

    async update(organizationId, themeId, input: PieceThemeInput) {
      const slug = input.slug ?? slugifyName(input.name);
      const { data, error } = await supabase
        .from('piece_themes')
        .update({
          name: input.name.trim(),
          slug,
          sort_order: input.sortOrder,
        })
        .eq('organization_id', organizationId)
        .eq('id', themeId)
        .select(THEME_COLUMNS)
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'update_failed');
      }

      return mapTheme(data);
    },

    async delete(organizationId, themeId) {
      const { error } = await supabase
        .from('piece_themes')
        .delete()
        .eq('organization_id', organizationId)
        .eq('id', themeId);

      if (error) {
        throw new Error(error.message);
      }
    },
  };
}
