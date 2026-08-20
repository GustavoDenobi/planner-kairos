import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { OfflineAnnotationStore } from '@/application/ports/offline-annotation-store';
import type { OfflineFileCache } from '@/application/ports/offline-file-cache';
import type { OfflinePlaylistCache } from '@/application/ports/offline-playlist-cache';
import type { FileStorage } from '@/application/ports/file-storage';
import type { PieceFileAnnotationRepository } from '@/application/ports/piece-file-annotation-repository';
import type { PieceFileRepository } from '@/application/ports/piece-file-repository';
import type { PieceRepository } from '@/application/ports/piece-repository';
import type { ReadingPlaylistRepository } from '@/application/ports/reading-playlist-repository';
import type { ReadingPlaylistDetail } from '@/domain/repertoire';
import {
  cacheReadingPlaylistForOffline,
  cacheUserReadingPlaylistsForOffline,
  getCachedReadingPlaylist,
  removeCachedPlaylist,
} from '@/application/offline/playlist-cache-use-cases';

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

function createFileCache(): OfflineFileCache {
  const store = new Map<string, { blob: Blob; meta: { contentHash: string | null } }>();
  return {
    get: async (id) => {
      const entry = store.get(id);
      if (!entry) return null;
      return {
        pieceFileId: id,
        organizationId: 'org-1',
        pieceId: 'piece-1',
        contentHash: entry.meta.contentHash,
        byteSize: entry.blob.size,
        title: 'Score',
        cachedAt: new Date().toISOString(),
      };
    },
    getBlob: async (id) => store.get(id)?.blob ?? null,
    put: async (entry) => {
      store.set(entry.pieceFileId, { blob: entry.blob, meta: { contentHash: entry.contentHash } });
    },
    remove: async (id) => {
      store.delete(id);
    },
    listForOrganization: async () => [],
    isStale: async (id, hash) => {
      const entry = store.get(id);
      return entry ? entry.meta.contentHash !== hash : false;
    },
    clearAll: async () => store.clear(),
  };
}

function makePlaylist(id: string, fileId: string): ReadingPlaylistDetail {
  return {
    id,
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    name: id,
    sourceEventId: null,
    sourceEventKind: null,
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    items: [
      {
        id: `${id}-item`,
        playlistId: id,
        organizationId: 'org-1',
        pieceFileId: fileId,
        sortOrder: 0,
        label: null,
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        pieceId: 'piece-1',
        pieceTitle: 'Obra',
        pieceDeleted: false,
        pieceCategory: null,
        fileTitle: 'Score',
        partLinks: [],
      },
    ],
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

describe('removeCachedPlaylist', () => {
  it('keeps files still referenced by another cached playlist', async () => {
    const playlistCache = createPlaylistCache();
    const fileCache = createFileCache();
    const blob = new Blob(['pdf']);

    await fileCache.put({
      pieceFileId: 'file-shared',
      organizationId: 'org-1',
      pieceId: 'piece-1',
      contentHash: null,
      byteSize: blob.size,
      title: 'Score',
      cachedAt: new Date().toISOString(),
      blob,
    });

    await playlistCache.put({
      playlistId: 'playlist-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      name: 'Uma',
      pieceFileIds: ['file-shared'],
      snapshotJson: '{}',
      cachedAt: new Date().toISOString(),
    });
    await playlistCache.put({
      playlistId: 'playlist-2',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      name: 'Outra',
      pieceFileIds: ['file-shared'],
      snapshotJson: '{}',
      cachedAt: new Date().toISOString(),
    });

    await removeCachedPlaylist(playlistCache, fileCache, 'playlist-1');

    expect(await playlistCache.get('playlist-1')).toBeNull();
    expect(await fileCache.getBlob('file-shared')).not.toBeNull();
  });

  it('removes files that no other playlist references', async () => {
    const playlistCache = createPlaylistCache();
    const fileCache = createFileCache();
    const blob = new Blob(['pdf']);

    await fileCache.put({
      pieceFileId: 'file-only',
      organizationId: 'org-1',
      pieceId: 'piece-1',
      contentHash: null,
      byteSize: blob.size,
      title: 'Score',
      cachedAt: new Date().toISOString(),
      blob,
    });

    await playlistCache.put({
      playlistId: 'playlist-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      name: 'Uma',
      pieceFileIds: ['file-only'],
      snapshotJson: '{}',
      cachedAt: new Date().toISOString(),
    });

    await removeCachedPlaylist(playlistCache, fileCache, 'playlist-1');

    expect(await fileCache.getBlob('file-only')).toBeNull();
  });
});

describe('cacheReadingPlaylistForOffline', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(['pdf'], { type: 'application/pdf' }),
    })));
  });

  it('stores playlist files in the local cache', async () => {
    const playlist = makePlaylist('playlist-1', 'file-1');
    const fileCache = createFileCache();
    const playlistCache = createPlaylistCache();

    const result = await cacheReadingPlaylistForOffline(
      { getById: vi.fn(async () => ({ id: 'piece-1' })) } as unknown as PieceRepository,
      {
        getById: vi.fn(async () => ({
          id: 'file-1',
          organizationId: 'org-1',
          pieceId: 'piece-1',
          storageKey: 'key',
          contentHash: null,
          byteSize: 3,
          title: 'Score',
        })),
      } as unknown as PieceFileRepository,
      { getSignedUrl: vi.fn(async () => 'https://files.test/score.pdf') } as unknown as FileStorage,
      fileCache,
      { getDetail: vi.fn(async () => playlist) } as unknown as ReadingPlaylistRepository,
      playlistCache,
      { listForFile: vi.fn(async () => []) } as unknown as PieceFileAnnotationRepository,
      { upsert: vi.fn() } as unknown as OfflineAnnotationStore,
      'org-1',
      'playlist-1',
      'user-1',
    );

    expect(result.ok).toBe(true);
    expect(await fileCache.getBlob('file-1')).not.toBeNull();
    expect(await getCachedReadingPlaylist(playlistCache, 'playlist-1')).toMatchObject({
      id: 'playlist-1',
      name: 'playlist-1',
    });
  });
});

