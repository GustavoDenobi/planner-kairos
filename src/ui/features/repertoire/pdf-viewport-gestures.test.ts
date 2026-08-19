import { describe, expect, it } from 'vitest';
import {
  adjustPanForPinch,
  adjustScrollForPinch,
  clampPan,
  clampScale,
  computePinchScale,
  isScaleZoomed,
  MIN_PDF_SCALE,
  nextDoubleTapFitMode,
  touchCenter,
  touchDistance,
} from './pdf-viewport-gestures';

describe('touchDistance / touchCenter', () => {
  it('computes distance between two points', () => {
    expect(touchDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('computes the midpoint', () => {
    expect(touchCenter({ x: 0, y: 10 }, { x: 10, y: 20 })).toEqual({ x: 5, y: 15 });
  });
});

describe('computePinchScale', () => {
  it('scales proportionally to pinch distance', () => {
    expect(computePinchScale(1, 200, 100)).toBe(2);
  });

  it('clamps to the minimum scale', () => {
    expect(computePinchScale(1, 10, 100)).toBe(MIN_PDF_SCALE);
  });

  it('does not clamp large pinch scales', () => {
    expect(computePinchScale(2, 400, 100)).toBe(8);
  });

  it('keeps the initial scale when the starting distance is zero', () => {
    expect(computePinchScale(1.2, 50, 0)).toBe(1.2);
  });
});

describe('clampScale', () => {
  it('clamps below the minimum and keeps larger scales', () => {
    expect(clampScale(0.1)).toBe(MIN_PDF_SCALE);
    expect(clampScale(9)).toBe(9);
    expect(clampScale(1.4)).toBe(1.4);
  });
});

describe('isScaleZoomed', () => {
  it('is false at or near the fit scale', () => {
    expect(isScaleZoomed(1, 1)).toBe(false);
    expect(isScaleZoomed(1.01, 1)).toBe(false);
  });

  it('is true when scale exceeds the fit scale by more than the epsilon', () => {
    expect(isScaleZoomed(1.1, 1)).toBe(true);
  });
});

describe('nextDoubleTapFitMode', () => {
  it('switches to page fit when already at width', () => {
    expect(nextDoubleTapFitMode(1.2, 1.2, 0.8)).toBe('page');
  });

  it('switches to width fit when at page or another zoom', () => {
    expect(nextDoubleTapFitMode(0.8, 1.2, 0.8)).toBe('width');
    expect(nextDoubleTapFitMode(2.4, 1.2, 0.8)).toBe('width');
  });
});

describe('clampPan', () => {
  const bounds = {
    pageWidth: 400,
    pageHeight: 600,
    viewportWidth: 200,
    viewportHeight: 300,
  };

  it('limits centered pan to the overflow on each side', () => {
    expect(clampPan({ x: 500, y: -500 }, bounds, 'center')).toEqual({ x: 100, y: -150 });
    expect(clampPan({ x: 0, y: 0 }, bounds, 'center')).toEqual({ x: 0, y: 0 });
  });

  it('forces pan to zero when the page fits the viewport', () => {
    expect(
      clampPan(
        { x: 40, y: -20 },
        {
          pageWidth: 100,
          pageHeight: 100,
          viewportWidth: 200,
          viewportHeight: 200,
        },
        'center',
      ),
    ).toEqual({ x: 0, y: 0 });
  });

  it('limits top-left pan so the page cannot expose empty space', () => {
    expect(clampPan({ x: 20, y: 20 }, bounds, 'topLeft')).toEqual({ x: 0, y: 0 });
    expect(clampPan({ x: -500, y: -500 }, bounds, 'topLeft')).toEqual({ x: -200, y: -300 });
  });
});

describe('adjustPanForPinch', () => {
  it('keeps pan at zero when pinching at the viewport center', () => {
    expect(
      adjustPanForPinch({
        pan: { x: 0, y: 0 },
        viewportCenter: { x: 100, y: 100 },
        focal: { x: 100, y: 100 },
        scaleRatio: 2,
      }),
    ).toEqual({ x: 0, y: 0 });
  });

  it('shifts pan so the focal point stays under the pinch', () => {
    const viewportCenter = { x: 100, y: 100 };
    const focal = { x: 150, y: 100 };
    const pan = { x: 0, y: 0 };
    const scaleRatio = 2;
    const nextPan = adjustPanForPinch({ pan, viewportCenter, focal, scaleRatio });

    const pageOffsetX = focal.x - viewportCenter.x - pan.x;
    const screenX = viewportCenter.x + nextPan.x + pageOffsetX * scaleRatio;
    expect(nextPan).toEqual({ x: -50, y: 0 });
    expect(screenX).toBe(focal.x);
  });
});

describe('adjustScrollForPinch', () => {
  it('keeps the focal point stable relative to the container', () => {
    const next = adjustScrollForPinch({ x: 40, y: 10 }, { x: 20, y: 30 }, 2);
    expect(next).toEqual({ x: 100, y: 50 });
  });
});
