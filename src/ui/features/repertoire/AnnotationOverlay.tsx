import { memo, useCallback, useEffect, useRef } from 'react';
import type {
  HighlightGeometry,
  NormalizedPoint,
  PdfAnnotation,
  StrokeGeometry,
  TextGeometry,
} from '@/domain/repertoire';
import { resolveCoverColor } from '@/domain/repertoire';
import { resolveAnnotationTextFontFamily } from '@/ui/features/repertoire/annotation-text-metrics';
import { LASER_FADE_OUT_MS, resolveAnnotationAppearance } from '@/domain/repertoire';
import {
  ERASER_HIT_RADIUS,
  findErasableAnnotationAtPoint,
  toNormalizedCoords,
} from '@/ui/features/repertoire/annotation-coordinates';
import {
  buildHighlightBrushRects,
  constrainHighlightPoint,
  constrainHighlightStroke,
  isCoverRectLargeEnough,
  normalizedRectFromPoints,
  type CoverDrawMode,
  type HighlightStrokeMode,
} from '@/ui/features/repertoire/highlight-brush';

export type AnnotationInteractionMode =
  | 'read'
  | 'pen'
  | 'highlight'
  | 'cover'
  | 'text'
  | 'note'
  | 'eraser'
  | 'laser';

export type LaserStroke = {
  id: string;
  pageNumber: number;
  geometry: StrokeGeometry;
  color: string;
  fading?: boolean;
};

export type VisibleLayers = {
  personal: boolean;
  section: boolean;
  directed: Record<string, boolean>;
};

export type AnnotationEditingFocus =
  | { layer: 'personal' }
  | { layer: 'section'; sectionId: string }
  | { layer: 'directed'; annotationSetId: string };

const INACTIVE_EDIT_LAYER_OPACITY = 0.5;

export function annotationLayerOpacity(
  annotation: PdfAnnotation,
  editingFocus: AnnotationEditingFocus | null,
): number {
  if (editingFocus == null) {
    return 1;
  }

  if (editingFocus.layer === 'personal') {
    return annotation.layer === 'personal' ? 1 : INACTIVE_EDIT_LAYER_OPACITY;
  }

  if (editingFocus.layer === 'section') {
    return annotation.layer === 'section' && annotation.sectionId === editingFocus.sectionId
      ? 1
      : INACTIVE_EDIT_LAYER_OPACITY;
  }

  return annotation.layer === 'directed' && annotation.annotationSetId === editingFocus.annotationSetId
    ? 1
    : INACTIVE_EDIT_LAYER_OPACITY;
}

function isDirectedLayerVisible(
  annotation: PdfAnnotation,
  visibleLayers: VisibleLayers,
): boolean {
  if (!annotation.annotationSetId) {
    return false;
  }
  return visibleLayers.directed[annotation.annotationSetId] ?? true;
}

export function filterPageAnnotations(
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
  editingFocus: AnnotationEditingFocus | null;
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
  draftRect: HighlightGeometry | null;
  showDraft: boolean;
};

type CoverLayerProps = SharedProps & {
  inverted: boolean;
  pageAspectRatio: number;
  coverStrokeWidth: number;
  draftStroke: NormalizedPoint[] | null;
  draftRect: HighlightGeometry | null;
  showDraft: boolean;
};

type LaserLayerProps = {
  pageNumber: number;
  laserStrokes: LaserStroke[];
  laserColor: string;
  laserStrokeWidth: number;
  draftStroke: NormalizedPoint[] | null;
  showDraft: boolean;
};

type TextLayerProps = SharedProps & {
  inverted: boolean;
  pageAspectRatio: number;
};