describe('cacheUserReadingPlaylistsForOffline', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(['pdf'], { type: 'application/pdf' }),
    })));
  });

  it('caches every user playlist and drops snapshots that no longer exist', async () => {
    const current = makePlaylist('playlist-current', 'file-current');
    const fileCache = createFileCache();
    const playlistCache = createPlaylistCache();

    await playlistCache.put({
      playlistId: 'playlist-gone',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      name: 'Antiga',
      pieceFileIds: ['file-gone'],
      snapshotJson: '{}',
      cachedAt: new Date().toISOString(),
    });
    await fileCache.put({
      pieceFileId: 'file-gone',
      organizationId: 'org-1',
      pieceId: 'piece-1',
      contentHash: null,
      byteSize: 3,
      title: 'Score',
      cachedAt: new Date().toISOString(),
      blob: new Blob(['old']),
    });

    const result = await cacheUserReadingPlaylistsForOffline(
      { getById: vi.fn(async () => ({ id: 'piece-1' })) } as unknown as PieceRepository,
      {
        getById: vi.fn(async () => ({
          id: 'file-current',
          organizationId: 'org-1',
          pieceId: 'piece-1',
          storageKey: 'key',
          contentHash: null,
          byteSize: 3,
          title: 'Score',
        })),
      } as unknown as PieceFileRepository,
      { getSignedUrl: vi.fn(async () => 'https://files.test/score.pdf') } as unknown as FileStorage,
      fileCache,
      {
        listForUser: vi.fn(async () => [current]),
        getDetail: vi.fn(async () => current),
      } as unknown as ReadingPlaylistRepository,
      playlistCache,
      { listForFile: vi.fn(async () => []) } as unknown as PieceFileAnnotationRepository,
      { upsert: vi.fn() } as unknown as OfflineAnnotationStore,
      'org-1',
      'user-1',
    );

    expect(result.ok).toBe(true);
    expect(await playlistCache.get('playlist-gone')).toBeNull();
    expect(await fileCache.getBlob('file-gone')).toBeNull();
    expect(await fileCache.getBlob('file-current')).not.toBeNull();
    expect(await playlistCache.get('playlist-current')).not.toBeNull();
  });
});
