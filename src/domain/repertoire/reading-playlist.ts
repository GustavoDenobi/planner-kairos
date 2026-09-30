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

const OPEN_AT_PAGE_NOTE = /^(.*?)(?:\s*·\s*)?Abrir na p\.\s*(\d+)\s*$/i;

export function splitPlaylistItemNotes(notes: string | null | undefined): {
  observation: string | null;
  startPage: number | null;
} {
  const trimmed = notes?.trim() ?? '';
  if (!trimmed) {
    return { observation: null, startPage: null };
  }

  const match = trimmed.match(OPEN_AT_PAGE_NOTE);
  if (!match) {
    return { observation: trimmed, startPage: null };
  }

  const observation = match[1]?.trim() || null;
  const page = Number.parseInt(match[2] ?? '', 10);
  return {
    observation,
    startPage: Number.isInteger(page) && page > 0 ? page : null,
  };
}
