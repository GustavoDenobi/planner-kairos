import type { OfflineUseCases } from '@/application/offline';
import { OFFLINE_SIZE_WARNING_BYTES } from '@/application/offline/types';
import type { ResolvedPieceFile } from '@/application/offline';
import * as pdfjs from 'pdfjs-dist';

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
  try {
    if (resolved.source === 'local') {
      const pdfDocument = await pdfjs.getDocument({ data: resolved.data }).promise;
      return {
        resolved,
        pdfDocument,
        downloadUrl: null,
        error: null,
      };
    }

    const pdfDocument = await pdfjs.getDocument({ url: resolved.url }).promise;
    return {
      resolved,
      pdfDocument,
      downloadUrl: resolved.url,
      error: null,
    };
  } catch {
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
