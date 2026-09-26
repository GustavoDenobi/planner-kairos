import type { NormalizedPoint, PdfAnnotation, StrokeGeometry, TextGeometry } from '@/domain/repertoire';
import { estimateTextBBox } from '@/ui/features/repertoire/annotation-text-metrics';
import {
  HIGHLIGHT_STROKE_WIDTH as HIGHLIGHT_STROKE_WIDTH_RANGE,
  PEN_STROKE_WIDTH as PEN_STROKE_WIDTH_RANGE,
} from '@/domain/repertoire';
import { highlightStrokeHitDistance } from '@/ui/features/repertoire/highlight-brush';
import { penStrokeHitDistance } from '@/ui/features/repertoire/pen-stroke-path';

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

/** Default pen stroke width as a fraction of page width (scales with zoom). */
export const PEN_STROKE_WIDTH = PEN_STROKE_WIDTH_RANGE.default;

/** Default highlighter stroke width as a fraction of page width. */
export const HIGHLIGHT_STROKE_WIDTH = HIGHLIGHT_STROKE_WIDTH_RANGE.default;

/** Hit-test radius for eraser, as a fraction of page width. */
export const ERASER_HIT_RADIUS = 0.02;

function isStrokeGeometry(geometry: PdfAnnotation['geometry']): geometry is StrokeGeometry {
  return 'points' in geometry;
}

function isTextGeometry(geometry: PdfAnnotation['geometry']): geometry is TextGeometry {
  return 'content' in geometry && 'fontSize' in geometry;
}

function isNoteGeometry(
  geometry: PdfAnnotation['geometry'],
): geometry is Extract<PdfAnnotation['geometry'], { body: string }> {
  return 'body' in geometry && !('content' in geometry);
}

/** Collapsed note marker size, as a fraction of page width/height. */
export const NOTE_MARKER_HIT_WIDTH = 0.12;
export const NOTE_MARKER_HIT_HEIGHT = 0.04;

function distanceBetween(a: NormalizedPoint, b: NormalizedPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
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

function annotationHitDistance(
  annotation: PdfAnnotation,
  point: NormalizedPoint,
  pageAspectRatio: number,
): number {
  if (
    (annotation.type === 'highlight' || annotation.type === 'cover')
    && isStrokeGeometry(annotation.geometry)
  ) {
    return highlightStrokeHitDistance(annotation.geometry, point, pageAspectRatio);
  }

  if (annotation.type === 'cover' && 'width' in annotation.geometry && 'height' in annotation.geometry) {
    return legacyHighlightHitDistance(annotation.geometry, point);
  }

  if (annotation.type === 'note' && isNoteGeometry(annotation.geometry)) {
    return legacyHighlightHitDistance(
      {
        x: annotation.geometry.x,
        y: annotation.geometry.y,
        width: NOTE_MARKER_HIT_WIDTH,
        height: NOTE_MARKER_HIT_HEIGHT,
      },
      point,
    );
  }

  if (annotation.type === 'text' && isTextGeometry(annotation.geometry)) {
    const bbox = estimateTextBBox(annotation.geometry, pageAspectRatio);
    return legacyHighlightHitDistance(bbox, point);
  }

  if (isStrokeGeometry(annotation.geometry)) {
    return penStrokeHitDistance(annotation.geometry.points, point);
  }

  if ('width' in annotation.geometry && 'height' in annotation.geometry) {
    return legacyHighlightHitDistance(annotation.geometry, point);
  }

  return Number.POSITIVE_INFINITY;
}

export function findAnnotationAtPoint(
  annotations: PdfAnnotation[],
  point: NormalizedPoint,
  radius: number = ERASER_HIT_RADIUS,
  pageAspectRatio: number = 1,
): PdfAnnotation | null {
  let closest: PdfAnnotation | null = null;
  let closestDistance = radius;

  for (const annotation of annotations) {
    const distance = annotationHitDistance(annotation, point, pageAspectRatio);

    if (distance <= closestDistance) {
      closest = annotation;
      closestDistance = distance;
    }
  }

  return closest;
}

export function findErasableAnnotationAtPoint(
  annotations: PdfAnnotation[],
  point: NormalizedPoint,
  canErase: (annotation: PdfAnnotation) => boolean,
  radius: number = ERASER_HIT_RADIUS,
  pageAspectRatio: number = 1,
): PdfAnnotation | null {
  let closest: PdfAnnotation | null = null;
  let closestDistance = radius;

  for (const annotation of annotations) {
    if (!canErase(annotation)) {
      continue;
    }

    const distance = annotationHitDistance(annotation, point, pageAspectRatio);

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
