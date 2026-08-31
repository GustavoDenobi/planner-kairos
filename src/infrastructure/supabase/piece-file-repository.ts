import type { CreatePieceFileInput, PieceFileRepository, UpdatePieceFileInput } from '@/application/ports/piece-file-repository';
import type { PieceFilePartLink, PieceFileWithLinks } from '@/domain/repertoire';
import { supabase } from './client';

const FILE_COLUMNS =
  'id, organization_id, piece_id, kind, storage_key, mime_type, title, original_name, byte_size, content_hash, sort_order';

function mapFile(row: {
  id: string;
  organization_id: string;
  piece_id: string;
  kind: PieceFileWithLinks['kind'];
  storage_key: string;
  mime_type: string;
  title: string;
  original_name: string;
  byte_size: number | null;
  content_hash: string | null;
  sort_order: number;
}): Omit<PieceFileWithLinks, 'partLinks'> {
  return {
    id: row.id,
    organizationId: row.organization_id,
    pieceId: row.piece_id,
    kind: row.kind,
    storageKey: row.storage_key,
    mimeType: row.mime_type,
    title: row.title,
    originalName: row.original_name,
    byteSize: row.byte_size,
    contentHash: row.content_hash,
    sortOrder: row.sort_order,
  };
}

async function loadPartLinksForFiles(
  organizationId: string,
  fileIds: string[],
): Promise<Map<string, PieceFilePartLink[]>> {
  const linksByFile = new Map<string, PieceFilePartLink[]>();

  if (fileIds.length === 0) {
    return linksByFile;
  }

  const { data, error } = await supabase
    .from('piece_file_part_links')
    .select('piece_file_id, part_id, part_division_id')
    .eq('organization_id', organizationId)
    .in('piece_file_id', fileIds);

  if (error || !data) {
    return linksByFile;
  }

  for (const row of data) {
    const list = linksByFile.get(row.piece_file_id) ?? [];
    list.push({ partId: row.part_id, partDivisionId: row.part_division_id });
    linksByFile.set(row.piece_file_id, list);
  }

  return linksByFile;
}

function comparePieceFiles(a: PieceFileWithLinks, b: PieceFileWithLinks): number {
  if (a.kind !== b.kind) {
    return a.kind === 'audio' ? 1 : -1;
  }
  if (a.kind === 'score' && b.kind === 'score') {
    return a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, 'pt-BR');
  }
  return a.title.localeCompare(b.title, 'pt-BR');
}

async function nextScoreSortOrder(organizationId: string, pieceId: string): Promise<number> {
  const { data, error } = await supabase
    .from('piece_files')
    .select('sort_order')
    .eq('organization_id', organizationId)
    .eq('piece_id', pieceId)
    .eq('kind', 'score')
    .order('sort_order', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) {
    return 0;
  }

  return (data[0]?.sort_order ?? -1) + 1;
}

