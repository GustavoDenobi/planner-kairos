import type { NormalizedPoint, PdfAnnotation, StrokeGeometry } from '@/domain/repertoire';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function toNormalizedCoords(
  clientX: number,
  clientY: number,
  rect: DOMRect,
): NormalizedPoint {
  if (rect.width <= 0 || rect.height <= 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: clamp((clientX - rect.left) / rect.width, 0, 1),
    y: clamp((clientY - rect.top) / rect.height, 0, 1),
  };
}

/** Pen stroke width as a fraction of page width (scales with zoom). */
export const PEN_STROKE_WIDTH = 0.003;

/** Highlighter stroke width as a fraction of page width. */
export const HIGHLIGHT_STROKE_WIDTH = 0.028;

/** Hit-test radius for eraser, as a fraction of page width. */
export const ERASER_HIT_RADIUS = 0.02;

function isStrokeGeometry(geometry: PdfAnnotation['geometry']): geometry is StrokeGeometry {
  return 'points' in geometry;
}

function distanceBetween(a: NormalizedPoint, b: NormalizedPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
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

  const t = clamp(
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared,
    0,
    1,
  );

  return distanceBetween(point, { x: start.x + t * dx, y: start.y + t * dy });
}

function strokeHitDistance(geometry: StrokeGeometry, point: NormalizedPoint): number {
  let minDistance = Number.POSITIVE_INFINITY;

  for (let index = 1; index < geometry.points.length; index += 1) {
    const segmentDistance = distancePointToSegment(
      point,
      geometry.points[index - 1]!,
      geometry.points[index]!,
    );
    minDistance = Math.min(minDistance, segmentDistance);
  }

  return minDistance;
}

function legacyHighlightHitDistance(
  geometry: { x: number; y: number; width: number; height: number },
  point: NormalizedPoint,
): number {
  const inside =
    point.x >= geometry.x &&
    point.x <= geometry.x + geometry.width &&
    point.y >= geometry.y &&
    point.y <= geometry.y + geometry.height;

  if (inside) {
    return 0;
  }

  const closestX = clamp(point.x, geometry.x, geometry.x + geometry.width);
  const closestY = clamp(point.y, geometry.y, geometry.y + geometry.height);
  return distanceBetween(point, { x: closestX, y: closestY });
}

export function findAnnotationAtPoint(
  annotations: PdfAnnotation[],
  point: NormalizedPoint,
  radius: number = ERASER_HIT_RADIUS,
): PdfAnnotation | null {
  let closest: PdfAnnotation | null = null;
  let closestDistance = radius;

  for (const annotation of annotations) {
    let distance = Number.POSITIVE_INFINITY;

    if (isStrokeGeometry(annotation.geometry)) {
      distance = strokeHitDistance(annotation.geometry, point);
    } else if ('width' in annotation.geometry && 'height' in annotation.geometry) {
      distance = legacyHighlightHitDistance(annotation.geometry, point);
    }

    if (distance <= closestDistance) {
      closest = annotation;
      closestDistance = distance;
    }
  }

  return closest;
}

export function isDraftAnnotationId(id: string): boolean {
  return id.startsWith('draft-');
}
