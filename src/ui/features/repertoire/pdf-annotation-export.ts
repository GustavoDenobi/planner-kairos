import type { PDFDocument, PDFOperator, PDFPage } from 'pdf-lib';
import type {
  HighlightGeometry,
  NoteGeometry,
  PdfAnnotation,
  StrokeGeometry,
  TextGeometry,
} from '@/domain/repertoire';
import { ANNOTATION_COLORS, resolveAnnotationAppearance, resolveCoverColor } from '@/domain/repertoire';
import { isAnnotationLayerVisible, type VisibleLayers } from '@/ui/features/repertoire/AnnotationOverlay';
import { resolveAnnotationTextFontFamily } from '@/ui/features/repertoire/annotation-text-metrics';
import { buildHighlightBrushRects } from '@/ui/features/repertoire/highlight-brush';
import { penStrokePath } from '@/ui/features/repertoire/pen-stroke-path';
import { ensureSmuflFontLoaded } from '@/ui/features/repertoire/smufl-font-loader';

type PdfLib = typeof import('pdf-lib');

/** [a b c d e f]: maps normalized display coords (u right, v down, 0..1) to PDF user space. */
export type PageMatrix = [number, number, number, number, number, number];

export type PageDisplayFrame = {
  matrix: PageMatrix;
  /** Displayed (rotated) page size, in PDF points. */
  width: number;
  height: number;
};

/** Raster resolution for text annotations, in pixels per PDF point (~288 DPI). */
const TEXT_RASTER_PIXELS_PER_POINT = 4;
const TEXT_RASTER_MAX_DIMENSION = 8192;
/** Note icon size, in PDF points. */
const NOTE_ICON_SIZE = 18;
/** Annotation flags: Print | NoZoom | NoRotate. */
const NOTE_ANNOTATION_FLAGS = 4 | 8 | 16;

/** Annotations from layers the reader currently shows, across all pages. */
export function selectVisibleAnnotations(
  annotations: readonly PdfAnnotation[],
  visibleLayers: VisibleLayers,
): PdfAnnotation[] {
  return annotations.filter((annotation) => isAnnotationLayerVisible(annotation, visibleLayers));
}

/**
 * Same frame pdf.js uses for its default viewport: crop box, rotated by the page's /Rotate.
 */
export function pageDisplayFrame(
  box: { x: number; y: number; width: number; height: number },
  rotationDegrees: number,
): PageDisplayFrame {
  const rotation = ((Math.round(rotationDegrees / 90) * 90) % 360 + 360) % 360;
  const { x: x0, y: y0, width: w, height: h } = box;
  const x1 = x0 + w;
  const y1 = y0 + h;

  switch (rotation) {
    case 90:
      return { matrix: [0, h, w, 0, x0, y0], width: h, height: w };
    case 180:
      return { matrix: [-w, 0, 0, h, x1, y0], width: w, height: h };
    case 270:
      return { matrix: [0, -h, -w, 0, x1, y1], width: h, height: w };
    default:
      return { matrix: [w, 0, 0, -h, x0, y1], width: w, height: h };
  }
}

export function applyPageMatrix(matrix: PageMatrix, u: number, v: number): { x: number; y: number } {
  const [a, b, c, d, e, f] = matrix;
  return { x: a * u + c * v + e, y: b * u + d * v + f };
}

let colorContext: CanvasRenderingContext2D | null | undefined;

