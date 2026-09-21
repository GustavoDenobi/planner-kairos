import { useRef, type PointerEvent } from 'react';
import type { NoteGeometry, NormalizedPoint, PdfAnnotation } from '@/domain/repertoire';
import { ANNOTATION_COLORS } from '@/domain/repertoire';
import { MarkdownContent } from '@/ui/components/MarkdownContent';
import { IconNote, IconPencil, IconX } from '@/ui/components/icons';
import {
  annotationLayerOpacity,
  filterPageAnnotations,
  type AnnotationEditingFocus,
  type VisibleLayers,
} from '@/ui/features/repertoire/AnnotationOverlay';

export type NoteDisplayOffset = {
  dx: number;
  dy: number;
};

const DRAG_THRESHOLD = 0.008;

type DragState = {
  id: string;
  startClientX: number;
  startClientY: number;
  originX: number;
  originY: number;
  moved: boolean;
  persist: boolean;
};

type CollapsibleNoteLayerProps = {
  pageNumber: number;
  annotations: PdfAnnotation[];
  visibleLayers: VisibleLayers;
  editingFocus: AnnotationEditingFocus | null;
  expandedNoteIds: ReadonlySet<string>;
  focusedNoteId: string | null;
  displayOffsets: Record<string, NoteDisplayOffset>;
  isAnnotating: boolean;
  editingNoteId: string | null;
  interactionBlocksNotes: boolean;
  canEditNote: (annotation: PdfAnnotation) => boolean;
  onToggleExpanded: (annotationId: string) => void;
  onFocus: (annotationId: string) => void;
  onEdit: (annotation: PdfAnnotation) => void;
  onNoteMove: (annotationId: string, point: NormalizedPoint, options: { persist: boolean }) => void;
  onNoteDragEnd: (annotationId: string, persist: boolean) => void;
};

function isNoteGeometry(geometry: PdfAnnotation['geometry']): geometry is NoteGeometry {
  return 'body' in geometry && !('content' in geometry);
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function noteTitle(geometry: NoteGeometry): string {
  return geometry.title?.trim() ?? '';
}

export function CollapsibleNoteLayer({
  pageNumber,
  annotations,
  visibleLayers,
  editingFocus,
  expandedNoteIds,
  focusedNoteId,
  displayOffsets,
  isAnnotating,
  editingNoteId,
  interactionBlocksNotes,
  canEditNote,
  onToggleExpanded,
  onFocus,
  onEdit,
  onNoteMove,
  onNoteDragEnd,
}: CollapsibleNoteLayerProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const notes = filterPageAnnotations(annotations, pageNumber, visibleLayers).filter(
    (annotation) => annotation.type === 'note' && isNoteGeometry(annotation.geometry),
  );

  function displayPoint(annotation: PdfAnnotation, geometry: NoteGeometry): NormalizedPoint {
    const offset = displayOffsets[annotation.id];
    return {
      x: clampUnit(geometry.x + (offset?.dx ?? 0)),
      y: clampUnit(geometry.y + (offset?.dy ?? 0)),
    };
  }

  function beginDrag(
    event: PointerEvent<HTMLElement>,
    annotation: PdfAnnotation,
    geometry: NoteGeometry,
  ) {
    if (editingNoteId === annotation.id || interactionBlocksNotes) {
      return;
    }

    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const origin = displayPoint(annotation, geometry);
    dragRef.current = {
      id: annotation.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: origin.x,
      originY: origin.y,
      moved: false,
      persist: isAnnotating && canEditNote(annotation),
    };
    onFocus(annotation.id);
  }

  function moveDrag(event: PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    const bounds = layerRef.current?.getBoundingClientRect();
    if (!drag || !bounds || bounds.width <= 0 || bounds.height <= 0) {
      return;
    }
    if (event.currentTarget !== event.target && !event.currentTarget.contains(event.target as Node)) {
      return;
    }

    const dx = (event.clientX - drag.startClientX) / bounds.width;
    const dy = (event.clientY - drag.startClientY) / bounds.height;
    if (Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      drag.moved = true;
    }
    if (!drag.moved) {
      return;
    }

    onNoteMove(
      drag.id,
      {
        x: clampUnit(drag.originX + dx),
        y: clampUnit(drag.originY + dy),
      },
      { persist: drag.persist },
    );
  }

  function endDrag(event: PointerEvent<HTMLElement>, annotationId: string) {
    const drag = dragRef.current;
    if (!drag || drag.id !== annotationId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragRef.current = null;
    if (!drag.moved) {
      onToggleExpanded(annotationId);
      return;
    }

    onNoteDragEnd(annotationId, drag.persist);
  }

  if (notes.length === 0) {
    return null;
  }

  return (
    <div ref={layerRef} className="pointer-events-none absolute inset-0" style={{ zIndex: 40 }}>
      {notes.map((annotation) => {
        const geometry = annotation.geometry as NoteGeometry;
        const point = displayPoint(annotation, geometry);
        const expanded = expandedNoteIds.has(annotation.id);
        const accent = ANNOTATION_COLORS[annotation.layer];
        const opacity = annotationLayerOpacity(annotation, editingFocus);
        const zIndex = focusedNoteId === annotation.id ? 30 : 10;
        const showEdit = canEditNote(annotation);
        const title = noteTitle(geometry);

        return (
          <div
            key={annotation.id}
            className={`absolute max-w-[min(18rem,80%)] ${
              interactionBlocksNotes ? 'pointer-events-none' : 'pointer-events-auto'
            }`}
            style={{
              left: `${point.x * 100}%`,
              top: `${point.y * 100}%`,
              zIndex,
              opacity,
            }}
          >
            {expanded ? (
              <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
                <div
                  className="flex cursor-grab items-center gap-1 border-b border-border px-2 py-1 active:cursor-grabbing"
                  onPointerDown={(event) => beginDrag(event, annotation, geometry)}
                  onPointerMove={moveDrag}
                  onPointerUp={(event) => endDrag(event, annotation.id)}
                  onPointerCancel={(event) => endDrag(event, annotation.id)}
                >
                  <IconNote className="h-3.5 w-3.5 shrink-0" style={{ color: accent }} />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-text">
                    {title}
                  </span>
                  {showEdit ? (
                    <button
                      type="button"
                      aria-label="Editar nota"
                      title="Editar nota"
                      className="rounded p-1 text-muted hover:bg-bg hover:text-text"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        onEdit(annotation);
                      }}
                    >
                      <IconPencil className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    aria-label="Recolher nota"
                    title="Recolher nota"
                    className="rounded p-1 text-muted hover:bg-bg hover:text-text"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleExpanded(annotation.id);
                    }}
                  >
                    <IconX className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="max-h-48 overflow-auto px-2 py-1.5">
                  {geometry.body.trim() ? (
                    <MarkdownContent markdown={geometry.body} compact />
                  ) : (
                    <p className="text-xs text-muted">Sem conteúdo.</p>
                  )}
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="flex max-w-full cursor-grab items-center gap-1 rounded-full border border-border bg-surface px-2 py-1 text-left text-xs text-text shadow-sm active:cursor-grabbing"
                style={{ borderColor: accent }}
                aria-expanded={false}
                aria-label={title || 'Nota'}
                title={title || undefined}
                onPointerDown={(event) => beginDrag(event, annotation, geometry)}
                onPointerMove={moveDrag}
                onPointerUp={(event) => endDrag(event, annotation.id)}
                onPointerCancel={(event) => endDrag(event, annotation.id)}
              >
                <IconNote className="h-3.5 w-3.5 shrink-0" style={{ color: accent }} />
                {title ? <span className="truncate">{title}</span> : null}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
