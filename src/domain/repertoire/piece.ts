import type { GroupKind } from '@/domain/ensemble';
import type { PieceCategory } from './piece-category';
import type { PieceFileWithLinks } from './piece-file';
import type { PieceTheme } from './piece-theme';

export type PieceFileAccessScope = 'own_parts' | 'all_files';

export type PieceAudienceGroup = {
  id: string;
  name: string;
  kind: GroupKind;
};

export type PieceAudienceMusician = {
  id: string;
  fullName: string;
  userId: string | null;
};

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

export type PieceFileAccessSettingsInput = {
  fileAccessScope: PieceFileAccessScope | null;
  allowFileDownload: boolean | null;
  audioAccessScope: PieceFileAccessScope | null;
  audioAllowDownload: boolean | null;
};

export type PieceAccessInput = PieceFileAccessSettingsInput & {
  groupIds?: string[];
  musicianIds?: string[];
};

export type PieceDetail = Piece & {
  category: PieceCategory;
  themes: PieceTheme[];
  files: PieceFileWithLinks[];
  fileAccessScope: PieceFileAccessScope | null;
  allowFileDownload: boolean | null;
  audioAccessScope: PieceFileAccessScope | null;
  audioAllowDownload: boolean | null;
  groups: PieceAudienceGroup[];
  musicians: PieceAudienceMusician[];
};
