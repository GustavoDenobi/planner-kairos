import type { HighlightGeometry, NormalizedPoint, StrokeGeometry } from '@/domain/repertoire';

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

function distanceBetween(a: NormalizedPoint, b: NormalizedPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function distancePointToSegment(
  point: NormalizedPoint,
  start: NormalizedPoint,
  end: NormalizedPoint,
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return distanceBetween(point, start);
  }

  const t = Math.min(
    1,
    Math.max(0, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared),
  );

  return distanceBetween(point, { x: start.x + t * dx, y: start.y + t * dy });
}

function strokeCenterlineDistance(points: NormalizedPoint[], point: NormalizedPoint): number {
  if (points.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  if (points.length === 1) {
    return distanceBetween(point, points[0]!);
  }

  let minDistance = Number.POSITIVE_INFINITY;
  for (let index = 1; index < points.length; index += 1) {
    minDistance = Math.min(
      minDistance,
      distancePointToSegment(point, points[index - 1]!, points[index]!),
    );
  }

  return minDistance;
}

export type HighlightStrokeMode = 'free' | 'horizontal' | 'vertical' | 'rect';

export type CoverDrawMode = HighlightStrokeMode;

/** Minimum normalized width/height for a cover rectangle to be committed. */
export const COVER_RECT_MIN_SIZE = 0.005;

export function normalizedRectFromPoints(
  anchor: NormalizedPoint,
  opposite: NormalizedPoint,
): HighlightGeometry {
  const x = Math.min(anchor.x, opposite.x);
  const y = Math.min(anchor.y, opposite.y);
  return {
    x,
    y,
    width: Math.abs(opposite.x - anchor.x),
    height: Math.abs(opposite.y - anchor.y),
  };
}

export function isCoverRectLargeEnough(rect: HighlightGeometry): boolean {
  return rect.width >= COVER_RECT_MIN_SIZE && rect.height >= COVER_RECT_MIN_SIZE;
}

export function constrainHighlightPointToHorizontalAxis(
  point: NormalizedPoint,
  anchorY: number,
): NormalizedPoint {
  return { x: point.x, y: anchorY };
}

export function constrainHighlightPointToVerticalAxis(
  point: NormalizedPoint,
  anchorX: number,
): NormalizedPoint {
  return { x: anchorX, y: point.y };
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

export function constrainHighlightStrokeToVerticalAxis(
  points: NormalizedPoint[],
): NormalizedPoint[] {
  if (points.length === 0) {
    return points;
  }

  const anchorX = points[0]!.x;
  return points.map((point) => constrainHighlightPointToVerticalAxis(point, anchorX));
}

export function constrainHighlightPoint(
  point: NormalizedPoint,
  mode: HighlightStrokeMode,
  anchor: NormalizedPoint,
): NormalizedPoint {
  if (mode === 'horizontal') {
    return constrainHighlightPointToHorizontalAxis(point, anchor.y);
  }
  if (mode === 'vertical') {
    return constrainHighlightPointToVerticalAxis(point, anchor.x);
  }
  return point;
}

export function constrainHighlightStroke(
  points: NormalizedPoint[],
  mode: HighlightStrokeMode,
): NormalizedPoint[] {
  if (mode === 'horizontal') {
    return constrainHighlightStrokeToHorizontalAxis(points);
  }
  if (mode === 'vertical') {
    return constrainHighlightStrokeToVerticalAxis(points);
  }
  return points;
}

/**
 * Distance from a point to a highlight/cover stroke without rebuilding brush stamps.
 * Zero when the point lies within the brush reach of the centerline.
 */
export function highlightStrokeHitDistance(
  geometry: StrokeGeometry,
  point: NormalizedPoint,
  pageAspectRatio: number,
): number {
  const { width, height } = highlightBrushDimensions(geometry.strokeWidth, pageAspectRatio);
  const reach = Math.max(width, height) / 2;
  const centerline = strokeCenterlineDistance(geometry.points, point);
  if (!Number.isFinite(centerline)) {
    return centerline;
  }
  return Math.max(0, centerline - reach);
}

/** Max deviation, in normalized page units, when compacting a newly drawn stroke. */
export const STROKE_SIMPLIFY_EPSILON = 0.0015;

function perpendicularDistance(
  point: NormalizedPoint,
  start: NormalizedPoint,
  end: NormalizedPoint,
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return distanceBetween(point, start);
  }

  const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
  return distanceBetween(point, { x: start.x + t * dx, y: start.y + t * dy });
}

function douglasPeucker(points: NormalizedPoint[], epsilon: number): NormalizedPoint[] {
  const kept = new Array<boolean>(points.length).fill(false);
  kept[0] = true;
  kept[points.length - 1] = true;
  const stack: Array<[number, number]> = [[0, points.length - 1]];

  while (stack.length > 0) {
    const range = stack.pop();
    if (!range) {
      break;
    }
    const [start, end] = range;
    let maxDistance = 0;
    let maxIndex = -1;

    for (let index = start + 1; index < end; index += 1) {
      const distance = perpendicularDistance(points[index]!, points[start]!, points[end]!);
      if (distance > maxDistance) {
        maxDistance = distance;
        maxIndex = index;
      }
    }

    if (maxIndex !== -1 && maxDistance > epsilon) {
      kept[maxIndex] = true;
      stack.push([start, maxIndex], [maxIndex, end]);
    }
  }

  const simplified: NormalizedPoint[] = [];
  for (let index = 0; index < points.length; index += 1) {
    if (kept[index]) {
      simplified.push(points[index]!);
    }
  }
  return simplified;
}

/** Pen compaction stays well inside the stroke width so handwriting keeps its shape. */
export const PEN_SIMPLIFY_WIDTH_RATIO = 0.2;

/** Compacts a newly drawn stroke. Callers must not run this on geometry already stored. */
export function simplifyStrokeGeometry(
  geometry: StrokeGeometry,
  epsilon = STROKE_SIMPLIFY_EPSILON,
): StrokeGeometry {
  if (geometry.points.length <= 2) {
    return geometry;
  }

  const points = douglasPeucker(geometry.points, epsilon);
  if (points.length < 2) {
    return {
      ...geometry,
      points: [geometry.points[0]!, geometry.points[geometry.points.length - 1]!],
    };
  }

  if (points.length === geometry.points.length) {
    return geometry;
  }

  return { ...geometry, points };
}

/** Compacts a new pen stroke. Highlight and cover keep the wider fixed epsilon. */
export function simplifyPenStrokeGeometry(geometry: StrokeGeometry): StrokeGeometry {
  const epsilon = Math.max(geometry.strokeWidth * PEN_SIMPLIFY_WIDTH_RATIO, 0.00005);
  return simplifyStrokeGeometry(geometry, epsilon);
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
