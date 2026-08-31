import type { OfflineAnnotationStore } from '@/application/ports/offline-annotation-store';
import type { OfflineNavigationShortcutStore } from '@/application/ports/offline-navigation-shortcut-store';
import type { OfflineTocEntryStore } from '@/application/ports/offline-toc-entry-store';
import type { OfflineFileCache } from '@/application/ports/offline-file-cache';
import type { OfflinePlaylistCache } from '@/application/ports/offline-playlist-cache';
import type { FileStorage } from '@/application/ports/file-storage';
import type { PieceFileAnnotationRepository } from '@/application/ports/piece-file-annotation-repository';
import type { PieceFileNavigationShortcutRepository } from '@/application/ports/piece-file-navigation-shortcut-repository';
import type { PieceFileTocEntryRepository } from '@/application/ports/piece-file-toc-entry-repository';
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

async function referencedPieceFileIds(
  playlistCache: OfflinePlaylistCache,
  organizationId: string,
): Promise<Set<string>> {
  const playlists = await playlistCache.listForOrganization(organizationId);
  const ids = new Set<string>();
  for (const playlist of playlists) {
    for (const pieceFileId of playlist.pieceFileIds) {
      ids.add(pieceFileId);
    }
  }
  return ids;
}

async function removeUnreferencedFiles(
  playlistCache: OfflinePlaylistCache,
  fileCache: OfflineFileCache,
  organizationId: string,
  candidateFileIds: string[],
): Promise<void> {
  const referenced = await referencedPieceFileIds(playlistCache, organizationId);
  for (const pieceFileId of candidateFileIds) {
    if (!referenced.has(pieceFileId)) {
      await fileCache.remove(pieceFileId);
    }
  }
}

async function cacheAnnotationsShortcutsAndTocForFile(
  annotationRepo: PieceFileAnnotationRepository,
  annotationStore: OfflineAnnotationStore,
  setRepo: import('@/application/ports/annotation-set-repository').AnnotationSetRepository,
  navigationShortcutRepo: PieceFileNavigationShortcutRepository,
  navigationShortcutStore: OfflineNavigationShortcutStore,
  tocRepo: PieceFileTocEntryRepository,
  tocStore: OfflineTocEntryStore,
  organizationId: string,
  pieceFileId: string,
): Promise<void> {
  const annotations = await annotationRepo.listForFile(organizationId, pieceFileId);
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
      annotationSetId: annotation.annotationSetId,
      createdAt: annotation.createdAt,
      updatedAt: annotation.updatedAt,
      syncStatus: 'synced',
    });
  }

  const sets = await setRepo.listForFile(organizationId, pieceFileId);
  for (const set of sets) {
    await annotationStore.upsertSet({
      id: set.id,
      organizationId: set.organizationId,
      pieceFileId: set.pieceFileId,
      authorUserId: set.authorUserId,
      title: set.title,
      groups: set.groups,
      musicians: set.musicians,
      createdAt: set.createdAt,
      updatedAt: set.updatedAt,
      syncStatus: 'synced',
    });
  }

  const shortcuts = await navigationShortcutRepo.listForFile(organizationId, pieceFileId);
  for (const shortcut of shortcuts) {
    await navigationShortcutStore.upsert({
      clientId: shortcut.id,
      ...shortcut,
      syncStatus: 'synced',
    });
  }

  const tocEntries = await tocRepo.listForFile(organizationId, pieceFileId);
  for (const entry of tocEntries) {
    await tocStore.upsert({
      clientId: entry.id,
      ...entry,
      syncStatus: 'synced',
    });
  }
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
  setRepo: import('@/application/ports/annotation-set-repository').AnnotationSetRepository,
  navigationShortcutRepo: PieceFileNavigationShortcutRepository,
  navigationShortcutStore: OfflineNavigationShortcutStore,
  tocRepo: PieceFileTocEntryRepository,
  tocStore: OfflineTocEntryStore,
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

  const previous = await playlistCache.get(playlistId);
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
      await cacheAnnotationsShortcutsAndTocForFile(
        annotationRepo,
        annotationStore,
        setRepo,
        navigationShortcutRepo,
        navigationShortcutStore,
        tocRepo,
        tocStore,
        organizationId,
        item.pieceFileId,
      );
    }

    progress.done += 1;
    onProgress?.({ ...progress });
  }

  const pieceFileIds = availableItems.map((item) => item.pieceFileId);

  await playlistCache.put({
    playlistId: playlist.id,
    organizationId: playlist.organizationId,
    ownerUserId: playlist.ownerUserId,
    name: playlist.name,
    pieceFileIds,
    snapshotJson: JSON.stringify(playlist),
    cachedAt: new Date().toISOString(),
  });

  if (previous) {
    await removeUnreferencedFiles(
      playlistCache,
      fileCache,
      playlist.organizationId,
      previous.pieceFileIds,
    );
  }

  return Result.ok(progress);
}

const inflightUserPlaylistCaches = new Map<
  string,
  Promise<Result<CachePlaylistProgress, string>>
>();

