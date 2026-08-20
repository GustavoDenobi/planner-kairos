import type { OfflineUseCases } from '@/application/offline';
import { OFFLINE_SIZE_WARNING_BYTES } from '@/application/offline/types';
import type { ResolvedPieceFile } from '@/application/offline';
import * as pdfjs from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const PDFJS_LOAD_OPTIONS = {
  // Avoid extra wasm/cmap fetches that fail when the app is offline.
  useWasm: false,
  useWorkerFetch: false,
} as const;

export function revokePdfObjectUrl(url: string | null | undefined): void {
  if (url?.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

function createPdfObjectUrl(data: ArrayBuffer): string {
  return URL.createObjectURL(new Blob([data.slice(0)], { type: 'application/pdf' }));
}

export function openPdfDocument(
  source: { data: ArrayBuffer } | { url: string },
): pdfjs.PDFDocumentLoadingTask {
  if ('data' in source) {
    return pdfjs.getDocument({
      data: new Uint8Array(source.data.slice(0)),
      ...PDFJS_LOAD_OPTIONS,
    });
  }

  return pdfjs.getDocument({
    url: source.url,
    ...PDFJS_LOAD_OPTIONS,
  });
}

export async function resolvePdfDocument(
  offline: OfflineUseCases,
  organizationId: string,
  pieceId: string,
  fileId: string,
): Promise<{
  resolved: ResolvedPieceFile | null;
  pdfDocument: pdfjs.PDFDocumentProxy | null;
  downloadUrl: string | null;
  error: string | null;
}> {
  const result = await offline.resolvePieceFileForReading(organizationId, pieceId, fileId);
  if (!result.ok) {
    return {
      resolved: null,
      pdfDocument: null,
      downloadUrl: null,
      error: result.error,
    };
  }

  const resolved = result.value;
  let localDownloadUrl: string | null = null;
  try {
    if (resolved.source === 'local') {
      localDownloadUrl = createPdfObjectUrl(resolved.data);
      const pdfDocument = await openPdfDocument({ data: resolved.data }).promise;
      return {
        resolved,
        pdfDocument,
        downloadUrl: localDownloadUrl,
        error: null,
      };
    }

    const pdfDocument = await openPdfDocument({ url: resolved.url }).promise;
    return {
      resolved,
      pdfDocument,
      downloadUrl: resolved.url,
      error: null,
    };
  } catch {
    revokePdfObjectUrl(localDownloadUrl);
    return {
      resolved,
      pdfDocument: null,
      downloadUrl: resolved.source === 'remote' ? resolved.url : null,
      error: 'load_failed',
    };
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function shouldWarnDownloadSize(bytes: number): boolean {
  return bytes > OFFLINE_SIZE_WARNING_BYTES;
}
