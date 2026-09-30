import type { ReadingPlaylistRepository } from '@/application/ports/reading-playlist-repository';
import type {
  CreateReadingPlaylistInput,
  CreateReadingPlaylistItemInput,
  PieceFilePartLink,
  ReadingPlaylist,
  ReadingPlaylistItemDetail,
  UpdateReadingPlaylistInput,
} from '@/domain/repertoire';
import { isEventSourcedPlaylistExpired } from '@/domain/repertoire';
import type { EventKind } from '@/domain/agenda';
import { supabase } from './client';

const PLAYLIST_COLUMNS =
  'id, organization_id, owner_user_id, name, source_event_id, archived_at, created_at, updated_at';

const ITEM_COLUMNS =
  'id, organization_id, playlist_id, piece_file_id, sort_order, label, notes, reference_kind, start_page, end_page, piece_file_toc_entry_id, navigation_shortcut_id, created_at';

type TocRelation = {
  target_page_number: number;
  end_page_number: number | null;
};

type ShortcutRelation = {
  target_page_number: number;
};

type ItemRow = {
  id: string;
  organization_id: string;
  playlist_id: string;
  piece_file_id: string;
  sort_order: number;
  label: string | null;
  notes: string | null;
  reference_kind: 'page' | 'toc' | 'shortcut' | null;
  start_page: number | null;
  end_page: number | null;
  piece_file_toc_entry_id: string | null;
  navigation_shortcut_id: string | null;
  created_at: string;
  piece_file_toc_entries: TocRelation | TocRelation[] | null;
  piece_file_navigation_shortcuts: ShortcutRelation | ShortcutRelation[] | null;
  piece_files: {
    title: string;
    piece_id: string;
    pieces: {
      title: string;
      deleted_at: string | null;
      piece_categories: { name: string; slug: string; color: string | null } | null;
    } | null;
  } | null;
};

