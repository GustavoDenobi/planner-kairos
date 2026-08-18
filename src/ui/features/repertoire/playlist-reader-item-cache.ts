import * as pdfjs from 'pdfjs-dist';
import type { PdfAnnotation, ReadingPlaylistItemDetail } from '@/domain/repertoire';
import type { RepertoireUseCases } from '@/application/repertoire';

export type CachedPlaylistItem = {
  downloadUrl: string;
  annotations: PdfAnnotation[];
  numPages: number;
  pdfDocument: pdfjs.PDFDocumentProxy;
};

export function isPlaylistItemAvailable(item: ReadingPlaylistItemDetail): boolean {
  return Boolean(item.pieceId) && !item.pieceDeleted;
}

export async function loadPlaylistItemData(
  repertoire: RepertoireUseCases,
  organizationId: string,
  item: ReadingPlaylistItemDetail,
): Promise<CachedPlaylistItem | null> {
  if (!isPlaylistItemAvailable(item) || !item.pieceId) {
    return null;
  }

  const urlResult = await repertoire.getPieceFileDownloadUrl(
    organizationId,
    item.pieceId,
    item.pieceFileId,
  );
  if (!urlResult.ok) {
    return null;
  }

  const [annotationsResult, pdfDocument] = await Promise.all([
    repertoire.listPieceFileAnnotations(organizationId, item.pieceFileId),
    pdfjs.getDocument({ url: urlResult.value }).promise,
  ]);

  return {
    downloadUrl: urlResult.value,
    annotations: annotationsResult.ok ? annotationsResult.value : [],
    numPages: pdfDocument.numPages,
    pdfDocument,
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
