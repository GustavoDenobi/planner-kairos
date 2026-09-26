import type { NormalizedPoint } from '@/domain/repertoire';

/** Direction change above this angle starts a sharp join, so corners stay corners. */
const CORNER_TURN_RADIANS = (55 * Math.PI) / 180;
const CORNER_DOT_THRESHOLD = Math.cos(CORNER_TURN_RADIANS);
const MIN_SEGMENT_LENGTH = 0.0004;

function formatCoord(value: number): string {
  return value.toFixed(5);
}

function formatPoint(point: NormalizedPoint): string {
  return `${formatCoord(point.x)} ${formatCoord(point.y)}`;
}

function dedupePoints(points: NormalizedPoint[]): NormalizedPoint[] {
  const cleaned: NormalizedPoint[] = [];
  for (const point of points) {
    const previous = cleaned[cleaned.length - 1];
    if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 1e-6) {
      continue;
    }
    cleaned.push(point);
  }
  return cleaned;
}

function cornerIndexes(points: NormalizedPoint[]): Set<number> {
  const corners = new Set<number>();
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1]!;
    const current = points[index]!;
    const next = points[index + 1]!;
    const inX = current.x - previous.x;
    const inY = current.y - previous.y;
    const outX = next.x - current.x;
    const outY = next.y - current.y;
    const inLength = Math.hypot(inX, inY);
    const outLength = Math.hypot(outX, outY);
    if (inLength < MIN_SEGMENT_LENGTH || outLength < MIN_SEGMENT_LENGTH) {
      continue;
    }
    const dot = (inX * outX + inY * outY) / (inLength * outLength);
    if (dot < CORNER_DOT_THRESHOLD) {
      corners.add(index);
    }
  }
  return corners;
}

function knotDelta(start: NormalizedPoint, end: NormalizedPoint): number {
  return Math.sqrt(Math.hypot(end.x - start.x, end.y - start.y));
}

/**
 * Centripetal Catmull-Rom segment from p1 to p2, as cubic Bezier controls.
 * The curve passes through p1 and p2.
 */
function centripetalControls(
  p0: NormalizedPoint,
  p1: NormalizedPoint,
  p2: NormalizedPoint,
  p3: NormalizedPoint,
): [NormalizedPoint, NormalizedPoint] {
  let dt0 = knotDelta(p0, p1);
  let dt1 = knotDelta(p1, p2);
  let dt2 = knotDelta(p2, p3);
  if (dt1 < 1e-6) {
    dt1 = 1;
  }
  if (dt0 < 1e-6) {
    dt0 = dt1;
  }
  if (dt2 < 1e-6) {
    dt2 = dt1;
  }

  const m1x = (p1.x - p0.x) / dt0 - (p2.x - p0.x) / (dt0 + dt1) + (p2.x - p1.x) / dt1;
  const m1y = (p1.y - p0.y) / dt0 - (p2.y - p0.y) / (dt0 + dt1) + (p2.y - p1.y) / dt1;
  const m2x = (p2.x - p1.x) / dt1 - (p3.x - p1.x) / (dt1 + dt2) + (p3.x - p2.x) / dt2;
  const m2y = (p2.y - p1.y) / dt1 - (p3.y - p1.y) / (dt1 + dt2) + (p3.y - p2.y) / dt2;

  return [
    { x: p1.x + (m1x * dt1) / 3, y: p1.y + (m1y * dt1) / 3 },
    { x: p2.x - (m2x * dt1) / 3, y: p2.y - (m2y * dt1) / 3 },
  ];
}

function cubicPoint(
  p0: NormalizedPoint,
  c1: NormalizedPoint,
  c2: NormalizedPoint,
  p1: NormalizedPoint,
  t: number,
): NormalizedPoint {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p1.x,
    y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p1.y,
  };
}

type PenSegment = {
  start: NormalizedPoint;
  c1: NormalizedPoint;
  c2: NormalizedPoint;
  end: NormalizedPoint;
};

function penSegments(points: NormalizedPoint[]): PenSegment[] {
  const cleaned = dedupePoints(points);
  if (cleaned.length < 2) {
    return [];
  }

  const corners = cornerIndexes(cleaned);
  const segments: PenSegment[] = [];
  for (let index = 0; index < cleaned.length - 1; index += 1) {
    const start = cleaned[index]!;
    const end = cleaned[index + 1]!;
    const before = index === 0 || corners.has(index) ? start : cleaned[index - 1]!;
    const after = index + 2 >= cleaned.length || corners.has(index + 1) ? end : cleaned[index + 2]!;
    const [c1, c2] = centripetalControls(before, start, end, after);
    segments.push({ start, c1, c2, end });
  }
  return segments;
}

/** SVG path through the stored points, smooth between them and sharp at real corners. */
export function penStrokePath(points: NormalizedPoint[]): string {
  const cleaned = dedupePoints(points);
  if (cleaned.length === 0) {
    return '';
  }
  if (cleaned.length === 1) {
    const point = formatPoint(cleaned[0]!);
    return `M ${point} L ${point}`;
  }

  const segments = penSegments(cleaned);
  const first = segments[0];
  if (!first) {
    return '';
  }

  let path = `M ${formatPoint(first.start)}`;
  for (const segment of segments) {
    path += ` C ${formatPoint(segment.c1)} ${formatPoint(segment.c2)} ${formatPoint(segment.end)}`;
  }
  return path;
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
    return Math.hypot(point.x - start.x, point.y - start.y);
  }
  const t = Math.min(
    1,
    Math.max(0, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared),
  );
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

/** Distance from a point to the rendered pen curve, for the eraser. */
export function penStrokeHitDistance(points: NormalizedPoint[], point: NormalizedPoint): number {
  const cleaned = dedupePoints(points);
  if (cleaned.length === 0) {
    return Number.POSITIVE_INFINITY;
  }
  if (cleaned.length === 1) {
    return Math.hypot(point.x - cleaned[0]!.x, point.y - cleaned[0]!.y);
  }

  let minDistance = Number.POSITIVE_INFINITY;
  for (const segment of penSegments(cleaned)) {
    let previous = segment.start;
    for (let step = 1; step <= 8; step += 1) {
      const sample = cubicPoint(segment.start, segment.c1, segment.c2, segment.end, step / 8);
      minDistance = Math.min(minDistance, distancePointToSegment(point, previous, sample));
      previous = sample;
    }
  }
  return minDistance;
}
