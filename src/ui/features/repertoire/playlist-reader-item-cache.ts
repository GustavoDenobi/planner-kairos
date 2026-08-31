import type * as pdfjs from 'pdfjs-dist';
import type { PdfAnnotation, PdfNavigationShortcut, PieceFileTocEntry, ReadingPlaylistItemDetail } from '@/domain/repertoire';
import type { AnnotationViewerContext } from '@/application/ports/offline-annotation-store';
import type { OfflineUseCases } from '@/application/offline';
import { resolvePdfDocument } from '@/ui/features/repertoire/pdf-load';

export type CachedPlaylistItem = {
  downloadUrl: string | null;
  annotations: PdfAnnotation[];
  navigationShortcuts: PdfNavigationShortcut[];
  tocEntries: PieceFileTocEntry[];
  numPages: number;
  pdfDocument: pdfjs.PDFDocumentProxy;
  isCachedLocally: boolean;
};

export function isPlaylistItemAvailable(item: ReadingPlaylistItemDetail): boolean {
  return Boolean(item.pieceId) && !item.pieceDeleted;
}

export async function loadPlaylistItemData(
  offline: OfflineUseCases,
  organizationId: string,
  item: ReadingPlaylistItemDetail,
  viewer?: AnnotationViewerContext,
): Promise<CachedPlaylistItem | null> {
  if (!isPlaylistItemAvailable(item) || !item.pieceId) {
    return null;
  }

  const pdfLoad = await resolvePdfDocument(
    offline,
    organizationId,
    item.pieceId,
    item.pieceFileId,
  );

  if (!pdfLoad.pdfDocument) {
    return null;
  }

  let annotations: PdfAnnotation[] = [];
  let navigationShortcuts: PdfNavigationShortcut[] = [];
  let tocEntries: PieceFileTocEntry[] = [];
  try {
    const annotationsResult = await offline.listAnnotationsForReading(
      organizationId,
      item.pieceFileId,
      viewer,
    );
    if (annotationsResult.ok) {
      annotations = annotationsResult.value;
    }

    const shortcutsResult = await offline.listNavigationShortcutsForReading(
      organizationId,
      item.pieceFileId,
    );
    if (shortcutsResult.ok) {
      navigationShortcuts = shortcutsResult.value;
    }

    const tocResult = await offline.listTocEntriesForReading(
      organizationId,
      item.pieceFileId,
    );
    if (tocResult.ok) {
      tocEntries = tocResult.value;
    }
  } catch {
    /* Open the score even if annotations, shortcuts or TOC cannot be loaded. */
  }

  return {
    downloadUrl: pdfLoad.downloadUrl,
    annotations,
    navigationShortcuts,
    tocEntries,
    numPages: pdfLoad.pdfDocument.numPages,
    pdfDocument: pdfLoad.pdfDocument,
    isCachedLocally: pdfLoad.resolved?.source === 'local',
  };
}

export class PlaylistItemCache {
  private readonly entries = new Map<number, CachedPlaylistItem>();
  private readonly inflight = new Map<number, Promise<CachedPlaylistItem | null>>();

  get(index: number): CachedPlaylistItem | undefined {
    return this.entries.get(index);
  }

  set(index: number, item: CachedPlaylistItem): void {
    this.entries.set(index, item);
  }

  async load(
    index: number,
    loader: () => Promise<CachedPlaylistItem | null>,
  ): Promise<CachedPlaylistItem | null> {
    const cached = this.entries.get(index);
    if (cached) {
      return cached;
    }

    const pending = this.inflight.get(index);
    if (pending) {
      return pending;
    }

    const promise = loader()
      .then((result) => {
        this.inflight.delete(index);
        if (result) {
          this.entries.set(index, result);
        }
        return result;
      })
      .catch(() => {
        this.inflight.delete(index);
        return null;
      });
    this.inflight.set(index, promise);
    return promise;
  }

  prefetch(index: number, loader: () => Promise<CachedPlaylistItem | null>): void {
    if (this.entries.has(index) || this.inflight.has(index)) {
      return;
    }
    void this.load(index, loader);
  }
}
