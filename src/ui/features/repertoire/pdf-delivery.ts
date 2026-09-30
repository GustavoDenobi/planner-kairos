import type * as pdfjs from 'pdfjs-dist';

export function pdfShareFilename(name?: string | null): string {
  const trimmed = name?.trim();
  if (!trimmed) {
    return 'partitura.pdf';
  }
  return trimmed.toLowerCase().endsWith('.pdf') ? trimmed : `${trimmed}.pdf`;
}

export function isShareCancellation(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export async function sharePdfDocument(
  pdf: pdfjs.PDFDocumentProxy,
  filename?: string | null,
): Promise<void> {
  const data = await pdf.getData();
  const file = new File([new Blob([data], { type: 'application/pdf' })], pdfShareFilename(filename), {
    type: 'application/pdf',
  });

  if (!navigator.canShare?.({ files: [file] }) || typeof navigator.share !== 'function') {
    throw new Error('share_unavailable');
  }

  await navigator.share({ files: [file], title: file.name });
}
