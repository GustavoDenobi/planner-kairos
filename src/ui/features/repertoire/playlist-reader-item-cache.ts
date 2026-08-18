import * as pdfjs from 'pdfjs-dist';
import type { PdfAnnotation, ReadingPlaylistItemDetail } from '@/domain/repertoire';
import type { OfflineUseCases } from '@/application/offline';
import { resolvePdfDocument } from '@/ui/features/repertoire/pdf-load';

export type CachedPlaylistItem = {
  downloadUrl: string | null;
  annotations: PdfAnnotation[];
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
): Promise<CachedPlaylistItem | null> {
  if (!isPlaylistItemAvailable(item) || !item.pieceId) {
    return null;
  }

  const statusResult = await offline.getOfflineStatus(
    organizationId,
    item.pieceId,
    item.pieceFileId,
  );
  const isCachedLocally =
    statusResult.ok && statusResult.value.fileStatus !== 'not_cached';

  const pdfLoad = await resolvePdfDocument(
    offline,
    organizationId,
    item.pieceId,
    item.pieceFileId,
  );

  if (!pdfLoad.pdfDocument) {
    return null;
  }

  const annotationsResult = await offline.listAnnotationsForReading(
    organizationId,
    item.pieceFileId,
  );

  return {
    downloadUrl: pdfLoad.downloadUrl,
    annotations: annotationsResult.ok ? annotationsResult.value : [],
    numPages: pdfLoad.pdfDocument.numPages,
    pdfDocument: pdfLoad.pdfDocument,
    isCachedLocally,
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

    const promise = loader().then((result) => {
      this.inflight.delete(index);
      if (result) {
        this.entries.set(index, result);
      }
      return result;
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