type InteractionLayerProps = SharedProps & {
  mode: AnnotationInteractionMode;
  readOnly: boolean;
  gesturesActive?: boolean;
  pageAspectRatio: number;
  penStrokeWidth: number;
  highlightStrokeWidth: number;
  highlightStrokeMode: HighlightStrokeMode;
  coverStrokeWidth: number;
  coverDrawMode: CoverDrawMode;
  laserStrokeWidth: number;
  canEraseAnnotation: (annotation: PdfAnnotation) => boolean;
  onStrokeComplete: (geometry: StrokeGeometry) => void;
  onHighlightComplete: (geometry: StrokeGeometry) => void;
  onHighlightRectComplete: (geometry: HighlightGeometry) => void;
  onCoverComplete: (geometry: StrokeGeometry) => void;
  onCoverRectComplete: (geometry: HighlightGeometry) => void;
  onLaserStrokeComplete: (geometry: StrokeGeometry) => void;
  onEraseAnnotation: (annotationId: string) => void;
  onDraftStrokeChange: (stroke: NormalizedPoint[] | null) => void;
  onDraftRectChange: (rect: HighlightGeometry | null) => void;
  onTextPlace: (point: NormalizedPoint) => void;
  onTextSelect: (annotation: PdfAnnotation) => void;
  onTextMove: (annotationId: string, point: NormalizedPoint) => void;
  onTextDragComplete?: (annotationId: string) => void;
  onNotePlace: (point: NormalizedPoint) => void;
  textEditing?: boolean;
};

function isStrokeGeometry(geometry: PdfAnnotation['geometry']): geometry is StrokeGeometry {
  return 'points' in geometry;
}

function isTextGeometry(geometry: PdfAnnotation['geometry']): geometry is TextGeometry {
  return 'content' in geometry && 'fontSize' in geometry;
}

const SVG_BASE = {
  viewBox: '0 0 1 1',
  preserveAspectRatio: 'none' as const,
  className: 'absolute inset-0 h-full w-full pointer-events-none',
  'aria-hidden': true as const,
};

/**
 * Page stacking. Cover stays above the PDF and beneath every other tool.
 * Ink (pen/text) and laser sit in their own CSS-invert groups in PdfViewer.
 */
export const ANNOTATION_LAYER_Z_INDEX = {
  cover: 1,
  ink: 2,
  highlight: 3,
  laser: 5,
} as const;

export function AnnotationPenLayer({
  pageNumber,
  annotations,
  visibleLayers,
  editingFocus,
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
            opacity={annotationLayerOpacity(annotation, editingFocus)}
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

type BrushCanvasKind = 'highlight' | 'cover';

let brushScratch: HTMLCanvasElement | null = null;

function brushScratchContext(
  pixelWidth: number,
  pixelHeight: number,
  dpr: number,
): CanvasRenderingContext2D | null {
  if (!brushScratch) {
    brushScratch = document.createElement('canvas');
  }
  if (brushScratch.width !== pixelWidth || brushScratch.height !== pixelHeight) {
    brushScratch.width = pixelWidth;
    brushScratch.height = pixelHeight;
  }

  const context = brushScratch.getContext('2d');
  if (!context) {
    return null;
  }

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, pixelWidth, pixelHeight);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.globalAlpha = 1;
  return context;
}

function paintBrushGeometry(
  context: CanvasRenderingContext2D,
  annotation: PdfAnnotation,
  options: {
    width: number;
    height: number;
    pageAspectRatio: number;
    fill: string;
  },
) {
  context.fillStyle = options.fill;

  if (isStrokeGeometry(annotation.geometry)) {
    const brushRects = buildHighlightBrushRects(
      annotation.geometry.points,
      annotation.geometry.strokeWidth,
      options.pageAspectRatio,
    );
    for (const rect of brushRects) {
      context.fillRect(
        rect.x * options.width,
        rect.y * options.height,
        rect.width * options.width,
        rect.height * options.height,
      );
    }
    return;
  }

  if ('width' in annotation.geometry && 'height' in annotation.geometry) {
    const geometry = annotation.geometry;
    context.fillRect(
      geometry.x * options.width,
      geometry.y * options.height,
      geometry.width * options.width,
      geometry.height * options.height,
    );
  }
}

function paintAnnotationBrushCanvas(
  canvas: HTMLCanvasElement,
  annotations: PdfAnnotation[],
  options: {
    width: number;
    height: number;
    pageAspectRatio: number;
    editingFocus: AnnotationEditingFocus | null;
    fillFor: (annotation: PdfAnnotation) => string;
  },
) {
  const dpr = window.devicePixelRatio || 1;
  const pixelWidth = Math.max(1, Math.round(options.width * dpr));
  const pixelHeight = Math.max(1, Math.round(options.height * dpr));
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, pixelWidth, pixelHeight);

  for (const annotation of annotations) {
    const opacity = annotationLayerOpacity(annotation, options.editingFocus);
    if (opacity <= 0) {
      continue;
    }

    const scratch = brushScratchContext(pixelWidth, pixelHeight, dpr);
    if (!scratch || !brushScratch) {
      continue;
    }

    paintBrushGeometry(scratch, annotation, {
      width: options.width,
      height: options.height,
      pageAspectRatio: options.pageAspectRatio,
      fill: options.fillFor(annotation),
    });

    context.globalAlpha = opacity;
    context.drawImage(brushScratch, 0, 0);
  }

  context.globalAlpha = 1;
}

