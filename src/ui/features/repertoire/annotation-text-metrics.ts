import type { TextFontFamily, TextGeometry } from '@/domain/repertoire';
import { DEFAULT_TEXT_FONT_FAMILY, normalizeTextFontFamily } from '@/domain/repertoire';

/** Unique family name avoids local "Bravura Text" installs and OFL reserved names. */
export const ANNOTATION_SMUFL_FONT_FAMILY = 'Planner Music Symbols';

const TEXT_FONT_STACKS: Record<TextFontFamily, string> = {
  'sans-serif': 'Inter, system-ui, sans-serif',
  serif: '"Times New Roman", Georgia, Times, serif',
  monospace: 'Consolas, "Cascadia Code", ui-monospace, monospace',
  handwritten: '"Caveat", cursive',
};

export function resolveTextFontStack(fontFamily?: TextFontFamily | null): string {
  return TEXT_FONT_STACKS[normalizeTextFontFamily(fontFamily ?? DEFAULT_TEXT_FONT_FAMILY)];
}

/** Bravura Text first so SMuFL glyphs render; text uses the selected stack. */
export function resolveAnnotationTextFontFamily(fontFamily?: TextFontFamily | null): string {
  return `'${ANNOTATION_SMUFL_FONT_FAMILY}', ${resolveTextFontStack(fontFamily)}`;
}

export const SMUFL_GLYPH_FONT_FAMILY = `'${ANNOTATION_SMUFL_FONT_FAMILY}', sans-serif`;

/** @deprecated Use resolveAnnotationTextFontFamily() */
export const ANNOTATION_TEXT_FONT_FAMILY = resolveAnnotationTextFontFamily();

let measureCanvas: HTMLCanvasElement | null = null;
let measureContext: CanvasRenderingContext2D | null = null;
let measureContextUnavailable = false;

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (measureContextUnavailable || typeof document === 'undefined') {
    return null;
  }

  if (!measureCanvas) {
    measureCanvas = document.createElement('canvas');
  }

  if (!measureContext) {
    try {
      measureContext = measureCanvas.getContext('2d');
      if (!measureContext) {
        measureContextUnavailable = true;
      }
    } catch {
      measureContextUnavailable = true;
      return null;
    }
  }

  return measureContext;
}

function canvasFontString(geometry: TextGeometry, pageWidth: number): string {
  const fontSizePx = textFontSizePixels(geometry.fontSize, pageWidth);
  const fontFamily = resolveAnnotationTextFontFamily(geometry.fontFamily);
  const fontWeight = geometry.fontWeight === 'bold' ? 'bold' : 'normal';
  const fontStyle = geometry.fontStyle === 'italic' ? 'italic' : 'normal';
  return `${fontStyle} ${fontWeight} ${fontSizePx}px ${fontFamily}`;
}

export function textFontSizePixels(fontSize: number, pageWidth: number): number {
  return fontSize * pageWidth;
}

export function estimateTextBBox(
  geometry: TextGeometry,
  pageAspectRatio: number,
  pageWidth = 1,
): { x: number; y: number; width: number; height: number } {
  const fontSizePx = textFontSizePixels(geometry.fontSize, pageWidth);
  const context = getMeasureContext();
  let widthPx = geometry.content.length * fontSizePx * 0.55;

  if (context) {
    context.font = canvasFontString(geometry, pageWidth);
    widthPx = context.measureText(geometry.content).width;
  }

  const width = widthPx / pageWidth;
  const height = geometry.fontSize * 1.2;
  const yOffset = geometry.fontSize * 0.05 / pageAspectRatio;

  return {
    x: geometry.x,
    y: geometry.y - yOffset,
    width: Math.max(width, geometry.fontSize * 0.4),
    height,
  };
}
