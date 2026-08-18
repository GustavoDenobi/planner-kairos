import type { PieceDetail, PieceInput, PieceListItem } from '@/domain/repertoire';

export type SearchPiecesOptions = {
  query?: string;
  categoryId?: string;
  themeIds?: string[];
  accessibleForPartId?: string;
};

export type PieceRepository = {
  search(organizationId: string, options?: SearchPiecesOptions): Promise<PieceListItem[]>;
  getById(organizationId: string, pieceId: string): Promise<PieceDetail | null>;
  create(organizationId: string, input: PieceInput): Promise<PieceDetail>;
  update(organizationId: string, pieceId: string, input: PieceInput): Promise<PieceDetail>;
  softDelete(organizationId: string, pieceId: string): Promise<void>;
  setThemeLinks(organizationId: string, pieceId: string, themeIds: string[]): Promise<void>;
};
