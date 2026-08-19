import { describe, expect, it, beforeEach } from 'vitest';
import type { OfflinePlaylistCache } from '@/application/ports/offline-playlist-cache';
import { getCachedReadingPlaylist } from '@/application/offline/playlist-cache-use-cases';

function createPlaylistCache(): OfflinePlaylistCache {
  const store = new Map<string, import('@/application/ports/offline-playlist-cache').CachedPlaylistSnapshot>();
  return {
    get: async (playlistId) => store.get(playlistId) ?? null,
    put: async (snapshot) => {
      store.set(snapshot.playlistId, snapshot);
    },
    remove: async (playlistId) => {
      store.delete(playlistId);
    },
    listForOrganization: async (organizationId) =>
      [...store.values()].filter((item) => item.organizationId === organizationId),
    clearAll: async () => store.clear(),
  };
}

describe('playlist cache offline listing', () => {
  let playlistCache: OfflinePlaylistCache;

  beforeEach(() => {
    playlistCache = createPlaylistCache();
  });

  it('lists cached playlists for organization', async () => {
    await playlistCache.put({
      playlistId: 'playlist-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      name: 'Culto',
      pieceFileIds: ['file-1'],
      snapshotJson: JSON.stringify({
        id: 'playlist-1',
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        name: 'Culto',
        items: [],
      }),
      cachedAt: new Date().toISOString(),
    });

    await playlistCache.put({
      playlistId: 'playlist-2',
      organizationId: 'org-2',
      ownerUserId: 'user-1',
      name: 'Outra org',
      pieceFileIds: [],
      snapshotJson: '{}',
      cachedAt: new Date().toISOString(),
    });

    const orgPlaylists = await playlistCache.listForOrganization('org-1');
    expect(orgPlaylists).toHaveLength(1);
    expect(orgPlaylists[0]?.playlistId).toBe('playlist-1');
  });

  it('reads cached playlist detail from snapshot', async () => {
    const detail = {
      id: 'playlist-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      name: 'Ensaio',
      items: [{ pieceFileId: 'file-1', pieceId: 'piece-1', pieceDeleted: false }],
    };

    await playlistCache.put({
      playlistId: 'playlist-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      name: 'Ensaio',
      pieceFileIds: ['file-1'],
      snapshotJson: JSON.stringify(detail),
      cachedAt: new Date().toISOString(),
    });

    const cached = await getCachedReadingPlaylist(playlistCache, 'playlist-1');
    expect(cached?.name).toBe('Ensaio');
    expect(cached?.items).toHaveLength(1);
  });
});
