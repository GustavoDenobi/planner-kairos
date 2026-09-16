import type { NormalizedPoint, StrokeGeometry } from '@/domain/repertoire';

/** On-screen height = brush width × this ratio. */
export const HIGHLIGHT_BRUSH_HEIGHT_RATIO = 3.5;

/** Extra horizontal width for the fixed vertical brush tip. */
export const HIGHLIGHT_BRUSH_WIDTH_SCALE = 1.25;

/** Fraction of brush width between interpolated samples along the path. */
export const HIGHLIGHT_STAMP_STEP_FACTOR = 0.15;

export type NormalizedRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function highlightBrushDimensions(
  brushWidth: number,
  pageAspectRatio: number,
): { width: number; height: number } {
  const safeAspectRatio = pageAspectRatio > 0 ? pageAspectRatio : 1;
  return {
    width: brushWidth * HIGHLIGHT_BRUSH_WIDTH_SCALE,
    height: brushWidth * HIGHLIGHT_BRUSH_HEIGHT_RATIO * safeAspectRatio,
  };
}

export function highlightBrushRectAtPoint(
  point: NormalizedPoint,
  brushWidth: number,
  pageAspectRatio: number,
): NormalizedRect {
  const { width, height } = highlightBrushDimensions(brushWidth, pageAspectRatio);
  return {
    x: point.x - width / 2,
    y: point.y - height / 2,
    width,
    height,
  };
}

function densifyStrokePoints(
  points: NormalizedPoint[],
  maxStep: number,
): NormalizedPoint[] {
  if (points.length === 0) {
    return [];
  }

  const densified: NormalizedPoint[] = [points[0]!];

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]!;
    const end = points[index + 1]!;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);

    if (length <= maxStep) {
      densified.push(end);
      continue;
    }

    const steps = Math.ceil(length / maxStep);
    for (let step = 1; step <= steps; step += 1) {
      const t = step / steps;
      densified.push({
        x: start.x + dx * t,
        y: start.y + dy * t,
      });
    }
  }

  return densified;
}

/**
 * Fixed-orientation vertical brush stamps along the path.
 * Render inside a single blend-mode group to avoid overlap darkening.
 */
export function buildHighlightBrushRects(
  points: NormalizedPoint[],
  brushWidth: number,
  pageAspectRatio: number,
): NormalizedRect[] {
  if (points.length === 0) {
    return [];
  }

  if (points.length === 1) {
    return [highlightBrushRectAtPoint(points[0]!, brushWidth, pageAspectRatio)];
  }

  const { width } = highlightBrushDimensions(brushWidth, pageAspectRatio);
  const maxStep = Math.max(width * HIGHLIGHT_STAMP_STEP_FACTOR, 0.0005);
  const densified = densifyStrokePoints(points, maxStep);

  return densified.map((point) => highlightBrushRectAtPoint(point, brushWidth, pageAspectRatio));
}

function rectHitDistance(rect: NormalizedRect, point: NormalizedPoint): number {
  const inside =
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height;

  if (inside) {
    return 0;
  }

  const closestX = Math.min(Math.max(point.x, rect.x), rect.x + rect.width);
  const closestY = Math.min(Math.max(point.y, rect.y), rect.y + rect.height);
  return Math.hypot(point.x - closestX, point.y - closestY);
}

export function constrainHighlightPointToHorizontalAxis(
  point: NormalizedPoint,
  anchorY: number,
): NormalizedPoint {
  return { x: point.x, y: anchorY };
}

export function constrainHighlightStrokeToHorizontalAxis(
  points: NormalizedPoint[],
): NormalizedPoint[] {
  if (points.length === 0) {
    return points;
  }

  const anchorY = points[0]!.y;
  return points.map((point) => constrainHighlightPointToHorizontalAxis(point, anchorY));
}

export function highlightStrokeHitDistance(
  geometry: StrokeGeometry,
  point: NormalizedPoint,
  pageAspectRatio: number,
): number {
  const rects = buildHighlightBrushRects(geometry.points, geometry.strokeWidth, pageAspectRatio);
  let minDistance = Number.POSITIVE_INFINITY;

  for (const rect of rects) {
    minDistance = Math.min(minDistance, rectHitDistance(rect, point));
  }

  return minDistance;
}

/** On-screen pen stroke diameter in CSS pixels (matches SVG overlay rendering). */
export function penStrokePreviewPixels(strokeWidth: number, pageRenderWidth: number): number {
  if (pageRenderWidth <= 0 || strokeWidth <= 0) {
    return 0;
  }
  return strokeWidth * pageRenderWidth;
}

/** On-screen highlight brush stamp size in CSS pixels (matches SVG overlay rendering). */
export function highlightBrushPreviewPixels(
  strokeWidth: number,
  pageRenderWidth: number,
): { width: number; height: number } {
  if (pageRenderWidth <= 0 || strokeWidth <= 0) {
    return { width: 0, height: 0 };
  }

  return {
    width: strokeWidth * HIGHLIGHT_BRUSH_WIDTH_SCALE * pageRenderWidth,
    height: strokeWidth * HIGHLIGHT_BRUSH_HEIGHT_RATIO * pageRenderWidth,
  };
}
