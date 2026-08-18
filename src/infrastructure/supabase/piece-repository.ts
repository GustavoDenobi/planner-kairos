import type { PieceRepository, SearchPiecesOptions } from '@/application/ports/piece-repository';
import type { PieceCategory, PieceDetail, PieceInput, PieceListItem } from '@/domain/repertoire';
import { normalizePieceAliases } from '@/domain/repertoire';
import { createPieceFileRepository } from './piece-file-repository';
import { supabase } from './client';

const PIECE_COLUMNS =
  'id, organization_id, title, category_id, composer, description, notes, aliases, deleted_at';

const CATEGORY_COLUMNS = 'id, organization_id, name, slug, sort_order, color';

const THEME_COLUMNS = 'id, organization_id, name, slug, sort_order';

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

async function loadThemeLinksForPieces(
  organizationId: string,
  pieceIds: string[],
): Promise<Map<string, string[]>> {
  const themeIdsByPiece = new Map<string, string[]>();

  if (pieceIds.length === 0) {
    return themeIdsByPiece;
  }

  const { data, error } = await supabase
    .from('piece_theme_links')
    .select('piece_id, theme_id')
    .eq('organization_id', organizationId)
    .in('piece_id', pieceIds);

  if (error || !data) {
    return themeIdsByPiece;
  }

  for (const row of data) {
    const list = themeIdsByPiece.get(row.piece_id) ?? [];
    list.push(row.theme_id);
    themeIdsByPiece.set(row.piece_id, list);
  }

  return themeIdsByPiece;
}

async function loadPieceIdsAccessibleForPart(
  organizationId: string,
  partId: string,
): Promise<string[]> {
  const { data: files, error } = await supabase
    .from('piece_files')
    .select('piece_id, piece_file_part_links(part_id)')
    .eq('organization_id', organizationId);

  if (error || !files) {
    return [];
  }

  const accessiblePieceIds = new Set<string>();

  for (const file of files) {
    const links = file.piece_file_part_links as { part_id: string }[] | null;
    if (!links || links.length === 0) {
      accessiblePieceIds.add(file.piece_id);
      continue;
    }
    if (links.some((link) => link.part_id === partId)) {
      accessiblePieceIds.add(file.piece_id);
    }
  }

  return [...accessiblePieceIds];
}

function intersectPieceIds(current: string[] | null, next: string[]): string[] | null {
  if (current === null) {
    return next;
  }
  const nextSet = new Set(next);
  return current.filter((id) => nextSet.has(id));
}

async function loadThemesForPiece(organizationId: string, pieceId: string) {
  const { data, error } = await supabase
    .from('piece_theme_links')
    .select(`theme_id, piece_themes (${THEME_COLUMNS})`)
    .eq('organization_id', organizationId)
    .eq('piece_id', pieceId);

  if (error || !data) {
    return [];
  }

  return data
    .map((row) => {
      const theme = row.piece_themes as {
        id: string;
        organization_id: string;
        name: string;
        slug: string;
        sort_order: number;
      } | null;
      if (!theme) {
        return null;
      }
      return {
        id: theme.id,
        organizationId: theme.organization_id,
        name: theme.name,
        slug: theme.slug,
        sortOrder: theme.sort_order,
      };
    })
    .filter((theme): theme is NonNullable<typeof theme> => theme !== null);
}

async function buildPieceDetail(
  organizationId: string,
  pieceRow: {
    id: string;
    organization_id: string;
    title: string;
    category_id: string;
    composer: string | null;
    description: string | null;
    notes: string | null;
    aliases: string[] | null;
    deleted_at: string | null;
  },
  category: PieceCategory,
): Promise<PieceDetail> {
  const fileRepo = createPieceFileRepository();
  const themes = await loadThemesForPiece(organizationId, pieceRow.id);
  const files = await fileRepo.listForPiece(organizationId, pieceRow.id);

  return {
    id: pieceRow.id,
    organizationId: pieceRow.organization_id,
    title: pieceRow.title,
    categoryId: pieceRow.category_id,
    composer: pieceRow.composer,
    description: pieceRow.description,
    notes: pieceRow.notes,
    aliases: pieceRow.aliases ?? [],
    deletedAt: pieceRow.deleted_at,
    category,
    themes,
    files,
  };
}

