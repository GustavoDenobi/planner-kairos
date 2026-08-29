import { describe, expect, it } from 'vitest';
import type { PdfAnnotation } from '@/domain/repertoire';
import {
  ERASER_HIT_RADIUS,
  findAnnotationAtPoint,
  PEN_STROKE_WIDTH,
  toNormalizedCoords,
} from './annotation-coordinates';

describe('toNormalizedCoords', () => {
  const rect = new DOMRect(100, 50, 200, 400);

  it('converts client coordinates to normalized values', () => {
    expect(toNormalizedCoords(200, 250, rect)).toEqual({ x: 0.5, y: 0.5 });
  });

  it('clamps coordinates to the page bounds', () => {
    expect(toNormalizedCoords(50, 10, rect)).toEqual({ x: 0, y: 0 });
    expect(toNormalizedCoords(400, 600, rect)).toEqual({ x: 1, y: 1 });
  });

  it('returns zero when rect has no size', () => {
    expect(toNormalizedCoords(10, 10, new DOMRect(0, 0, 0, 0))).toEqual({ x: 0, y: 0 });
  });
});

describe('findAnnotationAtPoint', () => {
  const strokeAnnotation: PdfAnnotation = {
    id: 'a-1',
    organizationId: 'org',
    pieceFileId: 'file',
    pageNumber: 1,
    layer: 'personal',
    type: 'stroke',
    geometry: {
      points: [
        { x: 0.1, y: 0.1 },
        { x: 0.5, y: 0.5 },
      ],
      strokeWidth: PEN_STROKE_WIDTH,
    },
    color: '#2563eb',
    authorUserId: 'user',
    sectionId: null,
    annotationSetId: null,
    createdAt: '',
    updatedAt: '',
  };

  it('finds a stroke near the pointer', () => {
    expect(findAnnotationAtPoint([strokeAnnotation], { x: 0.3, y: 0.3 }, ERASER_HIT_RADIUS)?.id).toBe(
      'a-1',
    );
  });

  it('returns null when nothing is close enough', () => {
    expect(findAnnotationAtPoint([strokeAnnotation], { x: 0.9, y: 0.9 }, ERASER_HIT_RADIUS)).toBeNull();
  });
});

describe('PEN_STROKE_WIDTH', () => {
  it('is a visible fraction of the page', () => {
    expect(PEN_STROKE_WIDTH).toBeGreaterThan(0.001);
    expect(PEN_STROKE_WIDTH).toBeLessThan(0.05);
  });
});
