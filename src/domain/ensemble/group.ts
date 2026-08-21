import type { PieceFileAccessScope } from '@/domain/repertoire/piece';

export type GroupKind = 'ensemble' | 'choir' | 'class' | 'other';

export type GroupFileAccessSettings = {
  fileAccessScope: PieceFileAccessScope;
  allowFileDownload: boolean;
  allowPieceAccessOverride: boolean;
};

export type Group = {
  id: string;
  organizationId: string;
  name: string;
  kind: GroupKind;
  notes: string | null;
  archivedAt: Date | null;
  sortOrder: number;
} & GroupFileAccessSettings;

export type GroupListItem = Group & {
  memberCount: number;
};
