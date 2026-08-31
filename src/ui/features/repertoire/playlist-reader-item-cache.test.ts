import { describe, expect, it, vi } from 'vitest';

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}));

vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?worker&url', () => ({
  default: '/pdf.worker.js',
}));

vi.mock('@/ui/features/repertoire/pdf-load', () => ({
  resolvePdfDocument: vi.fn(),
  openPdfDocument: vi.fn(),
}));

import { PlaylistItemCache, type CachedPlaylistItem } from './playlist-reader-item-cache';

function fakeItem(numPages: number): CachedPlaylistItem {
  return {
    downloadUrl: null,
    annotations: [],
    navigationShortcuts: [],
    tocEntries: [],
    numPages,
    pdfDocument: { numPages } as CachedPlaylistItem['pdfDocument'],
    isCachedLocally: true,
  };
}

describe('PlaylistItemCache', () => {
  it('returns null when the loader throws instead of leaving the request hanging', async () => {
    const cache = new PlaylistItemCache();

    const first = await cache.load(0, async () => {
      throw new Error('worker failed');
    });
    const second = await cache.load(0, async () => fakeItem(2));

    expect(first).toBeNull();
    expect(second).toEqual(fakeItem(2));
    expect(cache.get(0)).toEqual(fakeItem(2));
  });

  it('reuses an in-flight load for the same index', async () => {
    const cache = new PlaylistItemCache();
    let calls = 0;

    const loader = async () => {
      calls += 1;
      return fakeItem(1);
    };

    const [first, second] = await Promise.all([
      cache.load(0, loader),
      cache.load(0, loader),
    ]);

    expect(calls).toBe(1);
    expect(first).toEqual(fakeItem(1));
    expect(second).toEqual(fakeItem(1));
  });
});
