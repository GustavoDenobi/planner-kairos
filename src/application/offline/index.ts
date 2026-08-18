import type { FileStorage } from '@/application/ports/file-storage';
import type { OfflineAnnotationStore } from '@/application/ports/offline-annotation-store';
import type { OfflineFileCache } from '@/application/ports/offline-file-cache';
import type { OfflinePlaylistCache } from '@/application/ports/offline-playlist-cache';
import type { PieceFileAnnotationRepository } from '@/application/ports/piece-file-annotation-repository';
import type { PieceFileRepository } from '@/application/ports/piece-file-repository';
import type { PieceRepository } from '@/application/ports/piece-repository';
import type { ReadingPlaylistRepository } from '@/application/ports/reading-playlist-repository';
import type {
  CreatePdfAnnotationInput,
  UpdatePdfAnnotationInput,
} from '@/domain/repertoire';
import {
  createAnnotationWithOffline,
  deleteAnnotationWithOffline,
  listAnnotationsForReading,
  updateAnnotationWithOffline,
} from './annotation-offline-use-cases';
import {
  cachePieceFileForOffline,
  estimatePlaylistCacheSize,
  getFileOfflineStatus,
  removeCachedPieceFile,
  resolvePieceFileForReading,
} from './file-cache-use-cases';
import {
  cacheReadingPlaylistForOffline,
  getCachedReadingPlaylist,
  removeCachedPlaylist,
  syncPendingOfflineChanges,
} from './playlist-cache-use-cases';
import type { CachePlaylistProgress } from './types';

export type OfflineStoragePorts = {
  fileCache: OfflineFileCache;
  annotationStore: OfflineAnnotationStore;
  playlistCache: OfflinePlaylistCache;
};

export type OfflineUseCaseDeps = {
  pieceRepo: PieceRepository;
  fileRepo: PieceFileRepository;
  fileStorage: FileStorage;
  annotationRepo: PieceFileAnnotationRepository;
  playlistRepo: ReadingPlaylistRepository;
  offlineStorage: OfflineStoragePorts;
};

export function createOfflineUseCases(deps: OfflineUseCaseDeps) {
  const fileCache = deps.offlineStorage.fileCache;
  const annotationStore = deps.offlineStorage.annotationStore;
  const playlistCache = deps.offlineStorage.playlistCache;

  return {
    cachePieceFileForOffline: (organizationId: string, pieceId: string, fileId: string) =>
      cachePieceFileForOffline(
        deps.pieceRepo,
        deps.fileRepo,
        deps.fileStorage,
        fileCache,
        organizationId,
        pieceId,
        fileId,
      ),

    cacheReadingPlaylistForOffline: (
      organizationId: string,
      playlistId: string,
      userId: string,
      onProgress?: (progress: CachePlaylistProgress) => void,
    ) =>
      cacheReadingPlaylistForOffline(
        deps.pieceRepo,
        deps.fileRepo,
        deps.fileStorage,
        fileCache,
        deps.playlistRepo,
        playlistCache,
        deps.annotationRepo,
        annotationStore,
        organizationId,
        playlistId,
        userId,
        onProgress,
      ),

    resolvePieceFileForReading: (
      organizationId: string,
      pieceId: string,
      fileId: string,
    ) =>
      resolvePieceFileForReading(
        deps.pieceRepo,
        deps.fileRepo,
        deps.fileStorage,
        fileCache,
        organizationId,
        pieceId,
        fileId,
      ),

    listAnnotationsForReading: (organizationId: string, pieceFileId: string) =>
      listAnnotationsForReading(
        deps.annotationRepo,
        annotationStore,
        organizationId,
        pieceFileId,
      ),

    createPieceFileAnnotation: (
      organizationId: string,
      pieceId: string,
      authorUserId: string,
      input: CreatePdfAnnotationInput,
    ) =>
      createAnnotationWithOffline(
        deps.annotationRepo,
        annotationStore,
        organizationId,
        pieceId,
        authorUserId,
        input,
      ),

    deletePieceFileAnnotation: (
      organizationId: string,
      pieceFileId: string,
      annotationId: string,
    ) =>
      deleteAnnotationWithOffline(
        deps.annotationRepo,
        annotationStore,
        organizationId,
        pieceFileId,
        annotationId,
      ),

    updatePieceFileAnnotation: (
      organizationId: string,
      pieceFileId: string,
      annotationId: string,
      input: UpdatePdfAnnotationInput,
    ) =>
      updateAnnotationWithOffline(
        deps.annotationRepo,
        annotationStore,
        organizationId,
        pieceFileId,
        annotationId,
        input,
      ),

    getOfflineStatus: (
      organizationId: string,
      pieceId: string,
      fileId: string,
    ) =>
      getFileOfflineStatus(
        deps.fileRepo,
        fileCache,
        annotationStore,
        organizationId,
        pieceId,
        fileId,
      ),

    removeCachedPieceFile: (fileId: string) => removeCachedPieceFile(fileCache, fileId),

    removeCachedPlaylist: (playlistId: string) =>
      removeCachedPlaylist(playlistCache, fileCache, playlistId),

    getCachedReadingPlaylist: (playlistId: string) =>
      getCachedReadingPlaylist(playlistCache, playlistId),

    estimatePlaylistCacheSize: (organizationId: string, pieceFileIds: string[]) =>
      estimatePlaylistCacheSize(deps.fileRepo, organizationId, pieceFileIds),

    syncPendingOfflineChanges: () =>
      syncPendingOfflineChanges(deps.annotationRepo, annotationStore),

    clearAllOfflineData: async () => {
      await fileCache.clearAll();
      await annotationStore.clearAll();
      await playlistCache.clearAll();
    },
  };
}

export type OfflineUseCases = ReturnType<typeof createOfflineUseCases>;

export type { CachePlaylistProgress, OfflineStatus, ResolvedPieceFile } from './types';
export type { OfflineFileStatus } from './types';
