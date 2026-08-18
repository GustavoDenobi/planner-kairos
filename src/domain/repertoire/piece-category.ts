export type PieceCategory = {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  sortOrder: number;
  color: string | null;
};

export type PieceCategoryInput = {
  name: string;
  slug?: string;
  sortOrder?: number;
  color?: string | null;
};
