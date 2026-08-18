import { useCallback, useRef } from 'react';
import type {
  HighlightGeometry,
  NormalizedPoint,
  PdfAnnotation,
  StrokeGeometry,
} from '@/domain/repertoire';
import { resolveHighlightColor } from '@/domain/repertoire';
import {
  ERASER_HIT_RADIUS,
  findAnnotationAtPoint,
  HIGHLIGHT_STROKE_WIDTH,
  PEN_STROKE_WIDTH,
  toNormalizedCoords,
} from '@/ui/features/repertoire/annotation-coordinates';

export type AnnotationInteractionMode = 'read' | 'pen' | 'highlight' | 'eraser';

export type VisibleLayers = {
  personal: boolean;
  section: boolean;
};

type SharedProps = {
  pageNumber: number;
  annotations: PdfAnnotation[];
  visibleLayers: VisibleLayers;
};

type PenLayerProps = SharedProps & {
  penColor: string;
  draftStroke: NormalizedPoint[] | null;
  showDraft: boolean;
};

type HighlightLayerProps = SharedProps & {
  highlightColor: string;
  inverted: boolean;
  draftStroke: NormalizedPoint[] | null;
  showDraft: boolean;
};

type InteractionLayerProps = SharedProps & {
  mode: AnnotationInteractionMode;
  readOnly: boolean;
  canEraseAnnotation: (annotation: PdfAnnotation) => boolean;
  onStrokeComplete: (geometry: StrokeGeometry) => void;
  onHighlightComplete: (geometry: StrokeGeometry) => void;
  onEraseAnnotation: (annotationId: string) => void;
  onDraftStrokeChange: (stroke: NormalizedPoint[] | null) => void;
};

function isStrokeGeometry(geometry: PdfAnnotation['geometry']): geometry is StrokeGeometry {
  return 'points' in geometry;
}

function filterPageAnnotations(
  annotations: PdfAnnotation[],
  pageNumber: number,
  visibleLayers: VisibleLayers,
) {
  return annotations.filter((annotation) => {
    if (annotation.pageNumber !== pageNumber) {
      return false;
    }
    if (annotation.layer === 'personal') {
      return visibleLayers.personal;
    }
    return visibleLayers.section;
  });
}

function highlightBlendMode(inverted: boolean): 'multiply' | 'screen' {
  return inverted ? 'screen' : 'multiply';
}

const SVG_BASE = {
  viewBox: '0 0 1 1',
  preserveAspectRatio: 'none' as const,
  className: 'absolute inset-0 h-full w-full pointer-events-none',
  'aria-hidden': true as const,
};

