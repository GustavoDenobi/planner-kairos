import { createOfflineAgendaCache } from './offline-agenda-cache';
import { createOfflineAnnotationStore } from './offline-annotation-store';
import { createOfflineFileCache } from './offline-file-cache';
import { createOfflineIdentityStore } from './offline-identity-store';
import { createOfflineMusicianCache } from './offline-musician-cache';
import { createOfflineNavigationShortcutStore } from './offline-navigation-shortcut-store';
import { createOfflinePlaylistCache } from './offline-playlist-cache';

export type OfflineStorage = {
  fileCache: ReturnType<typeof createOfflineFileCache>;
  annotationStore: ReturnType<typeof createOfflineAnnotationStore>;
  navigationShortcutStore: ReturnType<typeof createOfflineNavigationShortcutStore>;
  playlistCache: ReturnType<typeof createOfflinePlaylistCache>;
  identityStore: ReturnType<typeof createOfflineIdentityStore>;
  agendaCache: ReturnType<typeof createOfflineAgendaCache>;
  musicianCache: ReturnType<typeof createOfflineMusicianCache>;
};

export function createOfflineStorage(): OfflineStorage {
  return {
    fileCache: createOfflineFileCache(),
    annotationStore: createOfflineAnnotationStore(),
    navigationShortcutStore: createOfflineNavigationShortcutStore(),
    playlistCache: createOfflinePlaylistCache(),
    identityStore: createOfflineIdentityStore(),
    agendaCache: createOfflineAgendaCache(),
    musicianCache: createOfflineMusicianCache(),
  };
}

export async function clearAllOfflineData(storage: OfflineStorage): Promise<void> {
  await storage.fileCache.clearAll();
  await storage.annotationStore.clearAll();
  await storage.navigationShortcutStore.clearAll();
  await storage.playlistCache.clearAll();
  await storage.agendaCache.clearAll();
  await storage.musicianCache.clearAll();
  await storage.identityStore.clear();
}
