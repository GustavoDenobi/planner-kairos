import type * as pdfjs from 'pdfjs-dist';
import { printPdfDocument } from '@/ui/features/repertoire/pdf-load';

const ANDROID_PATTERN = /Android/i;
const IOS_DEVICE_PATTERN = /iPhone|iPad|iPod/i;

type MobileShareContextInput = {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
};

function isMobileShareContext(input: MobileShareContextInput): boolean {
  if (ANDROID_PATTERN.test(input.userAgent) || IOS_DEVICE_PATTERN.test(input.userAgent)) {
    return true;
  }
  return input.platform === 'MacIntel' && (input.maxTouchPoints ?? 0) > 1;
}

function canSharePdfFiles(): boolean {
  if (typeof navigator === 'undefined' || typeof File === 'undefined') {
    return false;
  }
  if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') {
    return false;
  }

  try {
    const probe = new File(['%PDF-1.4'], 'partitura.pdf', { type: 'application/pdf' });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

export function shouldSharePdfInsteadOfPrint(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  if (!canSharePdfFiles()) {
    return false;
  }

  return isMobileShareContext({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
  });
}

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

export async function deliverPdfDocument(
  pdf: pdfjs.PDFDocumentProxy,
  filename?: string | null,
): Promise<void> {
  if (shouldSharePdfInsteadOfPrint()) {
    await sharePdfDocument(pdf, filename);
    return;
  }

  await printPdfDocument(pdf);
}