function mapPlaylist(row: {
  id: string;
  organization_id: string;
  owner_user_id: string;
  name: string;
  source_event_id: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}): ReadingPlaylist {
  return {
    id: row.id,
    organizationId: row.organization_id,
    ownerUserId: row.owner_user_id,
    name: row.name,
    sourceEventId: row.source_event_id,
    sourceEventKind: null,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type EventSourceRow = {
  id?: string;
  starts_at: string;
  ends_at: string | null;
  event_types: { kind: EventKind } | { kind: EventKind }[] | null;
};

function eventKindFromRow(row: EventSourceRow): EventKind | null {
  if (!row.event_types) {
    return null;
  }
  const eventType = Array.isArray(row.event_types) ? row.event_types[0] : row.event_types;
  return eventType?.kind ?? null;
}

async function markPlaylistsArchived(ids: string[]): Promise<void> {
  if (ids.length === 0) {
    return;
  }

  await supabase
    .from('reading_playlists')
    .update({ archived_at: new Date().toISOString() })
    .in('id', ids);
}

async function activePlaylistOrArchive(playlist: ReadingPlaylist): Promise<ReadingPlaylist | null> {
  if (playlist.archivedAt) {
    return null;
  }
  if (!playlist.sourceEventId) {
    return playlist;
  }

  const { data, error } = await supabase
    .from('events')
    .select('starts_at, ends_at')
    .eq('id', playlist.sourceEventId)
    .maybeSingle();

  if (error || !data || isEventSourcedPlaylistExpired(data.starts_at, data.ends_at)) {
    await markPlaylistsArchived([playlist.id]);
    return null;
  }

  return playlist;
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? value[0] ?? null : value;
}

function itemInsertRow(
  organizationId: string,
  playlistId: string,
  item: CreateReadingPlaylistItemInput,
  index: number,
) {
  const kind = item.referenceKind ?? null;
  return {
    organization_id: organizationId,
    playlist_id: playlistId,
    piece_file_id: item.pieceFileId,
    sort_order: index,
    label: item.label?.trim() || null,
    notes: item.notes?.trim() || null,
    reference_kind: kind,
    start_page: kind === 'page' ? item.startPage ?? null : null,
    end_page: kind === 'page' ? item.endPage ?? null : null,
    piece_file_toc_entry_id: kind === 'toc' ? item.pieceFileTocEntryId ?? null : null,
    navigation_shortcut_id: kind === 'shortcut' ? item.navigationShortcutId ?? null : null,
  };
}

function mapItemDetail(row: ItemRow, partLinks: PieceFilePartLink[]): ReadingPlaylistItemDetail {
  const file = row.piece_files;
  const piece = file?.pieces;
  const category = piece?.piece_categories;
  const tocEntry = firstRelation(row.piece_file_toc_entries);
  const shortcut = firstRelation(row.piece_file_navigation_shortcuts);

  return {
    id: row.id,
    playlistId: row.playlist_id,
    organizationId: row.organization_id,
    pieceFileId: row.piece_file_id,
    sortOrder: row.sort_order,
    label: row.label,
    notes: row.notes,
    referenceKind: row.reference_kind,
    startPage: row.start_page,
    endPage: row.end_page,
    pieceFileTocEntryId: row.piece_file_toc_entry_id,
    navigationShortcutId: row.navigation_shortcut_id,
    createdAt: row.created_at,
    pieceId: file?.piece_id ?? '',
    pieceTitle: piece?.title ?? 'Obra desconhecida',
    pieceDeleted: piece?.deleted_at !== null,
    pieceCategory: category
      ? { name: category.name, slug: category.slug, color: category.color }
      : null,
    fileTitle: file?.title ?? 'Arquivo indisponível',
    partLinks,
    pieceFileTocEntryTargetPage: tocEntry?.target_page_number ?? null,
    pieceFileTocEntryEndPage: tocEntry?.end_page_number ?? null,
    navigationShortcutTargetPage: shortcut?.target_page_number ?? null,
  };
}

async function loadPartLinksForFiles(
  organizationId: string,
  fileIds: string[],
): Promise<Map<string, PieceFilePartLink[]>> {
  const linksByFile = new Map<string, PieceFilePartLink[]>();

  if (fileIds.length === 0) {
    return linksByFile;
  }

  const { data, error } = await supabase
    .from('piece_file_part_links')
    .select('piece_file_id, part_id, part_division_id')
    .eq('organization_id', organizationId)
    .in('piece_file_id', fileIds);

  if (error || !data) {
    return linksByFile;
  }

  for (const row of data) {
    const list = linksByFile.get(row.piece_file_id) ?? [];
    list.push({ partId: row.part_id, partDivisionId: row.part_division_id });
    linksByFile.set(row.piece_file_id, list);
  }

  return linksByFile;
}

async function loadItemsForPlaylist(
  playlistId: string,
  organizationId: string,
): Promise<ReadingPlaylistItemDetail[]> {
  const { data, error } = await supabase
    .from('reading_playlist_items')
    .select(
      `${ITEM_COLUMNS}, piece_file_toc_entries (target_page_number, end_page_number), piece_file_navigation_shortcuts (target_page_number), piece_files (title, piece_id, pieces (title, deleted_at, piece_categories (name, slug, color)))`,
    )
    .eq('playlist_id', playlistId)
    .order('sort_order');

  if (error || !data) {
    return [];
  }

  const rows = data as unknown as ItemRow[];
  const linksByFile = await loadPartLinksForFiles(
    organizationId,
    rows.map((row) => row.piece_file_id),
  );

  return rows.map((row) => mapItemDetail(row, linksByFile.get(row.piece_file_id) ?? []));
}

async function getPlaylistForOwner(
  organizationId: string,
  playlistId: string,
  ownerUserId: string,
): Promise<ReadingPlaylist | null> {
  const { data, error } = await supabase
    .from('reading_playlists')
    .select(PLAYLIST_COLUMNS)
    .eq('organization_id', organizationId)
    .eq('id', playlistId)
    .eq('owner_user_id', ownerUserId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const playlist = mapPlaylist(data);
  if (playlist.archivedAt) {
    return null;
  }

  return playlist;
}

export function createReadingPlaylistRepository(): ReadingPlaylistRepository {
  return {
    async listForUser(organizationId, ownerUserId) {
      const { data, error } = await supabase
        .from('reading_playlists')
        .select(PLAYLIST_COLUMNS)
        .eq('organization_id', organizationId)
        .eq('owner_user_id', ownerUserId)
        .is('archived_at', null)
        .order('updated_at', { ascending: false });

      if (error || !data) {
        return [];
      }

      const eventIds = [
        ...new Set(
          data
            .map((row) => row.source_event_id)
            .filter((id): id is string => Boolean(id)),
        ),
      ];

      const eventById = new Map<string, EventSourceRow>();
      if (eventIds.length > 0) {
        const { data: events } = await supabase
          .from('events')
          .select('id, starts_at, ends_at, event_types (kind)')
          .in('id', eventIds);

        for (const event of events ?? []) {
          eventById.set(event.id, event);
        }
      }

      const now = new Date();
      const active: ReadingPlaylist[] = [];
      const expiredIds: string[] = [];

      for (const row of data) {
        const playlist = mapPlaylist(row);
        if (!playlist.sourceEventId) {
          active.push(playlist);
          continue;
        }

        const event = eventById.get(playlist.sourceEventId);
        if (!event || isEventSourcedPlaylistExpired(event.starts_at, event.ends_at, now)) {
          expiredIds.push(playlist.id);
          continue;
        }

        active.push({
          ...playlist,
          sourceEventKind: eventKindFromRow(event),
        });
      }

      await markPlaylistsArchived(expiredIds);
      return active;
    },

    async getDetail(organizationId, playlistId, ownerUserId) {
      const playlist = await getPlaylistForOwner(organizationId, playlistId, ownerUserId);
      if (!playlist) {
        return null;
      }

      const active = await activePlaylistOrArchive(playlist);
      if (!active) {
        return null;
      }

      const items = await loadItemsForPlaylist(playlistId, organizationId);
      return { ...active, items };
    },

    async create(organizationId, ownerUserId, input: CreateReadingPlaylistInput) {
      const { data, error } = await supabase
        .from('reading_playlists')
        .insert({
          organization_id: organizationId,
          owner_user_id: ownerUserId,
          name: input.name.trim(),
          source_event_id: input.sourceEventId ?? null,
        })
        .select(PLAYLIST_COLUMNS)
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'create_failed');
      }

      const playlist = mapPlaylist(data);

      if (input.items.length > 0) {
        const { error: itemsError } = await supabase.from('reading_playlist_items').insert(
          input.items.map((item, index) => itemInsertRow(organizationId, playlist.id, item, index)),
        );

        if (itemsError) {
          throw new Error(itemsError.message);
        }
      }

      const items = await loadItemsForPlaylist(playlist.id, organizationId);
      return { ...playlist, items };
    },

    async update(organizationId, playlistId, ownerUserId, input: UpdateReadingPlaylistInput) {
      const existing = await getPlaylistForOwner(organizationId, playlistId, ownerUserId);
      if (!existing) {
        return null;
      }

      const active = await activePlaylistOrArchive(existing);
      if (!active) {
        return null;
      }

      const patch: {
        name?: string;
        source_event_id?: string | null;
      } = {};

      if (input.name !== undefined) {
        patch.name = input.name.trim();
      }
      if (input.sourceEventId !== undefined) {
        patch.source_event_id = input.sourceEventId;
      }

      if (Object.keys(patch).length === 0) {
        const items = await loadItemsForPlaylist(playlistId, organizationId);
        return { ...active, items };
      }

      const { data, error } = await supabase
        .from('reading_playlists')
        .update(patch)
        .eq('organization_id', organizationId)
        .eq('id', playlistId)
        .eq('owner_user_id', ownerUserId)
        .select(PLAYLIST_COLUMNS)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      const items = await loadItemsForPlaylist(playlistId, organizationId);
      return { ...mapPlaylist(data), items };
    },

    async replaceItems(
      organizationId,
      playlistId,
      ownerUserId,
      items: CreateReadingPlaylistItemInput[],
    ) {
      const existing = await getPlaylistForOwner(organizationId, playlistId, ownerUserId);
      if (!existing) {
        return null;
      }

      const active = await activePlaylistOrArchive(existing);
      if (!active) {
        return null;
      }

      const { error: deleteError } = await supabase
        .from('reading_playlist_items')
        .delete()
        .eq('organization_id', organizationId)
        .eq('playlist_id', playlistId);

      if (deleteError) {
        return null;
      }

      if (items.length > 0) {
        const { error: insertError } = await supabase.from('reading_playlist_items').insert(
          items.map((item, index) => itemInsertRow(organizationId, playlistId, item, index)),
        );

        if (insertError) {
          return null;
        }
      }

      const loadedItems = await loadItemsForPlaylist(playlistId, organizationId);
      return { ...active, items: loadedItems };
    },

    async remove(organizationId, playlistId, ownerUserId) {
      const { error } = await supabase
        .from('reading_playlists')
        .delete()
        .eq('organization_id', organizationId)
        .eq('id', playlistId)
        .eq('owner_user_id', ownerUserId);

      return !error;
    },
  };
}