export function AnnotationPenLayer({
  pageNumber,
  annotations,
  visibleLayers,
  penColor,
  draftStroke,
  showDraft,
}: PenLayerProps) {
  const pageAnnotations = filterPageAnnotations(annotations, pageNumber, visibleLayers).filter(
    (annotation) => annotation.type === 'stroke' && isStrokeGeometry(annotation.geometry),
  );

  return (
    <svg {...SVG_BASE}>
      {pageAnnotations.map((annotation) => {
        const geometry = annotation.geometry as StrokeGeometry;
        return (
          <polyline
            key={annotation.id}
            points={geometry.points.map((point) => `${point.x},${point.y}`).join(' ')}
            fill="none"
            stroke={annotation.color}
            strokeWidth={geometry.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}
      {showDraft && draftStroke && draftStroke.length >= 1 && (
        <polyline
          points={draftStroke.map((point) => `${point.x},${point.y}`).join(' ')}
          fill="none"
          stroke={penColor}
          strokeWidth={PEN_STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

export function AnnotationHighlightLayer({
  pageNumber,
  annotations,
  visibleLayers,
  highlightColor,
  inverted,
  draftStroke,
  showDraft,
}: HighlightLayerProps) {
  const pageAnnotations = filterPageAnnotations(annotations, pageNumber, visibleLayers).filter(
    (annotation) => annotation.type === 'highlight',
  );
  const blendMode = highlightBlendMode(inverted);

  return (
    <svg {...SVG_BASE}>
      {pageAnnotations.map((annotation) => {
        if (isStrokeGeometry(annotation.geometry)) {
          return (
            <polyline
              key={annotation.id}
              points={annotation.geometry.points.map((point) => `${point.x},${point.y}`).join(' ')}
              fill="none"
              stroke={resolveHighlightColor(annotation.layer, inverted)}
              strokeWidth={annotation.geometry.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ mixBlendMode: blendMode }}
            />
          );
        }

        if ('width' in annotation.geometry) {
          const geometry = annotation.geometry as HighlightGeometry;
          return (
            <rect
              key={annotation.id}
              x={geometry.x}
              y={geometry.y}
              width={geometry.width}
              height={geometry.height}
              fill={resolveHighlightColor(annotation.layer, inverted)}
              stroke="none"
              style={{ mixBlendMode: blendMode }}
            />
          );
        }

        return null;
      })}
      {showDraft && draftStroke && draftStroke.length >= 1 && (
        <polyline
          points={draftStroke.map((point) => `${point.x},${point.y}`).join(' ')}
          fill="none"
          stroke={highlightColor}
          strokeWidth={HIGHLIGHT_STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ mixBlendMode: blendMode }}
        />
      )}
    </svg>
  );
}

export function AnnotationInteractionLayer({
  pageNumber,
  annotations,
  visibleLayers,
  mode,
  readOnly,
  canEraseAnnotation,
  onStrokeComplete,
  onHighlightComplete,
  onEraseAnnotation,
  onDraftStrokeChange,
}: InteractionLayerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const draftStrokeRef = useRef<NormalizedPoint[] | null>(null);

  const pageAnnotations = filterPageAnnotations(annotations, pageNumber, visibleLayers);
  const interactive = !readOnly && mode !== 'read';

  const getPoint = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) {
      return null;
    }
    return toNormalizedCoords(event.clientX, event.clientY, rect);
  }, []);

  const clearDraft = useCallback(() => {
    draftStrokeRef.current = null;
    onDraftStrokeChange(null);
  }, [onDraftStrokeChange]);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (!interactive) {
        return;
      }

      const point = getPoint(event);
      if (!point) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);

      if (mode === 'eraser') {
        const target = findAnnotationAtPoint(pageAnnotations, point, ERASER_HIT_RADIUS);
        if (target && canEraseAnnotation(target)) {
          onEraseAnnotation(target.id);
        }
        return;
      }

      if (mode === 'pen' || mode === 'highlight') {
        draftStrokeRef.current = [point];
        onDraftStrokeChange([point]);
      }
    },
    [
      canEraseAnnotation,
      getPoint,
      interactive,
      mode,
      onDraftStrokeChange,
      onEraseAnnotation,
      pageAnnotations,
    ],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (!interactive) {
        return;
      }

      const point = getPoint(event);
      if (!point) {
        return;
      }

      if (mode === 'eraser') {
        const target = findAnnotationAtPoint(pageAnnotations, point, ERASER_HIT_RADIUS);
        if (target && canEraseAnnotation(target)) {
          onEraseAnnotation(target.id);
        }
        return;
      }

      if ((mode === 'pen' || mode === 'highlight') && draftStrokeRef.current) {
        const nextStroke = [...draftStrokeRef.current, point];
        draftStrokeRef.current = nextStroke;
        onDraftStrokeChange(nextStroke);
      }
    },
    [
      canEraseAnnotation,
      getPoint,
      interactive,
      mode,
      onDraftStrokeChange,
      onEraseAnnotation,
      pageAnnotations,
    ],
  );

  const finishStroke = useCallback(() => {
    const stroke = draftStrokeRef.current;
    clearDraft();

    if (!stroke || stroke.length < 2) {
      return;
    }

    if (mode === 'pen') {
      onStrokeComplete({ points: stroke, strokeWidth: PEN_STROKE_WIDTH });
      return;
    }

    if (mode === 'highlight') {
      onHighlightComplete({ points: stroke, strokeWidth: HIGHLIGHT_STROKE_WIDTH });
    }
  }, [clearDraft, mode, onHighlightComplete, onStrokeComplete]);

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (!interactive) {
        return;
      }

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      if (mode === 'pen' || mode === 'highlight') {
        finishStroke();
      }
    },
    [finishStroke, interactive, mode],
  );

  return (
    <svg
      ref={svgRef}
      className={`absolute inset-0 h-full w-full ${
        interactive ? 'touch-none cursor-crosshair' : 'pointer-events-none'
      } ${mode === 'eraser' && interactive ? 'cursor-cell' : ''}`}
      style={{ zIndex: 2 }}
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      aria-hidden={mode === 'read'}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={clearDraft}
    />
  );
}
