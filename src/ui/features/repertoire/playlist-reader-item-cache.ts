import type * as pdfjs from 'pdfjs-dist';
import type { PdfAnnotation, PdfNavigationShortcut, PieceFileTocEntry, ReadingPlaylistItemDetail } from '@/domain/repertoire';
import type {
  AnnotationReadingOptions,
  AnnotationViewerContext,
} from '@/application/ports/offline-annotation-store';
import type { OfflineUseCases } from '@/application/offline';
import type { PdfDownloadProgressHandler } from '@/ui/features/repertoire/hybrid-load-progress';
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

function readViewer(
  viewer?: AnnotationViewerContext | (() => AnnotationViewerContext | undefined),
): AnnotationViewerContext | undefined {
  return typeof viewer === 'function' ? viewer() : viewer;
}

function readReadingOptions(
  readingOptions?: AnnotationReadingOptions | (() => AnnotationReadingOptions | undefined),
): AnnotationReadingOptions | undefined {
  return typeof readingOptions === 'function' ? readingOptions() : readingOptions;
}

export async function loadPlaylistItemData(
  offline: OfflineUseCases,
  organizationId: string,
  item: ReadingPlaylistItemDetail,
  viewer?: AnnotationViewerContext | (() => AnnotationViewerContext | undefined),
  readingOptions?: AnnotationReadingOptions | (() => AnnotationReadingOptions | undefined),
  onDownloadProgress?: PdfDownloadProgressHandler,
  abortSignal?: AbortSignal,
): Promise<CachedPlaylistItem | null> {
  if (!isPlaylistItemAvailable(item) || !item.pieceId) {
    return null;
  }

  const pdfLoad = await resolvePdfDocument(
    offline,
    organizationId,
    item.pieceId,
    item.pieceFileId,
    onDownloadProgress,
    abortSignal,
  );

  if (pdfLoad.error === 'aborted') {
    return null;
  }

  if (!pdfLoad.pdfDocument) {
    return null;
  }

  const resolvedViewer = readViewer(viewer);
  const resolvedOptions = readReadingOptions(readingOptions);

  let annotations: PdfAnnotation[] = [];
  let navigationShortcuts: PdfNavigationShortcut[] = [];
  let tocEntries: PieceFileTocEntry[] = [];
  try {
    const annotationsResult = await offline.listAnnotationsForReading(
      organizationId,
      item.pieceFileId,
      resolvedViewer,
      resolvedOptions,
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

type InflightPlaylistLoad = {
  promise: Promise<CachedPlaylistItem | null>;
  signal?: AbortSignal;
  generation: number;
};

export class PlaylistItemCache {
  private readonly entries = new Map<number, CachedPlaylistItem>();
  private readonly inflight = new Map<number, InflightPlaylistLoad>();

  get(index: number): CachedPlaylistItem | undefined {
    return this.entries.get(index);
  }

  set(index: number, item: CachedPlaylistItem): void {
    this.entries.set(index, item);
  }

  updateAnnotations(
    index: number,
    updater: (current: PdfAnnotation[]) => PdfAnnotation[],
  ): void {
    const cached = this.entries.get(index);
    if (!cached) {
      return;
    }
    this.entries.set(index, {
      ...cached,
      annotations: updater(cached.annotations),
    });
  }

  async load(
    index: number,
    loader: () => Promise<CachedPlaylistItem | null>,
    abortSignal?: AbortSignal,
  ): Promise<CachedPlaylistItem | null> {
    const cached = this.entries.get(index);
    if (cached) {
      return cached;
    }

    const pending = this.inflight.get(index);
    if (pending && !pending.signal?.aborted) {
      return pending.promise;
    }

    const generation = (pending?.generation ?? 0) + 1;
    const promise = loader()
      .then((result) => {
        if (this.inflight.get(index)?.generation !== generation) {
          return result;
        }
        this.inflight.delete(index);
        if (result) {
          this.entries.set(index, result);
        }
        return result;
      })
      .catch(() => {
        if (this.inflight.get(index)?.generation === generation) {
          this.inflight.delete(index);
        }
        return null;
      });
    this.inflight.set(index, { promise, signal: abortSignal, generation });
    return promise;
  }

  prefetch(index: number, loader: () => Promise<CachedPlaylistItem | null>): void {
    const pending = this.inflight.get(index);
    if (this.entries.has(index) || (pending && !pending.signal?.aborted)) {
      return;
    }
    void this.load(index, loader);
  }
}
