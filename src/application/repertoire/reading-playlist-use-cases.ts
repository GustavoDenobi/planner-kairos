import type { PieceFileRepository } from '@/application/ports/piece-file-repository';
import type { ReadingPlaylistRepository } from '@/application/ports/reading-playlist-repository';
import type {
  CreateReadingPlaylistInput,
  CreateReadingPlaylistItemInput,
  UpdateReadingPlaylistInput,
} from '@/domain/repertoire';
import {
  validateCreateReadingPlaylistInput,
  validateUpdateReadingPlaylistInput,
} from '@/domain/repertoire';
import { Result } from '@/domain/shared';

async function validatePlaylistFiles(
  fileRepo: PieceFileRepository,
  organizationId: string,
  items: CreateReadingPlaylistItemInput[],
): Promise<string | null> {
  for (const item of items) {
    const file = await fileRepo.getByFileId(organizationId, item.pieceFileId);
    if (!file) {
      return 'invalid_file';
    }
    if (file.kind !== 'score') {
      return 'invalid_file_kind';
    }
  }
  return null;
}

export async function listReadingPlaylists(
  playlistRepo: ReadingPlaylistRepository,
  organizationId: string,
  ownerUserId: string,
) {
  const playlists = await playlistRepo.listForUser(organizationId, ownerUserId);
  return Result.ok(playlists);
}

export async function getReadingPlaylist(
  playlistRepo: ReadingPlaylistRepository,
  organizationId: string,
  playlistId: string,
  ownerUserId: string,
) {
  const playlist = await playlistRepo.getDetail(organizationId, playlistId, ownerUserId);
  if (!playlist) {
    return Result.fail('not_found');
  }
  return Result.ok(playlist);
}

export async function createReadingPlaylist(
  fileRepo: PieceFileRepository,
  playlistRepo: ReadingPlaylistRepository,
  organizationId: string,
  ownerUserId: string,
  input: CreateReadingPlaylistInput,
) {
  const validationError = validateCreateReadingPlaylistInput(input);
  if (validationError) {
    return Result.fail(validationError);
  }

  const fileError = await validatePlaylistFiles(fileRepo, organizationId, input.items);
  if (fileError) {
    return Result.fail(fileError);
  }

  try {
    const playlist = await playlistRepo.create(organizationId, ownerUserId, input);
    return Result.ok(playlist);
  } catch {
    return Result.fail('create_failed');
  }
}

export async function updateReadingPlaylist(
  playlistRepo: ReadingPlaylistRepository,
  organizationId: string,
  playlistId: string,
  ownerUserId: string,
  input: UpdateReadingPlaylistInput,
) {
  const validationError = validateUpdateReadingPlaylistInput(input);
  if (validationError) {
    return Result.fail(validationError);
  }

  const updated = await playlistRepo.update(organizationId, playlistId, ownerUserId, input);
  if (!updated) {
    return Result.fail('not_found');
  }
  return Result.ok(updated);
}

export async function replaceReadingPlaylistItems(
  fileRepo: PieceFileRepository,
  playlistRepo: ReadingPlaylistRepository,
  organizationId: string,
  playlistId: string,
  ownerUserId: string,
  items: CreateReadingPlaylistItemInput[],
) {
  if (items.length === 0) {
    return Result.fail('empty_playlist');
  }

  for (const item of items) {
    if (!item.pieceFileId.trim()) {
      return Result.fail('invalid_file');
    }
  }

  const fileError = await validatePlaylistFiles(fileRepo, organizationId, items);
  if (fileError) {
    return Result.fail(fileError);
  }

  const updated = await playlistRepo.replaceItems(
    organizationId,
    playlistId,
    ownerUserId,
    items,
  );
  if (!updated) {
    return Result.fail('not_found');
  }
  return Result.ok(updated);
}

export async function deleteReadingPlaylist(
  playlistRepo: ReadingPlaylistRepository,
  organizationId: string,
  playlistId: string,
  ownerUserId: string,
) {
  const removed = await playlistRepo.remove(organizationId, playlistId, ownerUserId);
  if (!removed) {
    return Result.fail('delete_failed');
  }
  return Result.ok(undefined);
}
