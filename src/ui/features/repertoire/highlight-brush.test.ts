import { describe, expect, it } from 'vitest';
import {
  buildHighlightBrushRects,
  fitRectToBounds,
  highlightBrushDimensions,
  highlightBrushRectAtPoint,
  highlightStrokeHitDistance,
  HIGHLIGHT_BRUSH_HEIGHT_RATIO,
  HIGHLIGHT_BRUSH_WIDTH_SCALE,
  strokeWidthToPreviewPixels,
} from './highlight-brush';

describe('highlight-brush', () => {
  it('computes fixed-orientation brush dimensions', () => {
    const portrait = highlightBrushDimensions(0.02, 0.75);
    expect(portrait.width).toBeCloseTo(0.02 * HIGHLIGHT_BRUSH_WIDTH_SCALE);
    expect(portrait.height).toBeCloseTo(0.02 * HIGHLIGHT_BRUSH_HEIGHT_RATIO * 0.75);
    expect(portrait.height).toBeGreaterThan(portrait.width);
  });

  it('densifies horizontal strokes into overlapping vertical stamps', () => {
    const rects = buildHighlightBrushRects(
      [
        { x: 0.2, y: 0.5 },
        { x: 0.8, y: 0.5 },
      ],
      0.04,
      1,
    );
    expect(rects.length).toBeGreaterThan(3);
    expect(rects.every((rect) => rect.height > rect.width)).toBe(true);
    expect(highlightStrokeHitDistance(
      { points: [{ x: 0.2, y: 0.5 }, { x: 0.8, y: 0.5 }], strokeWidth: 0.04 },
      { x: 0.5, y: 0.5 },
      1,
    )).toBe(0);
  });

  it('does not fill the axis-aligned bounding box of a diagonal stroke', () => {
    const geometry = {
      points: [
        { x: 0.1, y: 0.9 },
        { x: 0.9, y: 0.1 },
      ],
      strokeWidth: 0.03,
    };
    expect(highlightStrokeHitDistance(geometry, { x: 0.1, y: 0.1 }, 1)).toBeGreaterThan(0.01);
    expect(highlightStrokeHitDistance(geometry, { x: 0.5, y: 0.5 }, 1)).toBe(0);
  });

  it('builds one rect for a single point tap', () => {
    const rect = highlightBrushRectAtPoint({ x: 0.5, y: 0.5 }, 0.02, 1);
    expect(rect.x).toBeCloseTo(0.5 - 0.02 * HIGHLIGHT_BRUSH_WIDTH_SCALE / 2);
  });

  it('maps stroke width to preview pixels', () => {
    expect(strokeWidthToPreviewPixels(0.003, 0.001, 0.008, 4, 16)).toBeCloseTo(7.43, 1);
    expect(strokeWidthToPreviewPixels(0.008, 0.001, 0.008, 4, 16)).toBe(16);
  });

  it('scales preview rect down to fit bounds', () => {
    expect(fitRectToBounds(28, 84, 72, 48)).toEqual({ width: 16, height: 48 });
    expect(fitRectToBounds(10, 30, 72, 48)).toEqual({ width: 10, height: 30 });
  });
});
