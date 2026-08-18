import type { OfflineAnnotationStore } from '@/application/ports/offline-annotation-store';
import type { OfflineFileCache } from '@/application/ports/offline-file-cache';
import type { OfflinePlaylistCache } from '@/application/ports/offline-playlist-cache';
import type { FileStorage } from '@/application/ports/file-storage';
import type { PieceFileAnnotationRepository } from '@/application/ports/piece-file-annotation-repository';
import type { PieceFileRepository } from '@/application/ports/piece-file-repository';
import type { PieceRepository } from '@/application/ports/piece-repository';
import type { ReadingPlaylistRepository } from '@/application/ports/reading-playlist-repository';
import type { ReadingPlaylistDetail, ReadingPlaylistItemDetail } from '@/domain/repertoire';
import { Result } from '@/domain/shared';
import { cachePieceFileForOffline, isBrowserOnline } from './file-cache-use-cases';
import type { CachePlaylistProgress } from './types';

function isPlaylistItemAvailable(item: ReadingPlaylistItemDetail): boolean {
  return Boolean(item.pieceId) && !item.pieceDeleted;
}

export async function cacheReadingPlaylistForOffline(
  pieceRepo: PieceRepository,
  fileRepo: PieceFileRepository,
  fileStorage: FileStorage,
  fileCache: OfflineFileCache,
  playlistRepo: ReadingPlaylistRepository,
  playlistCache: OfflinePlaylistCache,
  annotationRepo: PieceFileAnnotationRepository,
  annotationStore: OfflineAnnotationStore,
  organizationId: string,
  playlistId: string,
  userId: string,
  onProgress?: (progress: CachePlaylistProgress) => void,
): Promise<Result<CachePlaylistProgress, string>> {
  if (!isBrowserOnline()) {
    return Result.fail('offline');
  }

  const playlist = await playlistRepo.getDetail(organizationId, playlistId, userId);
  if (!playlist) {
    return Result.fail('not_found');
  }

  const availableItems = playlist.items.filter(isPlaylistItemAvailable);
  const progress: CachePlaylistProgress = { done: 0, total: availableItems.length, errors: [] };

  for (const item of availableItems) {
    if (!item.pieceId) {
      progress.done += 1;
      onProgress?.({ ...progress });
      continue;
    }

    const fileResult = await cachePieceFileForOffline(
      pieceRepo,
      fileRepo,
      fileStorage,
      fileCache,
      organizationId,
      item.pieceId,
      item.pieceFileId,
    );

    if (!fileResult.ok) {
      progress.errors.push(`${item.fileTitle}: ${fileResult.error}`);
    } else {
      const annotations = await annotationRepo.listForFile(organizationId, item.pieceFileId);
      for (const annotation of annotations) {
        await annotationStore.upsert({
          clientId: annotation.id,
          id: annotation.id,
          organizationId: annotation.organizationId,
          pieceFileId: annotation.pieceFileId,
          pageNumber: annotation.pageNumber,
          layer: annotation.layer,
          type: annotation.type,
          geometry: annotation.geometry,
          color: annotation.color,
          authorUserId: annotation.authorUserId,
          sectionId: annotation.sectionId,
          createdAt: annotation.createdAt,
          updatedAt: annotation.updatedAt,
          syncStatus: 'synced',
        });
      }
    }

    progress.done += 1;
    onProgress?.({ ...progress });
  }

  await playlistCache.put({
    playlistId: playlist.id,
    organizationId: playlist.organizationId,
    ownerUserId: playlist.ownerUserId,
    name: playlist.name,
    pieceFileIds: availableItems.map((item) => item.pieceFileId),
    snapshotJson: JSON.stringify(playlist),
    cachedAt: new Date().toISOString(),
  });

  return Result.ok(progress);
}

export async function getCachedReadingPlaylist(
  playlistCache: OfflinePlaylistCache,
  playlistId: string,
): Promise<ReadingPlaylistDetail | null> {
  const cached = await playlistCache.get(playlistId);
  if (!cached) {
    return null;
  }
  return JSON.parse(cached.snapshotJson) as ReadingPlaylistDetail;
}

export async function removeCachedPlaylist(
  playlistCache: OfflinePlaylistCache,
  fileCache: OfflineFileCache,
  playlistId: string,
): Promise<void> {
  const cached = await playlistCache.get(playlistId);
  if (cached) {
    for (const pieceFileId of cached.pieceFileIds) {
      await fileCache.remove(pieceFileId);
    }
  }
  await playlistCache.remove(playlistId);
}

export async function syncPendingOfflineChanges(
  annotationRepo: PieceFileAnnotationRepository,
  annotationStore: OfflineAnnotationStore,
): Promise<{ synced: number; failed: number }> {
  if (!isBrowserOnline()) {
    return { synced: 0, failed: 0 };
  }

  const outbox = await annotationStore.listOutbox();
  let synced = 0;
  let failed = 0;

  for (const item of outbox) {
    try {
      if (item.op === 'create') {
        const payload = item.payload as {
          clientId: string;
          organizationId: string;
          authorUserId: string;
          input: import('@/domain/repertoire').CreatePdfAnnotationInput;
        };
        const created = await annotationRepo.create(
          payload.organizationId,
          payload.authorUserId,
          payload.input,
        );
        await annotationStore.replaceClientId(
          payload.clientId,
          created.id,
          created.updatedAt,
        );
        await annotationStore.removeOutbox(item.id);
        synced += 1;
      } else if (item.op === 'delete') {
        const payload = item.payload as {
          organizationId: string;
          pieceFileId: string;
          annotationId: string;
        };
        await annotationRepo.remove(
          payload.organizationId,
          payload.pieceFileId,
          payload.annotationId,
        );
        await annotationStore.removeOutbox(item.id);
        synced += 1;
      }
    } catch {
      await annotationStore.incrementOutboxRetry(item.id);
      failed += 1;
    }
  }

  return { synced, failed };
}
