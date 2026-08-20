import { createOfflineAgendaCache } from './offline-agenda-cache';
import { createOfflineAnnotationStore } from './offline-annotation-store';
import { createOfflineFileCache } from './offline-file-cache';
import { createOfflineIdentityStore } from './offline-identity-store';
import { createOfflineMusicianCache } from './offline-musician-cache';
import { createOfflinePlaylistCache } from './offline-playlist-cache';

export type OfflineStorage = {
  fileCache: ReturnType<typeof createOfflineFileCache>;
  annotationStore: ReturnType<typeof createOfflineAnnotationStore>;
  playlistCache: ReturnType<typeof createOfflinePlaylistCache>;
  identityStore: ReturnType<typeof createOfflineIdentityStore>;
  agendaCache: ReturnType<typeof createOfflineAgendaCache>;
  musicianCache: ReturnType<typeof createOfflineMusicianCache>;
};

export function createOfflineStorage(): OfflineStorage {
  return {
    fileCache: createOfflineFileCache(),
    annotationStore: createOfflineAnnotationStore(),
    playlistCache: createOfflinePlaylistCache(),
    identityStore: createOfflineIdentityStore(),
    agendaCache: createOfflineAgendaCache(),
    musicianCache: createOfflineMusicianCache(),
  };
}

export async function clearAllOfflineData(storage: OfflineStorage): Promise<void> {
  await storage.fileCache.clearAll();
  await storage.annotationStore.clearAll();
  await storage.playlistCache.clearAll();
  await storage.agendaCache.clearAll();
  await storage.musicianCache.clearAll();
  await storage.identityStore.clear();
}
