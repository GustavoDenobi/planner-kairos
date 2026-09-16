import type * as pdfjs from 'pdfjs-dist';

const MAX_CACHED_PAGES = 24;

type RenderCacheEntry = {
  canvas: HTMLCanvasElement;
  lastUsed: number;
};

const renderCache = new WeakMap<pdfjs.PDFDocumentProxy, Map<string, RenderCacheEntry>>();

function cacheKey(pageNumber: number, scale: number): string {
  return `${pageNumber}:${scale.toFixed(4)}`;
}

function evictOldestEntries(entries: Map<string, RenderCacheEntry>): void {
  if (entries.size <= MAX_CACHED_PAGES) {
    return;
  }

  const sorted = [...entries.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed);
  const removeCount = entries.size - MAX_CACHED_PAGES;
  for (let index = 0; index < removeCount; index += 1) {
    entries.delete(sorted[index]![0]);
  }
}

export function getCachedPageRender(
  pdf: pdfjs.PDFDocumentProxy,
  pageNumber: number,
  scale: number,
): HTMLCanvasElement | null {
  const pdfCache = renderCache.get(pdf);
  if (!pdfCache) {
    return null;
  }

  const entry = pdfCache.get(cacheKey(pageNumber, scale));
  if (!entry) {
    return null;
  }

  entry.lastUsed = performance.now();
  return entry.canvas;
}

export function storeCachedPageRender(
  pdf: pdfjs.PDFDocumentProxy,
  pageNumber: number,
  scale: number,
  sourceCanvas: HTMLCanvasElement,
): void {
  let pdfCache = renderCache.get(pdf);
  if (!pdfCache) {
    pdfCache = new Map();
    renderCache.set(pdf, pdfCache);
  }

  const key = cacheKey(pageNumber, scale);
  const existing = pdfCache.get(key);
  if (existing) {
    existing.lastUsed = performance.now();
    return;
  }

  const cachedCanvas = document.createElement('canvas');
  cachedCanvas.width = sourceCanvas.width;
  cachedCanvas.height = sourceCanvas.height;
  const context = cachedCanvas.getContext('2d');
  if (!context) {
    return;
  }

  context.drawImage(sourceCanvas, 0, 0);
  pdfCache.set(key, { canvas: cachedCanvas, lastUsed: performance.now() });
  evictOldestEntries(pdfCache);
}

export function clearPdfRenderCache(pdf: pdfjs.PDFDocumentProxy): void {
  renderCache.delete(pdf);
}
