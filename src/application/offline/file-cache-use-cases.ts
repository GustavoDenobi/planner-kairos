import type { FileStorage } from '@/application/ports/file-storage';
import type { OfflineFileCache } from '@/application/ports/offline-file-cache';
import type { PieceFileRepository } from '@/application/ports/piece-file-repository';
import type { PieceRepository } from '@/application/ports/piece-repository';
import { computeFileSha256Hex, Result } from '@/domain/shared';
import type { OfflineFileStatus, ResolvedPieceFile } from './types';

export function isBrowserOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine;
}

const inflightFileCaches = new Map<string, Promise<Result<void, string>>>();

export async function cachePieceFileForOffline(
  pieceRepo: PieceRepository,
  fileRepo: PieceFileRepository,
  fileStorage: FileStorage,
  fileCache: OfflineFileCache,
  organizationId: string,
  pieceId: string,
  fileId: string,
): Promise<Result<void, string>> {
  const inflight = inflightFileCaches.get(fileId);
  if (inflight) {
    return inflight;
  }

  const task = cachePieceFileForOfflineOnce(
    pieceRepo,
    fileRepo,
    fileStorage,
    fileCache,
    organizationId,
    pieceId,
    fileId,
  );
  inflightFileCaches.set(fileId, task);
  try {
    return await task;
  } finally {
    if (inflightFileCaches.get(fileId) === task) {
      inflightFileCaches.delete(fileId);
    }
  }
}

async function cachePieceFileForOfflineOnce(
  pieceRepo: PieceRepository,
  fileRepo: PieceFileRepository,
  fileStorage: FileStorage,
  fileCache: OfflineFileCache,
  organizationId: string,
  pieceId: string,
  fileId: string,
): Promise<Result<void, string>> {
  const cached = await fileCache.get(fileId);
  if (cached && !isBrowserOnline()) {
    return Result.ok(undefined);
  }

  const piece = await pieceRepo.getById(organizationId, pieceId);
  if (!piece) {
    return Result.fail('not_found');
  }

  const file = await fileRepo.getById(organizationId, pieceId, fileId);
  if (!file) {
    return Result.fail('not_found');
  }

  if (cached && !(await fileCache.isStale(fileId, file.contentHash))) {
    return Result.ok(undefined);
  }

  if (!isBrowserOnline()) {
    return Result.fail('offline');
  }

  try {
    const url = await fileStorage.getSignedUrl(file.storageKey);
    const response = await fetch(url);
    if (!response.ok) {
      return Result.fail('download_failed');
    }
    const blob = await response.blob();

    if (file.contentHash) {
      const hash = await computeFileSha256Hex(blob);
      if (hash !== file.contentHash) {
        return Result.fail('hash_mismatch');
      }
    }

    await fileCache.put({
      pieceFileId: file.id,
      organizationId: file.organizationId,
      pieceId: file.pieceId,
      contentHash: file.contentHash,
      byteSize: file.byteSize ?? blob.size,
      title: file.title,
      cachedAt: new Date().toISOString(),
      blob,
    });

    return Result.ok(undefined);
  } catch {
    return Result.fail('download_failed');
  }
}

export async function resolvePieceFileForReading(
  pieceRepo: PieceRepository,
  fileRepo: PieceFileRepository,
  fileStorage: FileStorage,
  fileCache: OfflineFileCache,
  organizationId: string,
  pieceId: string,
  fileId: string,
): Promise<Result<ResolvedPieceFile, string>> {
  const cachedBlob = await fileCache.getBlob(fileId);
  if (cachedBlob) {
    const buffer = await new Response(cachedBlob).arrayBuffer();
    return Result.ok({ source: 'local', data: buffer });
  }

  if (!isBrowserOnline()) {
    return Result.fail('offline_not_cached');
  }

  const piece = await pieceRepo.getById(organizationId, pieceId);
  if (!piece) {
    return Result.fail('not_found');
  }

  const file = await fileRepo.getById(organizationId, pieceId, fileId);
  if (!file) {
    return Result.fail('not_found');
  }

  try {
    const url = await fileStorage.getSignedUrl(file.storageKey);
    return Result.ok({ source: 'remote', url });
  } catch {
    return Result.fail('signed_url_failed');
  }
}

export async function getFileOfflineStatus(
  fileRepo: PieceFileRepository,
  fileCache: OfflineFileCache,
  annotationStore: { pendingSyncCount: (orgId: string, fileId?: string) => Promise<number> },
  organizationId: string,
  pieceId: string,
  fileId: string,
): Promise<Result<{ fileStatus: OfflineFileStatus; pendingSyncCount: number }, string>> {
  const cached = await fileCache.get(fileId);
  let fileStatus: OfflineFileStatus = 'not_cached';

  if (cached) {
    if (isBrowserOnline()) {
      const file = await fileRepo.getById(organizationId, pieceId, fileId);
      if (file && await fileCache.isStale(fileId, file.contentHash)) {
        fileStatus = 'stale';
      } else {
        fileStatus = 'cached';
      }
    } else {
      fileStatus = 'cached';
    }
  }

  const pendingSyncCount = await annotationStore.pendingSyncCount(organizationId, fileId);
  return Result.ok({ fileStatus, pendingSyncCount });
}

export async function removeCachedPieceFile(
  fileCache: OfflineFileCache,
  fileId: string,
): Promise<void> {
  await fileCache.remove(fileId);
}

export async function estimatePlaylistCacheSize(
  fileRepo: PieceFileRepository,
  organizationId: string,
  pieceFileIds: string[],
): Promise<number> {
  let total = 0;
  for (const pieceFileId of pieceFileIds) {
    const file = await fileRepo.getByFileId(organizationId, pieceFileId);
    if (file?.byteSize) {
      total += file.byteSize;
    }
  }
  return total;
}
