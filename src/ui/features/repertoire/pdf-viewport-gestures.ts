export const MIN_PDF_SCALE = 0.5;
export const ZOOMED_EPSILON = 0.02;

export type Point = {
  x: number;
  y: number;
};

export type Pan = Point;

export type ViewportBounds = {
  pageWidth: number;
  pageHeight: number;
  viewportWidth: number;
  viewportHeight: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampScale(scale: number): number {
  return Math.max(MIN_PDF_SCALE, scale);
}

export function touchDistance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function touchCenter(a: Point, b: Point): Point {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

export function computePinchScale(
  initialScale: number,
  currentDistance: number,
  initialDistance: number,
): number {
  if (initialDistance <= 0) {
    return clampScale(initialScale);
  }
  return clampScale(initialScale * (currentDistance / initialDistance));
}

export function isScaleNear(
  scale: number,
  target: number,
  epsilon: number = ZOOMED_EPSILON,
): boolean {
  return Math.abs(scale - target) <= epsilon;
}

export function isScaleZoomed(
  scale: number,
  fitScale: number,
  epsilon: number = ZOOMED_EPSILON,
): boolean {
  return scale > fitScale + epsilon;
}

export function nextDoubleTapFitMode(
  scale: number,
  widthScale: number,
  _pageScale: number,
): 'width' | 'page' {
  if (isScaleNear(scale, widthScale)) {
    return 'page';
  }
  return 'width';
}

export function adjustPanForPinch(input: {
  pan: Pan;
  viewportCenter: Point;
  focal: Point;
  scaleRatio: number;
}): Pan {
  const { pan, viewportCenter, focal, scaleRatio } = input;
  return {
    x: (focal.x - viewportCenter.x) * (1 - scaleRatio) + pan.x * scaleRatio,
    y: (focal.y - viewportCenter.y) * (1 - scaleRatio) + pan.y * scaleRatio,
  };
}

export function clampPan(
  pan: Pan,
  bounds: ViewportBounds,
  origin: 'center' | 'topLeft' = 'center',
): Pan {
  if (origin === 'center') {
    const maxX = Math.max(0, (bounds.pageWidth - bounds.viewportWidth) / 2);
    const maxY = Math.max(0, (bounds.pageHeight - bounds.viewportHeight) / 2);
    return {
      x: clamp(pan.x, -maxX, maxX) + 0,
      y: clamp(pan.y, -maxY, maxY) + 0,
    };
  }

  const minX = Math.min(0, bounds.viewportWidth - bounds.pageWidth);
  const minY = Math.min(0, bounds.viewportHeight - bounds.pageHeight);
  return {
    x: clamp(pan.x, minX, 0) + 0,
    y: clamp(pan.y, minY, 0) + 0,
  };
}

export function adjustScrollForPinch(
  scroll: Pan,
  focalInContainer: Point,
  scaleRatio: number,
): Pan {
  return {
    x: (scroll.x + focalInContainer.x) * scaleRatio - focalInContainer.x,
    y: (scroll.y + focalInContainer.y) * scaleRatio - focalInContainer.y,
  };
}
