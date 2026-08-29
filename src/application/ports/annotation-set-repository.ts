import type {
  AnnotationSet,
  CreateAnnotationSetInput,
  UpdateAnnotationSetInput,
} from '@/domain/repertoire';

export type AnnotationSetRepository = {
  listForFile(organizationId: string, pieceFileId: string): Promise<AnnotationSet[]>;
  getById(organizationId: string, setId: string): Promise<AnnotationSet | null>;
  create(
    organizationId: string,
    authorUserId: string,
    input: CreateAnnotationSetInput,
  ): Promise<AnnotationSet>;
  update(
    organizationId: string,
    setId: string,
    input: UpdateAnnotationSetInput,
  ): Promise<AnnotationSet | null>;
  remove(organizationId: string, setId: string): Promise<boolean>;
};
