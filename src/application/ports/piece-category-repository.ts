import type { PieceCategory, PieceCategoryInput } from '@/domain/repertoire';

export type PieceCategoryRepository = {
  listForOrg(organizationId: string): Promise<PieceCategory[]>;
  create(organizationId: string, input: PieceCategoryInput): Promise<PieceCategory>;
  update(
    organizationId: string,
    categoryId: string,
    input: PieceCategoryInput,
  ): Promise<PieceCategory>;
  delete(organizationId: string, categoryId: string): Promise<void>;
  countPiecesUsingCategory(organizationId: string, categoryId: string): Promise<number>;
  reorderCategories(organizationId: string, orderedCategoryIds: string[]): Promise<void>;
};
