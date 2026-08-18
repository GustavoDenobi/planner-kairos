import type { PieceFileAnnotationRepository } from '@/application/ports/piece-file-annotation-repository';
import type { AnnotationGeometry, PdfAnnotation, UpdatePdfAnnotationInput } from '@/domain/repertoire';
import { supabase } from './client';

const ANNOTATION_COLUMNS =
  'id, organization_id, piece_file_id, page_number, layer, type, geometry, color, author_user_id, section_id, created_at, updated_at';

function mapAnnotation(row: {
  id: string;
  organization_id: string;
  piece_file_id: string;
  page_number: number;
  layer: PdfAnnotation['layer'];
  type: PdfAnnotation['type'];
  geometry: AnnotationGeometry;
  color: string;
  author_user_id: string;
  section_id: string | null;
  created_at: string;
  updated_at: string;
}): PdfAnnotation {
  return {
    id: row.id,
    organizationId: row.organization_id,
    pieceFileId: row.piece_file_id,
    pageNumber: row.page_number,
    layer: row.layer,
    type: row.type,
    geometry: row.geometry,
    color: row.color,
    authorUserId: row.author_user_id,
    sectionId: row.section_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createPieceFileAnnotationRepository(): PieceFileAnnotationRepository {
  return {
    async listForFile(organizationId, pieceFileId) {
      const { data, error } = await supabase
        .from('piece_file_annotations')
        .select(ANNOTATION_COLUMNS)
        .eq('organization_id', organizationId)
        .eq('piece_file_id', pieceFileId)
        .order('page_number')
        .order('created_at');

      if (error || !data) {
        return [];
      }

      return data.map((row) =>
        mapAnnotation(row as Parameters<typeof mapAnnotation>[0]),
      );
    },

    async create(organizationId, authorUserId, input) {
      const { data, error } = await supabase
        .from('piece_file_annotations')
        .insert({
          organization_id: organizationId,
          piece_file_id: input.pieceFileId,
          page_number: input.pageNumber,
          layer: input.layer,
          type: input.type,
          geometry: input.geometry,
          color: input.color,
          author_user_id: authorUserId,
          section_id: input.sectionId ?? null,
        })
        .select(ANNOTATION_COLUMNS)
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'create_failed');
      }

      return mapAnnotation(data as Parameters<typeof mapAnnotation>[0]);
    },

    async update(organizationId, pieceFileId, annotationId, input: UpdatePdfAnnotationInput) {
      const patch: {
        geometry?: AnnotationGeometry;
        color?: string;
      } = {};
      if (input.geometry !== undefined) {
        patch.geometry = input.geometry;
      }
      if (input.color !== undefined) {
        patch.color = input.color;
      }

      if (Object.keys(patch).length === 0) {
        const { data, error } = await supabase
          .from('piece_file_annotations')
          .select(ANNOTATION_COLUMNS)
          .eq('organization_id', organizationId)
          .eq('piece_file_id', pieceFileId)
          .eq('id', annotationId)
          .maybeSingle();

        if (error || !data) {
          return null;
        }

        return mapAnnotation(data as Parameters<typeof mapAnnotation>[0]);
      }

      const { data, error } = await supabase
        .from('piece_file_annotations')
        .update(patch)
        .eq('organization_id', organizationId)
        .eq('piece_file_id', pieceFileId)
        .eq('id', annotationId)
        .select(ANNOTATION_COLUMNS)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return mapAnnotation(data as Parameters<typeof mapAnnotation>[0]);
    },

    async remove(organizationId, pieceFileId, annotationId) {
      const { error } = await supabase
        .from('piece_file_annotations')
        .delete()
        .eq('organization_id', organizationId)
        .eq('piece_file_id', pieceFileId)
        .eq('id', annotationId);

      return !error;
    },
  };
}
