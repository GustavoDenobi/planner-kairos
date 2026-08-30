import { useCallback, useEffect, useRef } from 'react';
import type {
  HighlightGeometry,
  NormalizedPoint,
  PdfAnnotation,
  StrokeGeometry,
} from '@/domain/repertoire';
import { resolveAnnotationAppearance } from '@/domain/repertoire';
import {
  ERASER_HIT_RADIUS,
  findErasableAnnotationAtPoint,
  toNormalizedCoords,
} from '@/ui/features/repertoire/annotation-coordinates';
import { buildHighlightBrushRects } from '@/ui/features/repertoire/highlight-brush';

export type AnnotationInteractionMode = 'read' | 'pen' | 'highlight' | 'eraser';

export type VisibleLayers = {
  personal: boolean;
  section: boolean;
  directed: Record<string, boolean>;
};

function isDirectedLayerVisible(
  annotation: PdfAnnotation,
  visibleLayers: VisibleLayers,
): boolean {
  if (!annotation.annotationSetId) {
    return false;
  }
  return visibleLayers.directed[annotation.annotationSetId] ?? false;
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
    if (annotation.layer === 'section') {
      return visibleLayers.section;
    }
    if (annotation.layer === 'directed') {
      return isDirectedLayerVisible(annotation, visibleLayers);
    }
    return false;
  });
}

type SharedProps = {
  pageNumber: number;
  annotations: PdfAnnotation[];
  visibleLayers: VisibleLayers;
};

type PenLayerProps = SharedProps & {
  inverted: boolean;
  penColor: string;
  penStrokeWidth: number;
  draftStroke: NormalizedPoint[] | null;
  showDraft: boolean;
};

type HighlightLayerProps = SharedProps & {
  inverted: boolean;
  pageAspectRatio: number;
  highlightColor: string;
  highlightStrokeWidth: number;
  draftStroke: NormalizedPoint[] | null;
  showDraft: boolean;
};

type InteractionLayerProps = SharedProps & {
  mode: AnnotationInteractionMode;
  readOnly: boolean;
  gesturesActive?: boolean;
  pageAspectRatio: number;
  penStrokeWidth: number;
  highlightStrokeWidth: number;
  canEraseAnnotation: (annotation: PdfAnnotation) => boolean;
  onStrokeComplete: (geometry: StrokeGeometry) => void;
  onHighlightComplete: (geometry: StrokeGeometry) => void;
  onEraseAnnotation: (annotationId: string) => void;
  onDraftStrokeChange: (stroke: NormalizedPoint[] | null) => void;
};

function isStrokeGeometry(geometry: PdfAnnotation['geometry']): geometry is StrokeGeometry {
  return 'points' in geometry;
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
  inverted,
  penColor,
  penStrokeWidth,
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
        const appearance = resolveAnnotationAppearance(annotation, inverted);
        return (
          <polyline
            key={annotation.id}
            points={geometry.points.map((point) => `${point.x},${point.y}`).join(' ')}
            fill="none"
            stroke={appearance.stroke}
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
          strokeWidth={penStrokeWidth}
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
  inverted,
  pageAspectRatio,
  highlightColor,
  highlightStrokeWidth,
  draftStroke,
  showDraft,
}: HighlightLayerProps) {
  const pageAnnotations = filterPageAnnotations(annotations, pageNumber, visibleLayers).filter(
    (annotation) => annotation.type === 'highlight',
  );
  const draftBlendMode = inverted ? 'screen' : 'multiply';
  const draftRects =
    showDraft && draftStroke
      ? buildHighlightBrushRects(draftStroke, highlightStrokeWidth, pageAspectRatio)
      : [];

  return (
    <svg {...SVG_BASE}>
      {pageAnnotations.map((annotation) => {
        const appearance = resolveAnnotationAppearance(annotation, inverted);
        const blendMode = appearance.blendMode ?? 'multiply';

        if (isStrokeGeometry(annotation.geometry)) {
          const brushRects = buildHighlightBrushRects(
            annotation.geometry.points,
            annotation.geometry.strokeWidth,
            pageAspectRatio,
          );
          return (
            <g key={annotation.id} style={{ mixBlendMode: blendMode }}>
              {brushRects.map((rect, index) => (
                <rect
                  key={`${annotation.id}-${index}`}
                  x={rect.x}
                  y={rect.y}
                  width={rect.width}
                  height={rect.height}
                  fill={appearance.stroke}
                  stroke="none"
                />
              ))}
            </g>
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
              fill={appearance.stroke}
              stroke="none"
              style={{ mixBlendMode: blendMode }}
            />
          );
        }

        return null;
      })}
      {draftRects.length > 0 && (
        <g style={{ mixBlendMode: draftBlendMode }}>
          {draftRects.map((rect, index) => (
            <rect
              key={`draft-${index}`}
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              fill={highlightColor}
              stroke="none"
            />
          ))}
        </g>
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
  gesturesActive = false,
  pageAspectRatio,
  penStrokeWidth,
  highlightStrokeWidth,
  canEraseAnnotation,
  onStrokeComplete,
  onHighlightComplete,
  onEraseAnnotation,
  onDraftStrokeChange,
}: InteractionLayerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const draftStrokeRef = useRef<NormalizedPoint[] | null>(null);

  const pageAnnotations = filterPageAnnotations(annotations, pageNumber, visibleLayers);
  const interactive = !readOnly && mode !== 'read' && !gesturesActive;

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

  useEffect(() => {
    if (gesturesActive) {
      clearDraft();
    }
  }, [clearDraft, gesturesActive]);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (!interactive) {
        return;
      }

      if (!event.isPrimary) {
        clearDraft();
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
        const target = findErasableAnnotationAtPoint(
          pageAnnotations,
          point,
          canEraseAnnotation,
          ERASER_HIT_RADIUS,
          pageAspectRatio,
        );
        if (target) {
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
      clearDraft,
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
      if (!interactive || !event.isPrimary) {
        return;
      }

      const point = getPoint(event);
      if (!point) {
        return;
      }

      if (mode === 'eraser') {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
          return;
        }

        const target = findErasableAnnotationAtPoint(
          pageAnnotations,
          point,
          canEraseAnnotation,
          ERASER_HIT_RADIUS,
          pageAspectRatio,
        );
        if (target) {
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
      onStrokeComplete({ points: stroke, strokeWidth: penStrokeWidth });
      return;
    }

    if (mode === 'highlight') {
      onHighlightComplete({ points: stroke, strokeWidth: highlightStrokeWidth });
    }
  }, [
    clearDraft,
    highlightStrokeWidth,
    mode,
    onHighlightComplete,
    onStrokeComplete,
    penStrokeWidth,
  ]);

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      if (!interactive) {
        return;
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
      style={{ zIndex: interactive ? 30 : 2 }}
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
