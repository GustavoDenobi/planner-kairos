import type { PieceFilePartLink } from './piece-file';
import type { EventKind, ProgramItemUnitDetail } from '@/domain/agenda';

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

export type ReadingPlaylistItemReferenceKind = 'page' | 'toc' | 'shortcut';

export type ReadingPlaylistItem = {
  id: string;
  playlistId: string;
  organizationId: string;
  pieceFileId: string;
  sortOrder: number;
  label: string | null;
  notes: string | null;
  referenceKind: ReadingPlaylistItemReferenceKind | null;
  startPage: number | null;
  endPage: number | null;
  pieceFileTocEntryId: string | null;
  navigationShortcutId: string | null;
  createdAt: string;
};

export type ReadingPlaylistItemDetail = ReadingPlaylistItem & {
  pieceId: string;
  pieceTitle: string;
  pieceDeleted: boolean;
  pieceCategory: ReadingPlaylistPieceCategory | null;
  fileTitle: string;
  partLinks: PieceFilePartLink[];
  pieceFileTocEntryTargetPage: number | null;
  pieceFileTocEntryEndPage: number | null;
  navigationShortcutTargetPage: number | null;
};

export type ReadingPlaylistDetail = ReadingPlaylist & {
  items: ReadingPlaylistItemDetail[];
};

export type CreateReadingPlaylistItemInput = {
  pieceFileId: string;
  label?: string | null;
  notes?: string | null;
  referenceKind?: ReadingPlaylistItemReferenceKind | null;
  startPage?: number | null;
  endPage?: number | null;
  pieceFileTocEntryId?: string | null;
  navigationShortcutId?: string | null;
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

export type PlaylistItemOpenPageSource = {
  referenceKind?: ReadingPlaylistItemReferenceKind | null;
  startPage?: number | null;
  pieceFileTocEntryId?: string | null;
  pieceFileTocEntryTargetPage?: number | null;
  navigationShortcutId?: string | null;
  navigationShortcutTargetPage?: number | null;
  notes?: string | null;
};

export type PlaylistItemPageLookup = {
  tocTargetPage?: number | null;
  shortcutTargetPage?: number | null;
};

function positivePage(page: number | null | undefined): number | null {
  return page != null && Number.isInteger(page) && page > 0 ? page : null;
}

export function resolvePlaylistItemOpenPage(
  item: PlaylistItemOpenPageSource,
  lookup?: PlaylistItemPageLookup,
): number | null {
  if (item.referenceKind === undefined) {
    return splitPlaylistItemNotes(item.notes).startPage;
  }

  if (item.referenceKind === 'toc') {
    if (!item.pieceFileTocEntryId) {
      return null;
    }
    return positivePage(lookup?.tocTargetPage ?? item.pieceFileTocEntryTargetPage);
  }

  if (item.referenceKind === 'shortcut') {
    if (!item.navigationShortcutId) {
      return null;
    }
    return positivePage(lookup?.shortcutTargetPage ?? item.navigationShortcutTargetPage);
  }

  if (item.referenceKind === 'page') {
    return positivePage(item.startPage);
  }

  return null;
}

export function playlistItemObservation(item: {
  referenceKind?: ReadingPlaylistItemReferenceKind | null;
  notes?: string | null;
} | null | undefined): string | null {
  if (!item) {
    return null;
  }
  if (item.referenceKind === undefined) {
    return splitPlaylistItemNotes(item.notes).observation;
  }
  const notes = item.notes?.trim() ?? '';
  return notes || null;
}

export function playlistReferenceFromProgramUnit(unit: ProgramItemUnitDetail): {
  referenceKind: ReadingPlaylistItemReferenceKind | null;
  startPage: number | null;
  endPage: number | null;
  pieceFileTocEntryId: string | null;
  navigationShortcutId: string | null;
  label: string | null;
} {
  if (unit.pieceFileTocEntryId) {
    return {
      referenceKind: 'toc',
      startPage: null,
      endPage: null,
      pieceFileTocEntryId: unit.pieceFileTocEntryId,
      navigationShortcutId: null,
      label: unit.pieceFileTocEntryLabel?.trim() || unit.label?.trim() || null,
    };
  }

  if (unit.navigationShortcutId) {
    return {
      referenceKind: 'shortcut',
      startPage: null,
      endPage: null,
      pieceFileTocEntryId: null,
      navigationShortcutId: unit.navigationShortcutId,
      label: unit.navigationShortcutLabel?.trim() || unit.label?.trim() || null,
    };
  }

  if (unit.startPage != null || unit.endPage != null) {
    return {
      referenceKind: 'page',
      startPage: unit.startPage,
      endPage: unit.endPage,
      pieceFileTocEntryId: null,
      navigationShortcutId: null,
      label: unit.label?.trim() || null,
    };
  }

  return {
    referenceKind: null,
    startPage: null,
    endPage: null,
    pieceFileTocEntryId: null,
    navigationShortcutId: null,
    label: unit.label?.trim() || null,
  };
}