export async function cacheUserReadingPlaylistsForOffline(
  pieceRepo: PieceRepository,
  fileRepo: PieceFileRepository,
  fileStorage: FileStorage,
  fileCache: OfflineFileCache,
  playlistRepo: ReadingPlaylistRepository,
  playlistCache: OfflinePlaylistCache,
  annotationRepo: PieceFileAnnotationRepository,
  annotationStore: OfflineAnnotationStore,
  setRepo: import('@/application/ports/annotation-set-repository').AnnotationSetRepository,
  navigationShortcutRepo: PieceFileNavigationShortcutRepository,
  navigationShortcutStore: OfflineNavigationShortcutStore,
  tocRepo: PieceFileTocEntryRepository,
  tocStore: OfflineTocEntryStore,
  organizationId: string,
  userId: string,
  onProgress?: (progress: CachePlaylistProgress) => void,
): Promise<Result<CachePlaylistProgress, string>> {
  const cacheKey = `${organizationId}:${userId}`;
  const inflight = inflightUserPlaylistCaches.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const task = cacheUserReadingPlaylistsForOfflineOnce(
    pieceRepo,
    fileRepo,
    fileStorage,
    fileCache,
    playlistRepo,
    playlistCache,
    annotationRepo,
    annotationStore,
    setRepo,
    navigationShortcutRepo,
    navigationShortcutStore,
    tocRepo,
    tocStore,
    organizationId,
    userId,
    onProgress,
  );
  inflightUserPlaylistCaches.set(cacheKey, task);
  try {
    return await task;
  } finally {
    if (inflightUserPlaylistCaches.get(cacheKey) === task) {
      inflightUserPlaylistCaches.delete(cacheKey);
    }
  }
}

async function cacheUserReadingPlaylistsForOfflineOnce(
  pieceRepo: PieceRepository,
  fileRepo: PieceFileRepository,
  fileStorage: FileStorage,
  fileCache: OfflineFileCache,
  playlistRepo: ReadingPlaylistRepository,
  playlistCache: OfflinePlaylistCache,
  annotationRepo: PieceFileAnnotationRepository,
  annotationStore: OfflineAnnotationStore,
  setRepo: import('@/application/ports/annotation-set-repository').AnnotationSetRepository,
  navigationShortcutRepo: PieceFileNavigationShortcutRepository,
  navigationShortcutStore: OfflineNavigationShortcutStore,
  tocRepo: PieceFileTocEntryRepository,
  tocStore: OfflineTocEntryStore,
  organizationId: string,
  userId: string,
  onProgress?: (progress: CachePlaylistProgress) => void,
): Promise<Result<CachePlaylistProgress, string>> {
  if (!isBrowserOnline()) {
    return Result.fail('offline');
  }

  const playlists = await playlistRepo.listForUser(organizationId, userId);
  const cached = await playlistCache.listForOrganization(organizationId);
  const activeIds = new Set(playlists.map((playlist) => playlist.id));

  for (const snapshot of cached) {
    if (snapshot.ownerUserId === userId && !activeIds.has(snapshot.playlistId)) {
      await removeCachedPlaylist(playlistCache, fileCache, snapshot.playlistId);
    }
  }

  const progress: CachePlaylistProgress = {
    done: 0,
    total: playlists.length,
    errors: [],
  };

  for (const playlist of playlists) {
    const result = await cacheReadingPlaylistForOffline(
      pieceRepo,
      fileRepo,
      fileStorage,
      fileCache,
      playlistRepo,
      playlistCache,
      annotationRepo,
      annotationStore,
      setRepo,
      navigationShortcutRepo,
      navigationShortcutStore,
      tocRepo,
      tocStore,
      organizationId,
      playlist.id,
      userId,
    );

    if (!result.ok) {
      progress.errors.push(`${playlist.name}: ${result.error}`);
    } else {
      progress.errors.push(...result.value.errors);
    }

    progress.done += 1;
    onProgress?.({ ...progress });
  }

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
  await playlistCache.remove(playlistId);
  if (cached) {
    await removeUnreferencedFiles(
      playlistCache,
      fileCache,
      cached.organizationId,
      cached.pieceFileIds,
    );
  }
}

export async function syncPendingOfflineChanges(
  annotationRepo: PieceFileAnnotationRepository,
  annotationStore: OfflineAnnotationStore,
  setRepo: import('@/application/ports/annotation-set-repository').AnnotationSetRepository,
  currentUserId?: string | null,
): Promise<{ synced: number; failed: number }> {
  if (!isBrowserOnline() || !currentUserId) {
    return { synced: 0, failed: 0 };
  }

  const { syncPendingAnnotationSetChanges } = await import('./annotation-set-offline-use-cases');
  const { isPermanentSyncAuthError, resolveSyncAuthorUserId } = await import('./sync-auth');
  const setResult = await syncPendingAnnotationSetChanges(setRepo, annotationStore, currentUserId);

  const outbox = await annotationStore.listOutbox();
  let synced = setResult.synced;
  let failed = setResult.failed;

  for (const item of outbox) {
    try {
      if (item.op === 'create') {
        const payload = item.payload as {
          clientId: string;
          organizationId: string;
          authorUserId: string;
          input: import('@/domain/repertoire').CreatePdfAnnotationInput;
        };
        const authorUserId = resolveSyncAuthorUserId(currentUserId, payload.authorUserId);
        if (!authorUserId) {
          continue;
        }
        const created = await annotationRepo.create(
          payload.organizationId,
          authorUserId,
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
    } catch (error) {
      if (isPermanentSyncAuthError(error)) {
        await annotationStore.removeOutbox(item.id);
      } else {
        await annotationStore.incrementOutboxRetry(item.id);
      }
      failed += 1;
    }
  }

  return { synced, failed };
}
