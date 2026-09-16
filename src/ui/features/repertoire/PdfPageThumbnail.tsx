import { useEffect, useRef, useState } from 'react';
import type * as pdfjs from 'pdfjs-dist';

type PdfPageThumbnailProps = {
  pdf: pdfjs.PDFDocumentProxy;
  pageNumber: number;
  maxWidth: number;
  inverted?: boolean;
};

export function PdfPageThumbnail({
  pdf,
  pageNumber,
  maxWidth,
  inverted = false,
}: PdfPageThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    let cancelled = false;
    let renderTask: pdfjs.RenderTask | null = null;

    pdf.getPage(pageNumber).then((page) => {
      if (cancelled) {
        return;
      }

      const baseViewport = page.getViewport({ scale: 1 });
      const scale = maxWidth / baseViewport.width;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      setDimensions({ width: viewport.width, height: viewport.height });

      const context = canvas.getContext('2d');
      if (!context) {
        return;
      }

      renderTask = page.render({ canvasContext: context, viewport, canvas });
      return renderTask.promise;
    });

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdf, pageNumber, maxWidth]);

  return (
    <div
      className={inverted ? 'invert' : ''}
      style={{ width: dimensions.width > 0 ? dimensions.width : maxWidth }}
    >
      <canvas
        ref={canvasRef}
        className={`block ${inverted ? 'bg-black' : 'bg-white'}`}
        style={{
          width: dimensions.width > 0 ? dimensions.width : undefined,
          height: dimensions.height > 0 ? dimensions.height : undefined,
        }}
      />
    </div>
  );
}
