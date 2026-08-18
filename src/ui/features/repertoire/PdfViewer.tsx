import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type {
  AnnotationLayer,
  CreatePdfAnnotationInput,
  NormalizedPoint,
  PdfAnnotation,
  StrokeGeometry,
} from '@/domain/repertoire';
import {
  ANNOTATION_COLORS,
  resolveHighlightColor,
} from '@/domain/repertoire';
import {
  IconArrowUpDown,
  IconMaximize,
  IconMinimize,
  IconMoon,
  IconUndo,
  IconSun,
} from '@/ui/components/icons';
import { Modal } from '@/ui/components/Modal';
import {
  AnnotationHighlightLayer,
  AnnotationInteractionLayer,
  AnnotationPenLayer,
  type AnnotationInteractionMode,
  type VisibleLayers,
} from '@/ui/features/repertoire/AnnotationOverlay';
import {
  isDraftAnnotationId,
} from '@/ui/features/repertoire/annotation-coordinates';
import {
  loadPdfReaderPreferences,
  savePdfReaderPreferences,
  type PdfNavigationMode,
} from '@/ui/features/repertoire/pdf-reader-preference-storage';

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const SWIPE_THRESHOLD_PX = 48;
const TAP_THRESHOLD_PX = 10;

export type SectionLeadOption = {
  id: string;
  name: string;
};

type PdfViewerProps = {
  url: string;
  userId: string | null;
  annotations: PdfAnnotation[];
  sectionLeadOptions: SectionLeadOption[];
  onAnnotationCreate: (
    input: Omit<CreatePdfAnnotationInput, 'pieceFileId'>,
  ) => Promise<PdfAnnotation | null>;
  onAnnotationDelete: (annotationId: string) => Promise<void>;
};

type PdfPageFrameProps = {
  pdf: pdfjs.PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  inverted: boolean;
  annotations: PdfAnnotation[];
  interactionMode: AnnotationInteractionMode;
  visibleLayers: VisibleLayers;
  penColor: string;
  highlightColor: string;
  readOnly: boolean;
  canEraseAnnotation: (annotation: PdfAnnotation) => boolean;
  onStrokeComplete: (pageNumber: number, geometry: StrokeGeometry) => void;
  onHighlightComplete: (pageNumber: number, geometry: StrokeGeometry) => void;
  onEraseAnnotation: (annotationId: string) => void;
};

function PdfPageFrame({
  pdf,
  pageNumber,
  scale,
  inverted,
  annotations,
  interactionMode,
  visibleLayers,
  penColor,
  highlightColor,
  readOnly,
  canEraseAnnotation,
  onStrokeComplete,
  onHighlightComplete,
  onEraseAnnotation,
}: PdfPageFrameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [draftStroke, setDraftStroke] = useState<NormalizedPoint[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask: pdfjs.RenderTask | null = null;

    pdf.getPage(pageNumber).then((page) => {
      if (cancelled) {
        return;
      }

      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      canvas.height = viewport.height;
      canvas.width = viewport.width;
      setDimensions({ width: viewport.width, height: viewport.height });

      const context = canvas.getContext('2d');
      if (!context) {
        return;
      }

      renderTask = page.render({ canvasContext: context, viewport, canvas });
      return renderTask.promise;
    });

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdf, pageNumber, scale]);

  const handleStrokeComplete = useCallback(
    (geometry: StrokeGeometry) => {
      onStrokeComplete(pageNumber, geometry);
    },
    [onStrokeComplete, pageNumber],
  );

  const handleHighlightComplete = useCallback(
    (geometry: StrokeGeometry) => {
      onHighlightComplete(pageNumber, geometry);
    },
    [onHighlightComplete, pageNumber],
  );

  return (
    <div
      className="relative mx-auto max-w-full"
      style={{
        width: dimensions.width > 0 ? dimensions.width : undefined,
        height: dimensions.height > 0 ? dimensions.height : undefined,
      }}
    >
      <div className={`relative ${inverted ? 'invert' : ''}`}>
        <canvas
          ref={canvasRef}
          className={`block w-full ${inverted ? 'bg-black' : 'bg-white'} ${
            inverted ? '' : 'shadow-sm'
          }`}
        />
        {dimensions.width > 0 && dimensions.height > 0 && (
          <AnnotationPenLayer
            pageNumber={pageNumber}
            annotations={annotations}
            visibleLayers={visibleLayers}
            penColor={penColor}
            draftStroke={draftStroke}
            showDraft={interactionMode === 'pen'}
          />
        )}
      </div>
      {dimensions.width > 0 && dimensions.height > 0 && (
        <>
          <AnnotationHighlightLayer
            pageNumber={pageNumber}
            annotations={annotations}
            visibleLayers={visibleLayers}
            highlightColor={highlightColor}
            inverted={inverted}
            draftStroke={draftStroke}
            showDraft={interactionMode === 'highlight'}
          />
          <AnnotationInteractionLayer
            pageNumber={pageNumber}
            annotations={annotations}
            visibleLayers={visibleLayers}
            mode={interactionMode}
            readOnly={readOnly}
            canEraseAnnotation={canEraseAnnotation}
            onStrokeComplete={handleStrokeComplete}
            onHighlightComplete={handleHighlightComplete}
            onEraseAnnotation={onEraseAnnotation}
            onDraftStrokeChange={setDraftStroke}
          />
        </>
      )}
    </div>
  );
}

