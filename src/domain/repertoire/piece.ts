import type { PieceCategory } from './piece-category';
import type { PieceFileWithLinks } from './piece-file';
import type { PieceTheme } from './piece-theme';

export type Piece = {
  id: string;
  organizationId: string;
  title: string;
  categoryId: string;
  composer: string | null;
  description: string | null;
  notes: string | null;
  aliases: string[];
  deletedAt: string | null;
};

export type PieceInput = {
  title: string;
  categoryId: string;
  composer?: string | null;
  description?: string | null;
  notes?: string | null;
  aliases?: string[];
  themeIds?: string[];
};

export type PieceListItem = {
  id: string;
  title: string;
  composer: string | null;
  aliases: string[];
  category: Pick<PieceCategory, 'id' | 'name' | 'slug' | 'color'>;
  themeIds: string[];
};

export type PieceDetail = Piece & {
  category: PieceCategory;
  themes: PieceTheme[];
  files: PieceFileWithLinks[];
};
