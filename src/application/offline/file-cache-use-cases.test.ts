import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { OfflineFileCache } from '@/application/ports/offline-file-cache';
import type { PieceFileRepository } from '@/application/ports/piece-file-repository';
import type { PieceRepository } from '@/application/ports/piece-repository';
import type { FileStorage } from '@/application/ports/file-storage';
import {
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

describe('isBrowserOnline', () => {
  it('returns navigator.onLine when available', () => {
    vi.stubGlobal('navigator', { onLine: false });
    expect(isBrowserOnline()).toBe(false);
  });
});