function defaultPreferences(userId: string | null) {
  return userId
    ? loadPdfReaderPreferences(userId)
    : { inverted: false, navigation: 'vertical' as PdfNavigationMode };
}

function dedupeSectionLeadOptions(options: SectionLeadOption[]): SectionLeadOption[] {
  const seen = new Set<string>();
  const result: SectionLeadOption[] = [];
  for (const option of options) {
    if (seen.has(option.id)) {
      continue;
    }
    seen.add(option.id);
    result.push(option);
  }
  return result;
}

function createDraftAnnotation(
  input: Omit<CreatePdfAnnotationInput, 'pieceFileId'>,
  userId: string,
): PdfAnnotation {
  const now = new Date().toISOString();
  return {
    id: `draft-${crypto.randomUUID()}`,
    organizationId: '',
    pieceFileId: '',
    pageNumber: input.pageNumber,
    layer: input.layer,
    type: input.type,
    geometry: input.geometry,
    color: input.color,
    authorUserId: userId,
    sectionId: input.sectionId ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

function draftToCreateInput(
  draft: PdfAnnotation,
): Omit<CreatePdfAnnotationInput, 'pieceFileId'> {
  return {
    pageNumber: draft.pageNumber,
    layer: draft.layer,
    type: draft.type,
    geometry: draft.geometry,
    color: draft.color,
    sectionId: draft.sectionId,
  };
}

export function PdfViewer({
  url,
  userId,
  annotations,
  sectionLeadOptions,
  onAnnotationCreate,
  onAnnotationDelete,
}: PdfViewerProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const tapStartRef = useRef<{ x: number; y: number } | null>(null);

  const leadOptions = useMemo(
    () => dedupeSectionLeadOptions(sectionLeadOptions),
    [sectionLeadOptions],
  );
  const canEditSectionLayer = leadOptions.length > 0;

  const [pdf, setPdf] = useState<pdfjs.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inverted, setInverted] = useState(() => defaultPreferences(userId).inverted);
  const [navigation, setNavigation] = useState<PdfNavigationMode>(
    () => defaultPreferences(userId).navigation,
  );
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'next' | 'prev'>('next');
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [draftAnnotations, setDraftAnnotations] = useState<PdfAnnotation[]>([]);
  const [pendingDeletionIds, setPendingDeletionIds] = useState<string[]>([]);
  const [interactionMode, setInteractionMode] = useState<AnnotationInteractionMode>('read');
  const [activeLayer, setActiveLayer] = useState<AnnotationLayer>('personal');
  const [activeSectionId, setActiveSectionId] = useState<string | null>(
    leadOptions[0]?.id ?? null,
  );
  const [visibleLayers, setVisibleLayers] = useState<VisibleLayers>({
    personal: true,
    section: true,
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenControlsVisible, setFullscreenControlsVisible] = useState(false);

  useEffect(() => {
    if (leadOptions.length === 0) {
      setActiveSectionId(null);
      setActiveLayer('personal');
      return;
    }
    setActiveSectionId((current) => {
      if (current && leadOptions.some((option) => option.id === current)) {
        return current;
      }
      return leadOptions[0]?.id ?? null;
    });
  }, [leadOptions]);

  const persistPreferences = useCallback(
    (patch: Partial<{ inverted: boolean; navigation: PdfNavigationMode }>) => {
      if (!userId) {
        return;
      }
      const current = loadPdfReaderPreferences(userId);
      savePdfReaderPreferences(userId, { ...current, ...patch });
    },
    [userId],
  );

  useEffect(() => {
    if (!userId) {
      return;
    }
    const preferences = loadPdfReaderPreferences(userId);
    setInverted(preferences.inverted);
    setNavigation(preferences.navigation);
  }, [userId]);

  const toggleInvert = useCallback(() => {
    setInverted((current) => {
      const next = !current;
      persistPreferences({ inverted: next });
      return next;
    });
  }, [persistPreferences]);

  const toggleNavigation = useCallback(() => {
    setNavigation((current) => {
      const next: PdfNavigationMode = current === 'vertical' ? 'horizontal' : 'vertical';
      persistPreferences({ navigation: next });
      if (next === 'horizontal') {
        setCurrentPage(1);
        setShouldAnimate(false);
      }
      return next;
    });
  }, [persistPreferences]);

  const enterFullscreen = useCallback(() => {
    setIsFullscreen(true);
    setFullscreenControlsVisible(false);
  }, []);

  const exitFullscreen = useCallback(() => {
    setIsFullscreen(false);
    setFullscreenControlsVisible(false);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  const enterAnnotationMode = useCallback(() => {
    setDraftAnnotations([]);
    setPendingDeletionIds([]);
    setInteractionMode('pen');
    setIsAnnotating(true);
  }, []);

  const exitAnnotationMode = useCallback(() => {
    setIsAnnotating(false);
    setInteractionMode('read');
    setDraftAnnotations([]);
    setPendingDeletionIds([]);
    setShowDiscardConfirm(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadingTask = pdfjs.getDocument({ url });

    setLoading(true);
    setError(null);
    setPdf(null);
    setNumPages(0);
    setCurrentPage(1);
    setShouldAnimate(false);

    loadingTask.promise
      .then((document) => {
        if (cancelled) {
          void loadingTask.destroy();
          return;
        }
        setPdf(document);
        setNumPages(document.numPages);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setError('Não foi possível carregar o PDF.');
        setLoading(false);
      });

    return () => {
      cancelled = true;
      void loadingTask.destroy();
    };
  }, [url]);

  const getViewportElement = useCallback(() => {
    return navigation === 'horizontal' ? viewportRef.current : scrollRef.current;
  }, [navigation]);

  const fitToWidth = useCallback(async () => {
    if (!pdf) {
      return;
    }

    const container = getViewportElement();
    if (!container) {
      return;
    }

    const page = await pdf.getPage(navigation === 'horizontal' ? currentPage : 1);
    const viewport = page.getViewport({ scale: 1 });
    const containerWidth = container.clientWidth - 16;
    if (containerWidth <= 0 || viewport.width <= 0) {
      return;
    }

    setScale(containerWidth / viewport.width);
  }, [pdf, getViewportElement, navigation, currentPage]);

  const fitToPage = useCallback(async () => {
    if (!pdf) {
      return;
    }

    const container = getViewportElement();
    if (!container) {
      return;
    }

    const page = await pdf.getPage(navigation === 'horizontal' ? currentPage : 1);
    const viewport = page.getViewport({ scale: 1 });
    const containerWidth = container.clientWidth - 16;
    const containerHeight = container.clientHeight - 16;
    if (
      containerWidth <= 0 ||
      containerHeight <= 0 ||
      viewport.width <= 0 ||
      viewport.height <= 0
    ) {
      return;
    }

    const scaleX = containerWidth / viewport.width;
    const scaleY = containerHeight / viewport.height;
    setScale(Math.min(scaleX, scaleY));
  }, [pdf, getViewportElement, navigation, currentPage]);

  useEffect(() => {
    if (!pdf || numPages === 0) {
      return;
    }

    if (navigation === 'horizontal') {
      void fitToPage();
      return;
    }

    void fitToWidth();
  }, [pdf, numPages, navigation, fitToPage, fitToWidth]);

  useEffect(() => {
    if (!pdf || numPages === 0 || navigation !== 'horizontal') {
      return;
    }

    void fitToPage();
  }, [pdf, numPages, navigation, currentPage, fitToPage]);

  useEffect(() => {
    if (!pdf || numPages === 0) {
      return;
    }

    const handleResize = () => {
      if (navigation === 'horizontal') {
        void fitToPage();
      } else {
        void fitToWidth();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [pdf, numPages, navigation, fitToPage, fitToWidth]);

  useEffect(() => {
    if (!isFullscreen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (!isFullscreen || !pdf) {
      return;
    }

    const frameId = requestAnimationFrame(() => {
      if (navigation === 'horizontal') {
        void fitToPage();
      } else {
        void fitToWidth();
      }
    });

    return () => cancelAnimationFrame(frameId);
  }, [isFullscreen, pdf, navigation, fitToPage, fitToWidth]);

  useEffect(() => {
    if (!isFullscreen) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') {
        return;
      }

      if (fullscreenControlsVisible) {
        setFullscreenControlsVisible(false);
      } else {
        exitFullscreen();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullscreen, fullscreenControlsVisible, exitFullscreen]);

  const navigateHorizontal = useCallback(
    (direction: 'next' | 'prev') => {
      if (isAnnotating) {
        return;
      }

      if (direction === 'prev') {
        if (currentPage <= 1) {
          return;
        }
        setShouldAnimate(true);
        setSlideDirection('prev');
        setCurrentPage(currentPage - 1);
        return;
      }

      if (currentPage >= numPages) {
        return;
      }
      setShouldAnimate(true);
      setSlideDirection('next');
      setCurrentPage(currentPage + 1);
    },
    [currentPage, isAnnotating, numPages],
  );

  const goToPreviousPage = useCallback(() => {
    navigateHorizontal('prev');
  }, [navigateHorizontal]);

  const goToNextPage = useCallback(() => {
    navigateHorizontal('next');
  }, [navigateHorizontal]);

  useEffect(() => {
    if (navigation !== 'horizontal' || isAnnotating) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'ArrowRight' || event.key === 'PageDown') {
        event.preventDefault();
        goToNextPage();
      } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault();
        goToPreviousPage();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigation, isAnnotating, goToNextPage, goToPreviousPage]);

  const handleTouchStart = useCallback(
    (event: React.TouchEvent) => {
      if (isFullscreen) {
        return;
      }

      const touch = event.touches[0];
      if (!touch) {
        return;
      }
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    },
    [isFullscreen],
  );

  const handleFullscreenPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (!isFullscreen || isAnnotating) {
        return;
      }

      tapStartRef.current = { x: event.clientX, y: event.clientY };
    },
    [isFullscreen, isAnnotating],
  );

  const handleFullscreenPointerUp = useCallback(
    (event: React.PointerEvent) => {
      if (!isFullscreen || isAnnotating || !tapStartRef.current) {
        return;
      }

      const startX = tapStartRef.current.x;
      const startY = tapStartRef.current.y;
      tapStartRef.current = null;

      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (navigation === 'horizontal' && absX >= SWIPE_THRESHOLD_PX && absX > absY) {
        if (deltaX < 0) {
          goToNextPage();
        } else {
          goToPreviousPage();
        }
        return;
      }

      if (Math.hypot(deltaX, deltaY) > TAP_THRESHOLD_PX) {
        return;
      }

      if (navigation === 'horizontal') {
        const viewport = viewportRef.current;
        if (viewport) {
          const relativeX = event.clientX - viewport.getBoundingClientRect().left;
          const third = viewport.clientWidth / 3;

          if (relativeX < third) {
            goToPreviousPage();
            return;
          }

          if (relativeX > third * 2) {
            goToNextPage();
            return;
          }
        }
      }

      setFullscreenControlsVisible((current) => !current);
    },
    [isFullscreen, isAnnotating, navigation, goToNextPage, goToPreviousPage],
  );

  const handleTouchEnd = useCallback(
    (event: React.TouchEvent) => {
      if (isFullscreen || navigation !== 'horizontal' || !touchStartRef.current || isAnnotating) {
        return;
      }

      const touch = event.changedTouches[0];
      if (!touch) {
        touchStartRef.current = null;
        return;
      }

      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;
      touchStartRef.current = null;

      if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX || Math.abs(deltaX) < Math.abs(deltaY)) {
        return;
      }

      if (deltaX < 0) {
        goToNextPage();
      } else {
        goToPreviousPage();
      }
    },
    [isFullscreen, navigation, isAnnotating, goToNextPage, goToPreviousPage],
  );

  const displayAnnotations = useMemo(() => {
    const deleted = new Set(pendingDeletionIds);
    return [
      ...annotations.filter((annotation) => !deleted.has(annotation.id)),
      ...draftAnnotations,
    ];
  }, [annotations, draftAnnotations, pendingDeletionIds]);

  const penColor =
    activeLayer === 'section' ? ANNOTATION_COLORS.section : ANNOTATION_COLORS.personal;

  const highlightColor = resolveHighlightColor(activeLayer, inverted);

  const annotationReadOnly =
    !userId ||
    (activeLayer === 'section' && (!canEditSectionLayer || !activeSectionId));

  const hasUnsavedChanges =
    draftAnnotations.length > 0 || pendingDeletionIds.length > 0;

  const canEraseAnnotation = useCallback(
    (annotation: PdfAnnotation) => {
      if (!userId) {
        return false;
      }

      if (isDraftAnnotationId(annotation.id)) {
        return true;
      }

      if (annotation.layer === 'personal') {
        return annotation.authorUserId === userId;
      }

      return (
        canEditSectionLayer &&
        annotation.sectionId !== null &&
        leadOptions.some((option) => option.id === annotation.sectionId)
      );
    },
    [userId, canEditSectionLayer, leadOptions],
  );

  const handleSaveAnnotations = useCallback(async () => {
    if (!userId || isSaving) {
      return;
    }

    if (!hasUnsavedChanges) {
      exitAnnotationMode();
      return;
    }

    setIsSaving(true);
    for (const annotationId of pendingDeletionIds) {
      if (!isDraftAnnotationId(annotationId)) {
        await onAnnotationDelete(annotationId);
      }
    }
    for (const draft of draftAnnotations) {
      await onAnnotationCreate(draftToCreateInput(draft));
    }
    setIsSaving(false);
    exitAnnotationMode();
  }, [
    userId,
    isSaving,
    hasUnsavedChanges,
    pendingDeletionIds,
    draftAnnotations,
    onAnnotationDelete,
    onAnnotationCreate,
    exitAnnotationMode,
  ]);

  const handleDiscardAnnotations = useCallback(() => {
    if (!hasUnsavedChanges) {
      exitAnnotationMode();
      return;
    }
    setShowDiscardConfirm(true);
  }, [hasUnsavedChanges, exitAnnotationMode]);

  const confirmDiscardAnnotations = useCallback(() => {
    exitAnnotationMode();
  }, [exitAnnotationMode]);

  const addDraftAnnotation = useCallback(
    (input: Omit<CreatePdfAnnotationInput, 'pieceFileId'>) => {
      if (!userId) {
        return;
      }
      setDraftAnnotations((current) => [...current, createDraftAnnotation(input, userId)]);
    },
    [userId],
  );

  const handleStrokeComplete = useCallback(
    (pageNumber: number, geometry: StrokeGeometry) => {
      if (annotationReadOnly) {
        return;
      }

      addDraftAnnotation({
        pageNumber,
        layer: activeLayer,
        type: 'stroke',
        geometry,
        color: penColor,
        sectionId: activeLayer === 'section' ? activeSectionId : null,
      });
    },
    [penColor, activeLayer, activeSectionId, annotationReadOnly, addDraftAnnotation],
  );

  const handleHighlightComplete = useCallback(
    (pageNumber: number, geometry: StrokeGeometry) => {
      if (annotationReadOnly) {
        return;
      }

      addDraftAnnotation({
        pageNumber,
        layer: activeLayer,
        type: 'highlight',
        geometry,
        color: highlightColor,
        sectionId: activeLayer === 'section' ? activeSectionId : null,
      });
    },
    [highlightColor, activeLayer, activeSectionId, annotationReadOnly, addDraftAnnotation],
  );

  const handleEraseAnnotation = useCallback(
    (annotationId: string) => {
      if (isDraftAnnotationId(annotationId)) {
        setDraftAnnotations((current) =>
          current.filter((annotation) => annotation.id !== annotationId),
        );
        return;
      }

      setPendingDeletionIds((current) =>
        current.includes(annotationId) ? current : [...current, annotationId],
      );
    },
    [],
  );

  const handleUndoLast = useCallback(() => {
    setDraftAnnotations((current) => current.slice(0, -1));
  }, []);

  if (loading) {
    return <p className="p-4 text-sm text-muted">Carregando PDF…</p>;
  }

  if (error) {
    return <p className="p-4 text-sm text-red-600">{error}</p>;
  }

  if (!pdf || numPages === 0) {
    return <p className="p-4 text-sm text-muted">PDF vazio.</p>;
  }

  const pageNumbers = Array.from({ length: numPages }, (_, index) => index + 1);
  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < numPages;
  const surfaceClass = inverted ? 'bg-black' : 'bg-bg';
  const slideClass = shouldAnimate
    ? slideDirection === 'next'
      ? 'upload-entry-slide-in-next'
      : 'upload-entry-slide-in-prev'
    : '';
  const effectiveInteractionMode: AnnotationInteractionMode = isAnnotating ? interactionMode : 'read';

  const pageFrameProps = {
    pdf,
    scale,
    inverted,
    annotations: displayAnnotations,
    interactionMode: effectiveInteractionMode,
    visibleLayers,
    penColor,
    highlightColor,
    readOnly: !userId || (interactionMode !== 'eraser' && annotationReadOnly),
    canEraseAnnotation,
    onStrokeComplete: handleStrokeComplete,
    onHighlightComplete: handleHighlightComplete,
    onEraseAnnotation: handleEraseAnnotation,
  };

  const showFullscreenControls = !isFullscreen || isAnnotating || fullscreenControlsVisible;
  const controlsBarClass = isFullscreen
    ? `pdf-fullscreen-controls absolute inset-x-0 top-0 z-20 flex flex-wrap items-center justify-center gap-2 border-b border-border bg-surface/95 px-4 py-2 shadow-md backdrop-blur-sm ${
        showFullscreenControls ? '' : 'pdf-fullscreen-controls-hidden'
      }`
    : 'flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-2 border-b border-border px-3 py-2 sm:px-4';
  const rootClass = isFullscreen
    ? `fixed inset-0 z-50 flex flex-col ${surfaceClass}`
    : 'flex min-h-0 flex-1 flex-col';
  const viewportPadding = isFullscreen ? 'p-0' : 'p-2';
  const viewportInteractionProps = isFullscreen && !isAnnotating
    ? {
        onPointerDown: handleFullscreenPointerDown,
        onPointerUp: handleFullscreenPointerUp,
        onPointerCancel: () => {
          tapStartRef.current = null;
        },
      }
    : {};

  const controlsBar = (
    <div
      className={controlsBarClass}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {isAnnotating ? (
        <>
          {canEditSectionLayer && (
            <>
              <span className="text-sm text-muted">Camada:</span>
              <button
                type="button"
                onClick={() => setActiveLayer('personal')}
                aria-pressed={activeLayer === 'personal'}
                className={`rounded-lg border px-2 py-1 text-sm ${
                  activeLayer === 'personal'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-text'
                }`}
              >
                Pessoal
              </button>
              <button
                type="button"
                onClick={() => setActiveLayer('section')}
                aria-pressed={activeLayer === 'section'}
                className={`rounded-lg border px-2 py-1 text-sm ${
                  activeLayer === 'section'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-text'
                }`}
              >
                Naipe
              </button>
              {activeLayer === 'section' && leadOptions.length > 1 && (
                <select
                  value={activeSectionId ?? ''}
                  onChange={(event) => setActiveSectionId(event.target.value || null)}
                  className="rounded-lg border border-border bg-surface px-2 py-1 text-sm text-text"
                  aria-label="Naipe para anotação"
                >
                  {leadOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              )}
            </>
          )}
          <span className="mx-2 inline-block h-6 w-px bg-border align-middle" aria-hidden="true" />
          <button
            type="button"
            onClick={() => setInteractionMode('pen')}
            aria-pressed={interactionMode === 'pen'}
            className={`rounded-lg border px-2 py-1 text-sm ${
              interactionMode === 'pen'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-text'
            }`}
          >
            Caneta
          </button>
          <button
            type="button"
            onClick={() => setInteractionMode('highlight')}
            aria-pressed={interactionMode === 'highlight'}
            className={`rounded-lg border px-2 py-1 text-sm ${
              interactionMode === 'highlight'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-text'
            }`}
          >
            Marca-texto
          </button>
          <button
            type="button"
            onClick={() => setInteractionMode('eraser')}
            aria-pressed={interactionMode === 'eraser'}
            className={`rounded-lg border px-2 py-1 text-sm ${
              interactionMode === 'eraser'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-text'
            }`}
          >
            Borracha
          </button>
          <button
            type="button"
            onClick={handleUndoLast}
            disabled={draftAnnotations.length === 0}
            className="rounded-lg border border-border px-2 py-1 text-sm text-text disabled:opacity-50"
          >
            <IconUndo className="h-5 w-5" />
          </button>
          
          <span className="flex-1" aria-hidden />
          <button
            type="button"
            onClick={() => void handleSaveAnnotations()}
            disabled={isSaving}
            className="rounded-lg border border-primary bg-primary px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
          >
            {isSaving ? 'Salvando…' : 'Salvar'}
          </button>
          <button
            type="button"
            onClick={handleDiscardAnnotations}
            disabled={isSaving}
            className="rounded-lg border border-border px-3 py-1 text-sm text-text disabled:opacity-50"
          >
            Descartar
          </button>
        </>
      ) : (
        <>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setScale((current) => Math.max(0.5, current - 0.15))}
              className="rounded-lg border border-border px-2 py-1 text-sm text-text"
              aria-label="Diminuir zoom"
            >
              −
            </button>
            <span className="min-w-10 text-center text-sm text-text sm:min-w-12">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setScale((current) => Math.min(3, current + 0.15))}
              className="rounded-lg border border-border px-2 py-1 text-sm text-text"
              aria-label="Aumentar zoom"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => void fitToWidth()}
              className="rounded-lg border border-border px-2 py-1 text-sm text-text"
              aria-label="Ajustar largura"
              title="Ajustar largura"
            >
              <span className="sm:hidden">Largura</span>
              <span className="hidden sm:inline">Ajustar largura</span>
            </button>
            <button
              type="button"
              onClick={() => void fitToPage()}
              className="rounded-lg border border-border px-2 py-1 text-sm text-text"
              aria-label="Ajustar página"
              title="Ajustar página"
            >
              <span className="sm:hidden">Página</span>
              <span className="hidden sm:inline">Ajustar página</span>
            </button>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-1.5 gap-y-2 sm:gap-x-2">
            <button
              type="button"
              onClick={toggleNavigation}
              aria-pressed={navigation === 'horizontal'}
              aria-label={
                navigation === 'horizontal'
                  ? 'Usar navegação vertical'
                  : 'Usar navegação lateral'
              }
              title={navigation === 'horizontal' ? 'Navegação vertical' : 'Navegação lateral'}
              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-sm ${
                navigation === 'horizontal'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-text'
              }`}
            >
              <IconArrowUpDown className={`h-4 w-4 ${navigation === 'horizontal' ? 'rotate-90' : ''}`} />
              <span className="hidden sm:inline">
                {navigation === 'horizontal' ? 'Lateral' : 'Vertical'}
              </span>
            </button>
            <button
              type="button"
              onClick={toggleInvert}
              aria-pressed={inverted}
              aria-label={inverted ? 'Desativar inversão de cores' : 'Inverter cores da partitura'}
              title={inverted ? 'Cores normais' : 'Inverter cores'}
              className={`rounded-lg border px-2 py-1 text-sm ${
                inverted
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-text'
              }`}
            >
              {inverted ? <IconSun className="h-4 w-4" /> : <IconMoon className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-pressed={isFullscreen}
              aria-label={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
              title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
              className={`rounded-lg border px-2 py-1 text-sm ${
                isFullscreen
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-text'
              }`}
            >
              {isFullscreen ? <IconMinimize className="h-4 w-4" /> : <IconMaximize className="h-4 w-4" />}
            </button>
            <span className="mx-0.5 hidden h-6 w-px bg-border sm:mx-1 sm:inline-block" aria-hidden="true" />
            <button
              type="button"
              onClick={() =>
                setVisibleLayers((current) => ({ ...current, personal: !current.personal }))
              }
              aria-pressed={visibleLayers.personal}
              aria-label="Mostrar anotações pessoais"
              title="Mostrar anotações pessoais"
              className={`rounded-lg border px-2 py-1 text-sm ${
                visibleLayers.personal
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-text'
              }`}
            >
              <span className="sm:hidden">Pessoais</span>
              <span className="hidden sm:inline">Ver pessoais</span>
            </button>
            {canEditSectionLayer && (
              <button
                type="button"
                onClick={() =>
                  setVisibleLayers((current) => ({ ...current, section: !current.section }))
                }
                aria-pressed={visibleLayers.section}
                aria-label="Mostrar anotações do naipe"
                title="Mostrar anotações do naipe"
                className={`rounded-lg border px-2 py-1 text-sm ${
                  visibleLayers.section
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-text'
                }`}
              >
                <span className="sm:hidden">Naipe</span>
                <span className="hidden sm:inline">Ver naipe</span>
              </button>
            )}
            {userId && (
              <button
                type="button"
                onClick={enterAnnotationMode}
                className="rounded-lg border border-border px-2 py-1 text-sm text-text"
              >
                Anotar
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className={rootClass}>
      {controlsBar}

      {navigation === 'horizontal' ? (
        <div
          ref={viewportRef}
          className={`relative flex min-h-0 flex-1 touch-pan-y items-center justify-center overflow-hidden ${viewportPadding} ${surfaceClass}`}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          {...viewportInteractionProps}
        >
          <div key={currentPage} className={`flex w-full items-center justify-center ${slideClass}`}>
            <PdfPageFrame pageNumber={currentPage} {...pageFrameProps} />
          </div>

          {!isAnnotating && !isFullscreen && (
            <>
              <button
                type="button"
                onClick={goToPreviousPage}
                disabled={!canGoPrevious}
                aria-label="Página anterior"
                className="absolute inset-y-0 left-0 z-10 w-1/3 disabled:cursor-default"
              />
              <button
                type="button"
                onClick={goToNextPage}
                disabled={!canGoNext}
                aria-label="Próxima página"
                className="absolute inset-y-0 right-0 z-10 w-1/3 disabled:cursor-default"
              />
            </>
          )}
        </div>
      ) : (
        <div
          ref={scrollRef}
          className={`min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain ${viewportPadding} ${surfaceClass}`}
          {...viewportInteractionProps}
        >
          {pageNumbers.map((pageNumber) => (
            <PdfPageFrame key={pageNumber} pageNumber={pageNumber} {...pageFrameProps} />
          ))}
        </div>
      )}
      <Modal
        open={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        title="Descartar anotações?"
      >
        <p className="text-sm text-muted">
          As alterações desta sessão serão perdidas. Esta ação não pode ser desfeita.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowDiscardConfirm(false)}
            className="rounded-lg border border-border px-3 py-2 text-sm text-text"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmDiscardAnnotations}
            className="rounded-lg border border-red-600 bg-red-600 px-3 py-2 text-sm font-medium text-white"
          >
            Descartar
          </button>
        </div>
      </Modal>
    </div>
  );
}