/** CSS color → RGB in 0..1. Falls back to black for colors the export cannot read. */
export function parseRgbColor(color: string): [number, number, number] {
  let value = color.trim();

  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value) && typeof document !== 'undefined') {
    if (colorContext === undefined) {
      colorContext = document.createElement('canvas').getContext('2d');
    }
    if (colorContext) {
      colorContext.fillStyle = '#000000';
      colorContext.fillStyle = value;
      value = String(colorContext.fillStyle);
    }
  }

  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(value);
  if (short) {
    return [short[1]!, short[2]!, short[3]!].map((digit) => Number.parseInt(digit + digit, 16) / 255) as [
      number,
      number,
      number,
    ];
  }

  const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value);
  if (long) {
    return [long[1]!, long[2]!, long[3]!].map((pair) => Number.parseInt(pair, 16) / 255) as [
      number,
      number,
      number,
    ];
  }

  const rgb = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(value);
  if (rgb) {
    return [rgb[1]!, rgb[2]!, rgb[3]!].map((channel) => Math.min(255, Number(channel)) / 255) as [
      number,
      number,
      number,
    ];
  }

  return [0, 0, 0];
}

function isStrokeGeometry(geometry: PdfAnnotation['geometry']): geometry is StrokeGeometry {
  return 'points' in geometry;
}

function isRectGeometry(geometry: PdfAnnotation['geometry']): geometry is HighlightGeometry {
  return 'width' in geometry && 'height' in geometry;
}

function isTextGeometry(geometry: PdfAnnotation['geometry']): geometry is TextGeometry {
  return 'content' in geometry && 'fontSize' in geometry;
}

function isNoteGeometry(geometry: PdfAnnotation['geometry']): geometry is NoteGeometry {
  return 'body' in geometry && !('content' in geometry);
}

/** Path operators for the SVG path built by penStrokePath (M, L and C commands only). */
function svgPathOperators(lib: PdfLib, path: string): PDFOperator[] {
  const tokens = path.trim().split(/\s+/);
  const operators: PDFOperator[] = [];
  let index = 0;
  const next = () => Number(tokens[index++]);

  while (index < tokens.length) {
    const command = tokens[index++];
    if (command === 'M') {
      operators.push(lib.moveTo(next(), next()));
    } else if (command === 'L') {
      operators.push(lib.lineTo(next(), next()));
    } else if (command === 'C') {
      operators.push(lib.appendBezierCurve(next(), next(), next(), next(), next(), next()));
    } else {
      break;
    }
  }

  return operators;
}

function brushRectOperators(
  lib: PdfLib,
  annotation: PdfAnnotation,
  pageAspectRatio: number,
): PDFOperator[] {
  const { geometry } = annotation;

  if (isStrokeGeometry(geometry)) {
    return buildHighlightBrushRects(geometry.points, geometry.strokeWidth, pageAspectRatio).map(
      (rect) => lib.rectangle(rect.x, rect.y, rect.width, rect.height),
    );
  }

  if (isRectGeometry(geometry)) {
    return [lib.rectangle(geometry.x, geometry.y, geometry.width, geometry.height)];
  }

  return [];
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('text_raster_failed'));
        return;
      }
      void blob.arrayBuffer().then((buffer) => resolve(new Uint8Array(buffer)), reject);
    }, 'image/png');
  });
}

