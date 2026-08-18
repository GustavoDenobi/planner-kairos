import type {
  CreatePdfAnnotationInput,
  PdfAnnotation,
  UpdatePdfAnnotationInput,
} from '@/domain/repertoire';

export type PieceFileAnnotationRepository = {
  listForFile(organizationId: string, pieceFileId: string): Promise<PdfAnnotation[]>;
  create(
    organizationId: string,
    authorUserId: string,
    input: CreatePdfAnnotationInput,
  ): Promise<PdfAnnotation>;
  update(
    organizationId: string,
    pieceFileId: string,
    annotationId: string,
    input: UpdatePdfAnnotationInput,
  ): Promise<PdfAnnotation | null>;
  remove(organizationId: string, pieceFileId: string, annotationId: string): Promise<boolean>;
};
