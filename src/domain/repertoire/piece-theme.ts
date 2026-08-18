export type PieceTheme = {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  sortOrder: number;
};

export type PieceThemeInput = {
  name: string;
  slug?: string;
  sortOrder?: number;
};
