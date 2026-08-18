import type { CreatePieceFileInput, PieceFileRepository, UpdatePieceFileInput } from '@/application/ports/piece-file-repository';
import type { PieceFilePartLink, PieceFileWithLinks } from '@/domain/repertoire';
import { supabase } from './client';

const FILE_COLUMNS =
  'id, organization_id, piece_id, kind, storage_key, mime_type, title, original_name, byte_size, content_hash';

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

export function createPieceFileRepository(): PieceFileRepository {
  return {
    async listForPiece(organizationId, pieceId) {
      const { data, error } = await supabase
        .from('piece_files')
        .select(FILE_COLUMNS)
        .eq('organization_id', organizationId)
        .eq('piece_id', pieceId)
        .order('kind')
        .order('title');

      if (error || !data) {
        return [];
      }

      const linksByFile = await loadPartLinksForFiles(
        organizationId,
        data.map((row) => row.id),
      );

      return data.map((row) => ({
        ...mapFile(row),
        partLinks: linksByFile.get(row.id) ?? [],
      }));
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
      const { data, error } = await supabase
        .from('piece_files')
        .insert({
          organization_id: organizationId,
          piece_id: input.pieceId,
          kind: input.kind,
          storage_key: input.storageKey,
          mime_type: input.mimeType,
          title: input.title,
          original_name: input.originalName,
          byte_size: input.byteSize,
          content_hash: input.contentHash,
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
      const { data, error } = await supabase
        .from('piece_files')
        .update({ title: input.title })
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