const AnnotationBrushCanvas = memo(function AnnotationBrushCanvas({
  kind,
  pageNumber,
  annotations,
  visibleLayers,
  editingFocus,
  inverted,
  pageAspectRatio,
}: SharedProps & {
  kind: BrushCanvasKind;
  inverted: boolean;
  pageAspectRatio: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const paint = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width <= 0 || height <= 0) {
        return;
      }

      const pageAnnotations = filterPageAnnotations(annotations, pageNumber, visibleLayers).filter(
        (annotation) => annotation.type === kind,
      );
      paintAnnotationBrushCanvas(canvas, pageAnnotations, {
        width,
        height,
        pageAspectRatio,
        editingFocus,
        fillFor: (annotation) =>
          kind === 'cover'
            ? resolveCoverColor(inverted)
            : resolveAnnotationAppearance(annotation, inverted).stroke,
      });
    };

    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [annotations, editingFocus, inverted, kind, pageAspectRatio, pageNumber, visibleLayers]);

  return (
    <canvas
      ref={canvasRef}
      className={SVG_BASE.className}
      style={
        kind === 'highlight'
          ? {
              mixBlendMode: inverted ? 'screen' : 'multiply',
              zIndex: ANNOTATION_LAYER_Z_INDEX.highlight,
            }
          : { zIndex: ANNOTATION_LAYER_Z_INDEX.cover }
      }
      aria-hidden
    />
  );
});