export function createPieceFileRepository(): PieceFileRepository {
  return {
    async listForPiece(organizationId, pieceId) {
      const { data, error } = await supabase
        .from('piece_files')
        .select(FILE_COLUMNS)
        .eq('organization_id', organizationId)
        .eq('piece_id', pieceId)
        .order('kind')
        .order('sort_order')
        .order('title');

      if (error || !data) {
        return [];
      }

      const linksByFile = await loadPartLinksForFiles(
        organizationId,
        data.map((row) => row.id),
      );

      return data
        .map((row) => ({
          ...mapFile(row),
          partLinks: linksByFile.get(row.id) ?? [],
        }))
        .sort(comparePieceFiles);
    },

    async getById(organizationId, pieceId, fileId) {
      const { data, error } = await supabase
        .from('piece_files')
        .select(FILE_COLUMNS)
        .eq('organization_id', organizationId)
        .eq('piece_id', pieceId)
        .eq('id', fileId)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      const linksByFile = await loadPartLinksForFiles(organizationId, [data.id]);

      return {
        ...mapFile(data),
        partLinks: linksByFile.get(data.id) ?? [],
      };
    },

    async getByFileId(organizationId, fileId) {
      const { data, error } = await supabase
        .from('piece_files')
        .select(FILE_COLUMNS)
        .eq('organization_id', organizationId)
        .eq('id', fileId)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      const linksByFile = await loadPartLinksForFiles(organizationId, [data.id]);

      return {
        ...mapFile(data),
        partLinks: linksByFile.get(data.id) ?? [],
      };
    },

    async findByContentHash(organizationId, pieceId, contentHash) {
      const { data, error } = await supabase
        .from('piece_files')
        .select(FILE_COLUMNS)
        .eq('organization_id', organizationId)
        .eq('piece_id', pieceId)
        .eq('content_hash', contentHash)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      const linksByFile = await loadPartLinksForFiles(organizationId, [data.id]);

      return {
        ...mapFile(data),
        partLinks: linksByFile.get(data.id) ?? [],
      };
    },

    async create(organizationId, input: CreatePieceFileInput) {
      const sortOrder =
        input.sortOrder ??
        (input.kind === 'score' ? await nextScoreSortOrder(organizationId, input.pieceId) : 0);

      const { data, error } = await supabase
        .from('piece_files')
        .insert({
          id: input.id,
          organization_id: organizationId,
          piece_id: input.pieceId,
          kind: input.kind,
          storage_key: input.storageKey,
          mime_type: input.mimeType,
          title: input.title,
          original_name: input.originalName,
          byte_size: input.byteSize,
          content_hash: input.contentHash,
          sort_order: sortOrder,
        })
        .select(FILE_COLUMNS)
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'create_failed');
      }

      if (input.partLinks.length > 0) {
        const { error: linkError } = await supabase.from('piece_file_part_links').insert(
          input.partLinks.map((link) => ({
            organization_id: organizationId,
            piece_file_id: data.id,
            part_id: link.partId,
            part_division_id: link.partDivisionId,
          })),
        );

        if (linkError) {
          throw new Error(linkError.message);
        }
      }

      const linksByFile = await loadPartLinksForFiles(organizationId, [data.id]);

      return {
        ...mapFile(data),
        partLinks: linksByFile.get(data.id) ?? [],
      };
    },

    async update(organizationId, pieceId, fileId, input: UpdatePieceFileInput) {
      const patch: Record<string, unknown> = { title: input.title };
      if (input.sortOrder !== undefined) {
        patch.sort_order = input.sortOrder;
      }

      const { data, error } = await supabase
        .from('piece_files')
        .update(patch)
        .eq('organization_id', organizationId)
        .eq('piece_id', pieceId)
        .eq('id', fileId)
        .select(FILE_COLUMNS)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      if (input.partLinks !== undefined) {
        const { error: deleteError } = await supabase
          .from('piece_file_part_links')
          .delete()
          .eq('organization_id', organizationId)
          .eq('piece_file_id', fileId);

        if (deleteError) {
          return null;
        }

        if (input.partLinks.length > 0) {
          const { error: linkError } = await supabase.from('piece_file_part_links').insert(
            input.partLinks.map((link) => ({
              organization_id: organizationId,
              piece_file_id: fileId,
              part_id: link.partId,
              part_division_id: link.partDivisionId,
            })),
          );

          if (linkError) {
            return null;
          }
        }
      }

      const linksByFile = await loadPartLinksForFiles(organizationId, [data.id]);

      return {
        ...mapFile(data),
        partLinks: linksByFile.get(data.id) ?? [],
      };
    },

    async reorderScores(organizationId, pieceId, orderedFileIds) {
      for (let index = 0; index < orderedFileIds.length; index += 1) {
        const fileId = orderedFileIds[index];
        if (!fileId) {
          continue;
        }
        const { error } = await supabase
          .from('piece_files')
          .update({ sort_order: index })
          .eq('organization_id', organizationId)
          .eq('piece_id', pieceId)
          .eq('id', fileId)
          .eq('kind', 'score');

        if (error) {
          throw new Error(error.message);
        }
      }

      return this.listForPiece(organizationId, pieceId);
    },

    async remove(organizationId, pieceId, fileId) {
      const existing = await this.getById(organizationId, pieceId, fileId);
      if (!existing) {
        return null;
      }

      const { error } = await supabase
        .from('piece_files')
        .delete()
        .eq('organization_id', organizationId)
        .eq('piece_id', pieceId)
        .eq('id', fileId);

      if (error) {
        throw new Error(error.message);
      }

      return existing;
    },
  };
}
