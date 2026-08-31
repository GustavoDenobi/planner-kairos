import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { OfflineFileCache } from '@/application/ports/offline-file-cache';
import type { PieceFileRepository } from '@/application/ports/piece-file-repository';
import type { PieceRepository } from '@/application/ports/piece-repository';
import type { FileStorage } from '@/application/ports/file-storage';
import type { PieceFileWithLinks } from '@/domain/repertoire';
import {
  cachePieceFileForOffline,
  isBrowserOnline,
  resolvePieceFileForReading,
} from '@/application/offline/file-cache-use-cases';

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

const sampleFile: PieceFileWithLinks = {
  id: 'file-1',
  organizationId: 'org-1',
  pieceId: 'piece-1',
  kind: 'score',
  storageKey: 'org-1/piece-1/file-1',
  mimeType: 'application/pdf',
  title: 'Score',
  sortOrder: 0,
  originalName: 'score.pdf',
  byteSize: 3,
  contentHash: 'hash-1',
  partLinks: [],
};

function createPieceRepo(): PieceRepository {
  return {
    getById: vi.fn(async () => ({ id: 'piece-1' })),
  } as unknown as PieceRepository;
}

function createFileRepo(file: PieceFileWithLinks = sampleFile): PieceFileRepository {
  return {
    getById: vi.fn(async () => file),
  } as unknown as PieceFileRepository;
}

describe('resolvePieceFileForReading', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { onLine: true });
  });

  it('returns local data when file is cached', async () => {
    const fileCache = createFileCache();
    const blob = new Blob(['pdf'], { type: 'application/pdf' });
    await fileCache.put({
      pieceFileId: 'file-1',
      organizationId: 'org-1',
      pieceId: 'piece-1',
      contentHash: 'abc',
      byteSize: blob.size,
      title: 'Score',
      cachedAt: new Date().toISOString(),
      blob,
    });

    const pieceRepo = {
      getById: vi.fn(),
    } as unknown as PieceRepository;

    const fileRepo = {
      getById: vi.fn(),
    } as unknown as PieceFileRepository;

    const fileStorage = {
      getSignedUrl: vi.fn(),
    } as unknown as FileStorage;

    const result = await resolvePieceFileForReading(
      pieceRepo,
      fileRepo,
      fileStorage,
      fileCache,
      'org-1',
      'piece-1',
      'file-1',
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.source).toBe('local');
      if (result.value.source === 'local') {
        expect(result.value.data.byteLength).toBeGreaterThan(0);
      }
    }
    expect(pieceRepo.getById).not.toHaveBeenCalled();
  });

  it('falls through to remote when the cached blob is empty', async () => {
    const fileCache = createFileCache();
    await fileCache.put({
      pieceFileId: 'file-1',
      organizationId: 'org-1',
      pieceId: 'piece-1',
      contentHash: 'abc',
      byteSize: 0,
      title: 'Score',
      cachedAt: new Date().toISOString(),
      blob: new Blob([], { type: 'application/pdf' }),
    });

    const fileStorage = {
      getSignedUrl: vi.fn(async () => 'https://files.test/score.pdf'),
    } as unknown as FileStorage;

    const result = await resolvePieceFileForReading(
      createPieceRepo(),
      createFileRepo(),
      fileStorage,
      fileCache,
      'org-1',
      'piece-1',
      'file-1',
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ source: 'remote', url: 'https://files.test/score.pdf' });
    }
  });

  it('fails when offline and not cached', async () => {
    vi.stubGlobal('navigator', { onLine: false });

    const result = await resolvePieceFileForReading(
      {} as PieceRepository,
      {} as PieceFileRepository,
      {} as FileStorage,
      createFileCache(),
      'org-1',
      'piece-1',
      'file-1',
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('offline_not_cached');
    }
  });
});

describe('cachePieceFileForOffline', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal('navigator', { onLine: true });
  });

  it('skips download when the cached file is still fresh', async () => {
    const fileCache = createFileCache();
    const blob = new Blob(['pdf'], { type: 'application/pdf' });
    await fileCache.put({
      pieceFileId: 'file-1',
      organizationId: 'org-1',
      pieceId: 'piece-1',
      contentHash: 'hash-1',
      byteSize: blob.size,
      title: 'Score',
      cachedAt: new Date().toISOString(),
      blob,
    });

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const fileStorage = {
      getSignedUrl: vi.fn(),
    } as unknown as FileStorage;

    const result = await cachePieceFileForOffline(
      createPieceRepo(),
      createFileRepo(),
      fileStorage,
      fileCache,
      'org-1',
      'piece-1',
      'file-1',
    );

    expect(result.ok).toBe(true);
    expect(fileStorage.getSignedUrl).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('downloads again when the cached file is stale', async () => {
    const fileCache = createFileCache();
    const blob = new Blob(['old'], { type: 'application/pdf' });
    await fileCache.put({
      pieceFileId: 'file-1',
      organizationId: 'org-1',
      pieceId: 'piece-1',
      contentHash: 'old-hash',
      byteSize: blob.size,
      title: 'Score',
      cachedAt: new Date().toISOString(),
      blob,
    });

    const fetchMock = vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(['pdf'], { type: 'application/pdf' }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const fileStorage = {
      getSignedUrl: vi.fn(async () => 'https://files.test/score.pdf'),
    } as unknown as FileStorage;

    const result = await cachePieceFileForOffline(
      createPieceRepo(),
      createFileRepo({ ...sampleFile, contentHash: null }),
      fileStorage,
      fileCache,
      'org-1',
      'piece-1',
      'file-1',
    );

    expect(result.ok).toBe(true);
    expect(fileStorage.getSignedUrl).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalled();
    expect(await fileCache.getBlob('file-1')).not.toBeNull();
  });
});

describe('isBrowserOnline', () => {
  it('returns navigator.onLine when available', () => {
    vi.stubGlobal('navigator', { onLine: false });
    expect(isBrowserOnline()).toBe(false);
  });
});
