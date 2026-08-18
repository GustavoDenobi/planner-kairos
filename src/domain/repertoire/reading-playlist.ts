import type { PieceFilePartLink } from './piece-file';
import type { EventKind } from '@/domain/agenda';

export type ReadingPlaylistPieceCategory = {
  name: string;
  slug: string;
  color: string | null;
};

export type ReadingPlaylist = {
  id: string;
  organizationId: string;
  ownerUserId: string;
  name: string;
  sourceEventId: string | null;
  sourceEventKind: EventKind | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReadingPlaylistItem = {
  id: string;
  playlistId: string;
  organizationId: string;
  pieceFileId: string;
  sortOrder: number;
  label: string | null;
  notes: string | null;
  createdAt: string;
};

export type ReadingPlaylistItemDetail = ReadingPlaylistItem & {
  pieceId: string;
  pieceTitle: string;
  pieceDeleted: boolean;
  pieceCategory: ReadingPlaylistPieceCategory | null;
  fileTitle: string;
  partLinks: PieceFilePartLink[];
};

export type ReadingPlaylistDetail = ReadingPlaylist & {
  items: ReadingPlaylistItemDetail[];
};

export type CreateReadingPlaylistItemInput = {
  pieceFileId: string;
  label?: string | null;
  notes?: string | null;
};

export type CreateReadingPlaylistInput = {
  name: string;
  sourceEventId?: string | null;
  items: CreateReadingPlaylistItemInput[];
};

export type UpdateReadingPlaylistInput = {
  name?: string;
  sourceEventId?: string | null;
};