type RasterizedText = {
  png: Uint8Array;
  /** Placement in normalized display coords. */
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Text is rasterized with the browser fonts the reader uses, so SMuFL symbols and the
 * handwritten face match the screen without embedding font files.
 */
async function rasterizeText(
  geometry: TextGeometry,
  color: string,
  frame: PageDisplayFrame,
): Promise<RasterizedText | null> {
  if (typeof document === 'undefined' || !geometry.content.trim()) {
    return null;
  }

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    return null;
  }

  let pixelsPerPoint = TEXT_RASTER_PIXELS_PER_POINT;
  const fontFamily = resolveAnnotationTextFontFamily(geometry.fontFamily);
  const fontStyle = geometry.fontStyle === 'italic' ? 'italic' : 'normal';
  const fontWeight = geometry.fontWeight === 'bold' ? 'bold' : 'normal';

  const layout = (scale: number) => {
    const fontPx = geometry.fontSize * frame.width * scale;
    const font = `${fontStyle} ${fontWeight} ${fontPx}px ${fontFamily}`;
    context.font = font;
    const textWidth = context.measureText(geometry.content).width;
    const pad = fontPx * 0.6;
    return {
      font,
      pad,
      canvasWidth: Math.ceil(textWidth + pad * 2),
      canvasHeight: Math.ceil(fontPx * 1.4 + pad * 2),
    };
  };

  const probe = layout(pixelsPerPoint);
  try {
    await document.fonts?.load(probe.font, geometry.content);
  } catch {
    /* Canvas falls back to the next family in the stack. */
  }

  let metrics = layout(pixelsPerPoint);
  const largest = Math.max(metrics.canvasWidth, metrics.canvasHeight);
  if (largest > TEXT_RASTER_MAX_DIMENSION) {
    pixelsPerPoint *= TEXT_RASTER_MAX_DIMENSION / largest;
    metrics = layout(pixelsPerPoint);
  }
  if (metrics.canvasWidth <= 0 || metrics.canvasHeight <= 0) {
    return null;
  }

  canvas.width = metrics.canvasWidth;
  canvas.height = metrics.canvasHeight;
  context.font = metrics.font;
  context.textBaseline = 'hanging';
  context.fillStyle = color;
  context.fillText(geometry.content, metrics.pad, metrics.pad);

  const pixelsPerWidth = frame.width * pixelsPerPoint;
  const pixelsPerHeight = frame.height * pixelsPerPoint;

  return {
    png: await canvasToPng(canvas),
    x: geometry.x - metrics.pad / pixelsPerWidth,
    y: geometry.y - metrics.pad / pixelsPerHeight,
    width: metrics.canvasWidth / pixelsPerWidth,
    height: metrics.canvasHeight / pixelsPerHeight,
  };
}

function addNoteAnnotation(
  lib: PdfLib,
  doc: PDFDocument,
  page: PDFPage,
  frame: PageDisplayFrame,
  annotation: PdfAnnotation,
  geometry: NoteGeometry,
) {
  const anchor = applyPageMatrix(frame.matrix, geometry.x, geometry.y);
  const title = geometry.title?.trim() ?? '';
  const body = geometry.body.trim();
  const contents = title && body ? `${title}\n\n${body}` : title || body;
  const [r, g, b] = parseRgbColor(ANNOTATION_COLORS[annotation.layer]);

  const dict = doc.context.obj({
    Type: 'Annot',
    Subtype: 'Text',
    Rect: [anchor.x, anchor.y - NOTE_ICON_SIZE, anchor.x + NOTE_ICON_SIZE, anchor.y],
    Contents: lib.PDFHexString.fromText(contents),
    Name: 'Comment',
    C: [r, g, b],
    F: NOTE_ANNOTATION_FLAGS,
    Open: false,
  });
  if (title) {
    dict.set(lib.PDFName.of('Subj'), lib.PDFHexString.fromText(title));
  }
  const updatedAt = new Date(annotation.updatedAt);
  if (!Number.isNaN(updatedAt.getTime())) {
    dict.set(lib.PDFName.of('M'), lib.PDFString.fromDate(updatedAt));
  }

  page.node.addAnnot(doc.context.register(dict));
}