export function createPieceRepository(): PieceRepository {
  return {
    async search(organizationId, options?: SearchPiecesOptions) {
      let pieceIdsFilter: string[] | null = null;

      if (options?.themeIds && options.themeIds.length > 0) {
        const { data: linkRows, error: linkError } = await supabase
          .from('piece_theme_links')
          .select('piece_id')
          .eq('organization_id', organizationId)
          .in('theme_id', options.themeIds);

        if (linkError || !linkRows) {
          return [];
        }

        const counts = new Map<string, number>();
        for (const row of linkRows) {
          counts.set(row.piece_id, (counts.get(row.piece_id) ?? 0) + 1);
        }

        pieceIdsFilter = [...counts.entries()]
          .filter(([, count]) => count === options.themeIds!.length)
          .map(([pieceId]) => pieceId);

        if (pieceIdsFilter.length === 0) {
          return [];
        }
      }

      if (options?.accessibleForPartId) {
        const accessibleIds = await loadPieceIdsAccessibleForPart(
          organizationId,
          options.accessibleForPartId,
        );
        if (accessibleIds.length === 0) {
          return [];
        }
        pieceIdsFilter = intersectPieceIds(pieceIdsFilter, accessibleIds);
        if (pieceIdsFilter && pieceIdsFilter.length === 0) {
          return [];
        }
      }

      let query = supabase
        .from('pieces')
        .select(`${PIECE_COLUMNS}, piece_categories (${CATEGORY_COLUMNS})`)
        .eq('organization_id', organizationId)
        .is('deleted_at', null)
        .order('title');

      if (options?.categoryId) {
        query = query.eq('category_id', options.categoryId);
      }

      if (pieceIdsFilter) {
        query = query.in('id', pieceIdsFilter);
      }

      const { data, error } = await query;

      if (error || !data) {
        return [];
      }

      const normalizedQuery = options?.query?.trim().toLowerCase() ?? '';
      const filtered = normalizedQuery
        ? data.filter((row) => {
            const title = row.title.toLowerCase();
            const composer = (row.composer ?? '').toLowerCase();
            const aliasText = (row.aliases ?? []).join(' ').toLowerCase();
            return (
              title.includes(normalizedQuery) ||
              composer.includes(normalizedQuery) ||
              aliasText.includes(normalizedQuery)
            );
          })
        : data;

      const themeIdsByPiece = await loadThemeLinksForPieces(
        organizationId,
        filtered.map((row) => row.id),
      );

      return filtered.map((row): PieceListItem => {
        const categoryRow = row.piece_categories as {
          id: string;
          organization_id: string;
          name: string;
          slug: string;
          sort_order: number;
          color: string | null;
        };

        return {
          id: row.id,
          title: row.title,
          composer: row.composer,
          aliases: row.aliases ?? [],
          category: {
            id: categoryRow.id,
            name: categoryRow.name,
            slug: categoryRow.slug,
            color: categoryRow.color,
          },
          themeIds: themeIdsByPiece.get(row.id) ?? [],
        };
      });
    },

    async getById(organizationId, pieceId) {
      const { data, error } = await supabase
        .from('pieces')
        .select(`${PIECE_COLUMNS}, piece_categories (${CATEGORY_COLUMNS})`)
        .eq('organization_id', organizationId)
        .eq('id', pieceId)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      const categoryRow = data.piece_categories as {
        id: string;
        organization_id: string;
        name: string;
        slug: string;
        sort_order: number;
        color: string | null;
      };

      return buildPieceDetail(organizationId, data, mapCategory(categoryRow));
    },

    async create(organizationId, input: PieceInput) {
      const { data, error } = await supabase
        .from('pieces')
        .insert({
          organization_id: organizationId,
          title: input.title.trim(),
          category_id: input.categoryId,
          composer: input.composer?.trim() || null,
          description: input.description?.trim() || null,
          notes: input.notes?.trim() || null,
          aliases: normalizePieceAliases(input.aliases),
        })
        .select(`${PIECE_COLUMNS}, piece_categories (${CATEGORY_COLUMNS})`)
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'create_failed');
      }

      if (input.themeIds && input.themeIds.length > 0) {
        await this.setThemeLinks(organizationId, data.id, input.themeIds);
      }

      const detail = await this.getById(organizationId, data.id);
      if (!detail) {
        throw new Error('create_failed');
      }

      return detail;
    },

    async update(organizationId, pieceId, input: PieceInput) {
      const { data, error } = await supabase
        .from('pieces')
        .update({
          title: input.title.trim(),
          category_id: input.categoryId,
          composer: input.composer?.trim() || null,
          description: input.description?.trim() || null,
          notes: input.notes?.trim() || null,
          aliases: normalizePieceAliases(input.aliases),
        })
        .eq('organization_id', organizationId)
        .eq('id', pieceId)
        .is('deleted_at', null)
        .select('id')
        .maybeSingle();

      if (error || !data) {
        throw new Error(error?.message ?? 'update_failed');
      }

      if (input.themeIds !== undefined) {
        await this.setThemeLinks(organizationId, pieceId, input.themeIds);
      }

      const detail = await this.getById(organizationId, pieceId);
      if (!detail) {
        throw new Error('update_failed');
      }

      return detail;
    },

    async softDelete(organizationId, pieceId) {
      const { error } = await supabase
        .from('pieces')
        .update({ deleted_at: new Date().toISOString() })
        .eq('organization_id', organizationId)
        .eq('id', pieceId)
        .is('deleted_at', null);

      if (error) {
        throw new Error(error.message);
      }
    },

    async setThemeLinks(organizationId, pieceId, themeIds) {
      const { error: deleteError } = await supabase
        .from('piece_theme_links')
        .delete()
        .eq('organization_id', organizationId)
        .eq('piece_id', pieceId);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      if (themeIds.length === 0) {
        return;
      }

      const { error: insertError } = await supabase.from('piece_theme_links').insert(
        themeIds.map((themeId) => ({
          organization_id: organizationId,
          piece_id: pieceId,
          theme_id: themeId,
        })),
      );

      if (insertError) {
        throw new Error(insertError.message);
      }
    },
  };
}
