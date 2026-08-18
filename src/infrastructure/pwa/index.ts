import { createOfflineAnnotationStore } from './offline-annotation-store';
import { createOfflineFileCache } from './offline-file-cache';
import { createOfflinePlaylistCache } from './offline-playlist-cache';

export type OfflineStorage = {
  fileCache: ReturnType<typeof createOfflineFileCache>;
  annotationStore: ReturnType<typeof createOfflineAnnotationStore>;
  playlistCache: ReturnType<typeof createOfflinePlaylistCache>;
};

export function createOfflineStorage(): OfflineStorage {
  return {
    fileCache: createOfflineFileCache(),
    annotationStore: createOfflineAnnotationStore(),
    playlistCache: createOfflinePlaylistCache(),
  };
}

export async function clearAllOfflineData(storage: OfflineStorage): Promise<void> {
  await storage.fileCache.clearAll();
  await storage.annotationStore.clearAll();
  await storage.playlistCache.clearAll();
}