async function drawPageAnnotations(
  lib: PdfLib,
  doc: PDFDocument,
  page: PDFPage,
  annotations: PdfAnnotation[],
) {
  const frame = pageDisplayFrame(page.getCropBox(), page.getRotation().angle);
  const pageAspectRatio = frame.width / frame.height;
  const byType = (type: PdfAnnotation['type']) =>
    annotations.filter((annotation) => annotation.type === type);

  // Exports always use the light (non-inverted) palette at full opacity.
  const operators: PDFOperator[] = [
    lib.pushGraphicsState(),
    lib.concatTransformationMatrix(...frame.matrix),
  ];

  // Same stacking as the reader: cover, ink (pen, text), highlight.
  const covers = byType('cover');
  if (covers.length > 0) {
    operators.push(lib.setFillingRgbColor(...parseRgbColor(resolveCoverColor(false))));
    for (const annotation of covers) {
      const rects = brushRectOperators(lib, annotation, pageAspectRatio);
      if (rects.length > 0) {
        operators.push(...rects, lib.fill());
      }
    }
  }

  const strokes = byType('stroke');
  if (strokes.length > 0) {
    operators.push(lib.setLineCap(lib.LineCapStyle.Round), lib.setLineJoin(lib.LineJoinStyle.Round));
    for (const annotation of strokes) {
      if (!isStrokeGeometry(annotation.geometry)) {
        continue;
      }
      const path = svgPathOperators(lib, penStrokePath(annotation.geometry.points));
      if (path.length === 0) {
        continue;
      }
      operators.push(
        lib.setStrokingRgbColor(...parseRgbColor(resolveAnnotationAppearance(annotation, false).stroke)),
        lib.setLineWidth(annotation.geometry.strokeWidth),
        ...path,
        lib.stroke(),
      );
    }
  }

  for (const annotation of byType('text')) {
    if (!isTextGeometry(annotation.geometry)) {
      continue;
    }
    const raster = await rasterizeText(
      annotation.geometry,
      resolveAnnotationAppearance(annotation, false).stroke,
      frame,
    );
    if (!raster) {
      continue;
    }
    const image = await doc.embedPng(raster.png);
    const name = page.node.newXObject('Image', image.ref);
    // Normalized space has v pointing down, so the image is flipped back upright.
    operators.push(
      lib.pushGraphicsState(),
      lib.concatTransformationMatrix(raster.width, 0, 0, -raster.height, raster.x, raster.y + raster.height),
      lib.drawObject(name),
      lib.popGraphicsState(),
    );
  }

  const highlights = byType('highlight');
  if (highlights.length > 0) {
    const multiply = page.node.newExtGState(
      'GS',
      doc.context.obj({ Type: 'ExtGState', BM: 'Multiply' }),
    );
    operators.push(lib.pushGraphicsState(), lib.setGraphicsState(multiply));
    for (const annotation of highlights) {
      const rects = brushRectOperators(lib, annotation, pageAspectRatio);
      if (rects.length === 0) {
        continue;
      }
      // One fill per annotation: overlapping brush stamps paint once, like the reader canvas.
      operators.push(
        lib.setFillingRgbColor(...parseRgbColor(resolveAnnotationAppearance(annotation, false).stroke)),
        ...rects,
        lib.fill(),
      );
    }
    operators.push(lib.popGraphicsState());
  }

  operators.push(lib.popGraphicsState());

  // Isolate the original content stream so its leftover graphics state cannot leak in.
  page.translateContent(0, 0);
  page.pushOperators(...operators);

  for (const annotation of byType('note')) {
    if (isNoteGeometry(annotation.geometry)) {
      addNoteAnnotation(lib, doc, page, frame, annotation, annotation.geometry);
    }
  }
}

/** Returns a copy of the PDF with the given annotations drawn into its pages. */
export async function buildAnnotatedPdf(
  data: Uint8Array,
  annotations: readonly PdfAnnotation[],
): Promise<Uint8Array> {
  const lib = await import('pdf-lib');
  const doc = await lib.PDFDocument.load(data, { updateMetadata: false });
  const pages = doc.getPages();

  if (annotations.some((annotation) => annotation.type === 'text')) {
    await ensureSmuflFontLoaded().catch(() => false);
  }

  const byPage = new Map<number, PdfAnnotation[]>();
  for (const annotation of annotations) {
    const list = byPage.get(annotation.pageNumber);
    if (list) {
      list.push(annotation);
    } else {
      byPage.set(annotation.pageNumber, [annotation]);
    }
  }

  for (const [pageNumber, pageAnnotations] of byPage) {
    const page = pages[pageNumber - 1];
    if (page) {
      await drawPageAnnotations(lib, doc, page, pageAnnotations);
    }
  }

  return doc.save();
}