export function AnnotationHighlightLayer({
  pageNumber,
  annotations,
  visibleLayers,
  editingFocus,
  inverted,
  pageAspectRatio,
  highlightColor,
  highlightStrokeWidth,
  draftStroke,
  draftRect,
  showDraft,
}: HighlightLayerProps) {
  const draftBlendMode = inverted ? 'screen' : 'multiply';
  const draftRects =
    showDraft && draftStroke
      ? buildHighlightBrushRects(draftStroke, highlightStrokeWidth, pageAspectRatio)
      : [];

  return (
    <>
      <AnnotationBrushCanvas
        kind="highlight"
        pageNumber={pageNumber}
        annotations={annotations}
        visibleLayers={visibleLayers}
        editingFocus={editingFocus}
        inverted={inverted}
        pageAspectRatio={pageAspectRatio}
      />
      <svg
        {...SVG_BASE}
        style={{
          zIndex: ANNOTATION_LAYER_Z_INDEX.highlight,
          mixBlendMode:
            draftRects.length > 0 || (showDraft && draftRect) ? draftBlendMode : undefined,
        }}
      >
        {draftRects.length > 0 &&
          draftRects.map((rect, index) => (
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
        {showDraft && draftRect && (
          <rect
            x={draftRect.x}
            y={draftRect.y}
            width={draftRect.width}
            height={draftRect.height}
            fill={highlightColor}
            stroke="none"
          />
        )}
      </svg>
    </>
  );
}

export function AnnotationCoverLayer({
  pageNumber,
  annotations,
  visibleLayers,
  editingFocus,
  inverted,
  pageAspectRatio,
  coverStrokeWidth,
  draftStroke,
  draftRect,
  showDraft,
}: CoverLayerProps) {
  const coverColor = resolveCoverColor(inverted);
  const draftBrushRects =
    showDraft && draftStroke
      ? buildHighlightBrushRects(draftStroke, coverStrokeWidth, pageAspectRatio)
      : [];

  return (
    <>
      <AnnotationBrushCanvas
        kind="cover"
        pageNumber={pageNumber}
        annotations={annotations}
        visibleLayers={visibleLayers}
        editingFocus={editingFocus}
        inverted={inverted}
        pageAspectRatio={pageAspectRatio}
      />
      <svg {...SVG_BASE} style={{ zIndex: ANNOTATION_LAYER_Z_INDEX.cover }}>
      {draftBrushRects.length > 0 && (
        <g>
          {draftBrushRects.map((rect, index) => (
            <rect
              key={`cover-draft-stroke-${index}`}
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              fill={coverColor}
              stroke="none"
            />
          ))}
        </g>
      )}
      {showDraft && draftRect && (
        <rect
          x={draftRect.x}
          y={draftRect.y}
          width={draftRect.width}
          height={draftRect.height}
          fill={coverColor}
          stroke="none"
        />
      )}
      </svg>
    </>
  );
}

export function AnnotationTextLayer({
  pageNumber,
  annotations,
  visibleLayers,
  editingFocus,
  inverted,
  pageAspectRatio,
}: TextLayerProps) {
  const pageAnnotations = filterPageAnnotations(annotations, pageNumber, visibleLayers).filter(
    (annotation) => annotation.type === 'text' && isTextGeometry(annotation.geometry),
  );
  const horizontalScale = pageAspectRatio > 0 ? 1 / pageAspectRatio : 1;

  return (
    <svg {...SVG_BASE}>
      {pageAnnotations.map((annotation) => {
        const geometry = annotation.geometry as TextGeometry;
        const appearance = resolveAnnotationAppearance(annotation, inverted);
        return (
          <g
            key={annotation.id}
            transform={`translate(${geometry.x} ${geometry.y}) scale(${horizontalScale} 1)`}
            opacity={annotationLayerOpacity(annotation, editingFocus)}
          >
            <text
              x={0}
              y={0}
              fill={appearance.stroke}
              fontSize={geometry.fontSize * pageAspectRatio}
              fontFamily={resolveAnnotationTextFontFamily(geometry.fontFamily)}
              fontWeight={geometry.fontWeight === 'bold' ? 'bold' : undefined}
              fontStyle={geometry.fontStyle === 'italic' ? 'italic' : undefined}
              dominantBaseline="hanging"
            >
              {geometry.content}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function AnnotationLaserLayer({
  pageNumber,
  laserStrokes,
  laserColor,
  laserStrokeWidth,
  draftStroke,
  showDraft,
}: LaserLayerProps) {
  const pageStrokes = laserStrokes.filter((stroke) => stroke.pageNumber === pageNumber);

  return (
    <svg {...SVG_BASE} style={{ zIndex: ANNOTATION_LAYER_Z_INDEX.laser }}>
      {pageStrokes.map((stroke) => (
        <polyline
          key={stroke.id}
          points={stroke.geometry.points.map((point) => `${point.x},${point.y}`).join(' ')}
          fill="none"
          stroke={stroke.color}
          strokeWidth={stroke.geometry.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={stroke.fading ? 'annotation-laser-fade-out' : undefined}
          style={
            stroke.fading
              ? { animationDuration: `${LASER_FADE_OUT_MS}ms` }
              : undefined
          }
        />
      ))}
      {showDraft && draftStroke && draftStroke.length >= 1 && (
        <polyline
          points={draftStroke.map((point) => `${point.x},${point.y}`).join(' ')}
          fill="none"
          stroke={laserColor}
          strokeWidth={laserStrokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
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
  gesturesActive = false,
  pageAspectRatio,
  penStrokeWidth,
  highlightStrokeWidth,
  highlightStrokeMode,
  coverStrokeWidth,
  coverDrawMode,
  laserStrokeWidth,
  canEraseAnnotation,
  onStrokeComplete,
  onHighlightComplete,
  onHighlightRectComplete,
  onCoverComplete,
  onCoverRectComplete,
  onLaserStrokeComplete,
  onEraseAnnotation,
  onDraftStrokeChange,
  onDraftRectChange,
  onTextPlace,
  onTextSelect,
  onTextMove,
  onTextDragComplete,
  onNotePlace,
  textEditing = false,
}: InteractionLayerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const draftStrokeRef = useRef<NormalizedPoint[] | null>(null);
  const draftRectRef = useRef<{ anchor: NormalizedPoint; current: NormalizedPoint } | null>(null);
  const textDragRef = useRef<{
    annotationId: string;
    startPoint: NormalizedPoint;
    origin: NormalizedPoint;
  } | null>(null);

  const pageAnnotations = filterPageAnnotations(annotations, pageNumber, visibleLayers);
  const interactive = !readOnly && mode !== 'read' && !gesturesActive && !textEditing;

  const getPoint = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) {
      return null;
    }
    return toNormalizedCoords(event.clientX, event.clientY, rect);
  }, []);

  const clearDraft = useCallback(() => {
    draftStrokeRef.current = null;
    draftRectRef.current = null;
    onDraftStrokeChange(null);
    onDraftRectChange(null);
  }, [onDraftRectChange, onDraftStrokeChange]);

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

      if (mode === 'text') {
        const target = findErasableAnnotationAtPoint(
          pageAnnotations.filter((annotation) => annotation.type === 'text'),
          point,
          canEraseAnnotation,
          ERASER_HIT_RADIUS,
          pageAspectRatio,
        );
        if (target && isTextGeometry(target.geometry)) {
          textDragRef.current = {
            annotationId: target.id,
            startPoint: point,
            origin: { x: target.geometry.x, y: target.geometry.y },
          };
        } else {
          onTextPlace(point);
        }
        return;
      }

      if (mode === 'note') {
        onNotePlace(point);
        return;
      }

      if (
        (mode === 'highlight' && highlightStrokeMode === 'rect')
        || (mode === 'cover' && coverDrawMode === 'rect')
      ) {
        draftRectRef.current = { anchor: point, current: point };
        onDraftRectChange(normalizedRectFromPoints(point, point));
        return;
      }

      if (mode === 'pen' || mode === 'highlight' || mode === 'cover' || mode === 'laser') {
        draftStrokeRef.current = [point];
        onDraftStrokeChange([point]);
      }
    },
    [
      canEraseAnnotation,
      clearDraft,
      coverDrawMode,
      getPoint,
      highlightStrokeMode,
      interactive,
      mode,
      onDraftRectChange,
      onDraftStrokeChange,
      onEraseAnnotation,
      onNotePlace,
      onTextPlace,
      pageAnnotations,
      pageAspectRatio,
    ], // pageAspectRatio used by findErasableAnnotationAtPoint for text hit-test
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

      if (mode === 'text' && textDragRef.current) {
        const drag = textDragRef.current;
        onTextMove(drag.annotationId, {
          x: drag.origin.x + (point.x - drag.startPoint.x),
          y: drag.origin.y + (point.y - drag.startPoint.y),
        });
        return;
      }

      if (
        ((mode === 'highlight' && highlightStrokeMode === 'rect')
          || (mode === 'cover' && coverDrawMode === 'rect'))
        && draftRectRef.current
      ) {
        const draft = draftRectRef.current;
        draftRectRef.current = { anchor: draft.anchor, current: point };
        onDraftRectChange(normalizedRectFromPoints(draft.anchor, point));
        return;
      }

      if ((mode === 'pen' || mode === 'highlight' || mode === 'cover' || mode === 'laser') && draftStrokeRef.current) {
        const strokeMode =
          mode === 'highlight' && highlightStrokeMode !== 'rect'
            ? highlightStrokeMode
            : mode === 'cover' && coverDrawMode !== 'rect'
              ? coverDrawMode
              : 'free';
        const nextPoint =
          (mode === 'highlight' || mode === 'cover') && strokeMode !== 'free'
            ? constrainHighlightPoint(point, strokeMode, draftStrokeRef.current[0]!)
            : point;
        const nextStroke = [...draftStrokeRef.current, nextPoint];
        draftStrokeRef.current = nextStroke;
        onDraftStrokeChange(nextStroke);
      }
    },
    [
      canEraseAnnotation,
      coverDrawMode,
      getPoint,
      highlightStrokeMode,
      interactive,
      mode,
      onDraftRectChange,
      onDraftStrokeChange,
      onEraseAnnotation,
      onTextMove,
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

    if (mode === 'highlight' && highlightStrokeMode !== 'rect') {
      const points = constrainHighlightStroke(stroke, highlightStrokeMode);
      onHighlightComplete({ points, strokeWidth: highlightStrokeWidth });
      return;
    }

    if (mode === 'cover' && coverDrawMode !== 'rect') {
      const points = constrainHighlightStroke(stroke, coverDrawMode);
      onCoverComplete({ points, strokeWidth: coverStrokeWidth });
      return;
    }

    if (mode === 'laser') {
      onLaserStrokeComplete({ points: stroke, strokeWidth: laserStrokeWidth });
    }
  }, [
    clearDraft,
    coverDrawMode,
    coverStrokeWidth,
    highlightStrokeMode,
    highlightStrokeWidth,
    laserStrokeWidth,
    mode,
    onCoverComplete,
    onHighlightComplete,
    onLaserStrokeComplete,
    onStrokeComplete,
    penStrokeWidth,
  ]);

  const finishDraftRect = useCallback(
    (onComplete: (geometry: HighlightGeometry) => void) => {
      const draft = draftRectRef.current;
      clearDraft();

      if (!draft) {
        return;
      }

      const rect = normalizedRectFromPoints(draft.anchor, draft.current);
      if (!isCoverRectLargeEnough(rect)) {
        return;
      }

      onComplete(rect);
    },
    [clearDraft],
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      if (!interactive) {
        return;
      }

      if (mode === 'text' && textDragRef.current) {
        const drag = textDragRef.current;
        textDragRef.current = null;
        const point = getPoint(event);
        const moved = point
          ? Math.hypot(point.x - drag.startPoint.x, point.y - drag.startPoint.y) > 0.008
          : true;
        if (!moved) {
          const target = pageAnnotations.find((annotation) => annotation.id === drag.annotationId);
          if (target) {
            onTextSelect(target);
          }
        } else {
          onTextDragComplete?.(drag.annotationId);
        }
        return;
      }

      if (mode === 'highlight' && highlightStrokeMode === 'rect') {
        finishDraftRect(onHighlightRectComplete);
        return;
      }

      if (mode === 'cover' && coverDrawMode === 'rect') {
        finishDraftRect(onCoverRectComplete);
        return;
      }

      if (mode === 'pen' || mode === 'highlight' || mode === 'cover' || mode === 'laser') {
        finishStroke();
      }
    },
    [
      coverDrawMode,
      finishDraftRect,
      finishStroke,
      getPoint,
      highlightStrokeMode,
      interactive,
      mode,
      onCoverRectComplete,
      onHighlightRectComplete,
      onTextDragComplete,
      onTextSelect,
      pageAnnotations,
    ],
  );

  return (
    <svg
      ref={svgRef}
      className={`absolute inset-0 h-full w-full ${
        interactive ? 'touch-none cursor-crosshair' : 'pointer-events-none'
      } ${mode === 'eraser' && interactive ? 'cursor-cell' : ''} ${
        mode === 'text' && interactive ? 'cursor-text' : ''
      }`}
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
