import type * as pdfjs from 'pdfjs-dist';

export type PageLayoutSize = {
  width: number;
  height: number;
};

const baseLayoutCache = new WeakMap<pdfjs.PDFDocumentProxy, Map<number, PageLayoutSize>>();

export async function getBasePageLayout(
  pdf: pdfjs.PDFDocumentProxy,
  pageNumber: number,
): Promise<PageLayoutSize> {
  let pdfCache = baseLayoutCache.get(pdf);
  if (!pdfCache) {
    pdfCache = new Map();
    baseLayoutCache.set(pdf, pdfCache);
  }

  const cached = pdfCache.get(pageNumber);
  if (cached) {
    return cached;
  }

  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const layout = { width: viewport.width, height: viewport.height };
  pdfCache.set(pageNumber, layout);
  return layout;
}

export function scalePageLayout(layout: PageLayoutSize, scale: number): PageLayoutSize {
  return {
    width: layout.width * scale,
    height: layout.height * scale,
  };
}

export function clearPdfLayoutCache(pdf: pdfjs.PDFDocumentProxy): void {
  baseLayoutCache.delete(pdf);
}
