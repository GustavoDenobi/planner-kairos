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
import { useLoadingBar } from '@/ui/app/loading-bar/useLoadingBar';
import {
  IconArrowUpDown,
  IconChevronLeft,
  IconChevronRight,
  IconMaximize,
  IconMinimize,
  IconMoon,
  IconPencil,
  IconUndo,
  IconSun,
  IconZoomIn,
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
import {
  isScaleZoomed,
  MIN_PDF_SCALE,
  nextDoubleTapFitMode,
} from '@/ui/features/repertoire/pdf-viewport-gestures';
import { usePdfViewportGestures } from '@/ui/features/repertoire/usePdfViewportGestures';

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const SWIPE_THRESHOLD_PX = 48;

export type SectionLeadOption = {
  id: string;
  name: string;
};

export type PdfViewerPlaylistContext = {
  title: string;
  currentIndex: number;
  totalItems: number;
  currentItemLabel: string;
  canGoPrevious: boolean;
  canGoNext: boolean;
  onPreviousItem: () => void;
  onGoNextItem: () => void;
  onContinueToPreviousItem: () => void;
  onContinueToNextItem: () => void;
};

type PdfViewerPlaylistNavProps = {
  playlist: PdfViewerPlaylistContext;
  onPrevious: () => void;
  onNext: () => void;
};

export function PdfViewerPlaylistNav({
  playlist,
  onPrevious,
  onNext,
}: PdfViewerPlaylistNavProps) {
  return (
    <div className="flex min-w-0 w-full items-center justify-center gap-x-3">
      <button
        type="button"
        onClick={onPrevious}
        disabled={!playlist.canGoPrevious}
        aria-label="Obra anterior"
        className="rounded-lg border border-border p-2 text-text disabled:opacity-40"
      >
        <IconChevronLeft className="h-5 w-5" />
      </button>
      <div className="min-w-0 text-center">
        <p className="truncate text-sm font-medium text-text">
          {playlist.currentIndex + 1} / {playlist.totalItems} — {playlist.currentItemLabel}
        </p>
        <p className="truncate text-xs text-muted">{playlist.title}</p>
      </div>
      <button
        type="button"
        onClick={onNext}
        disabled={!playlist.canGoNext}
        aria-label="Próxima obra"
        className="rounded-lg border border-border p-2 text-text disabled:opacity-40"
      >
        <IconChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}

type PdfViewerProps = {
  url: string;
  userId: string | null;
  annotations: PdfAnnotation[];
  sectionLeadOptions: SectionLeadOption[];
  playlist?: PdfViewerPlaylistContext;
  initialPage?: number;
  entryDirection?: 'next' | 'prev';
  preloadedPdf?: pdfjs.PDFDocumentProxy | null;
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
  gesturesActive: boolean;
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
  gesturesActive,
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
      className="relative mx-auto shrink-0"
      style={{
        width: dimensions.width > 0 ? dimensions.width : undefined,
        height: dimensions.height > 0 ? dimensions.height : undefined,
      }}
    >
      <div className={`relative ${inverted ? 'invert' : ''}`}>
        <canvas
          ref={canvasRef}
          className={`block ${inverted ? 'bg-black' : 'bg-white'} ${
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
            gesturesActive={gesturesActive}
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
    : { inverted: false, navigation: 'horizontal' as PdfNavigationMode };
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
  playlist,
  initialPage = 1,
  entryDirection,
  preloadedPdf = null,
  onAnnotationCreate,
  onAnnotationDelete,
}: PdfViewerProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
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
  const [fitScale, setFitScale] = useState(1);
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const fitScaleRef = useRef(fitScale);
  fitScaleRef.current = fitScale;
  const doubleTapFitRef = useRef<() => void>(() => {});
  const viewportSingleTapRef = useRef<(point: { x: number; y: number }) => void>(() => {});
  const [loading, setLoading] = useState(true);
  useLoadingBar('pdf', loading);
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
  const [mobileToolbarPanel, setMobileToolbarPanel] = useState<'zoom' | 'annotate' | null>(null);

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
    setMobileToolbarPanel(null);
  }, []);

  const exitAnnotationMode = useCallback(() => {
    setIsAnnotating(false);
    setInteractionMode('read');
    setDraftAnnotations([]);
    setPendingDeletionIds([]);
    setShowDiscardConfirm(false);
    setMobileToolbarPanel(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const resolvedInitialPage = Math.max(1, initialPage);

    if (preloadedPdf) {
      setLoading(true);
      setError(null);
      setPdf(preloadedPdf);
      setNumPages(preloadedPdf.numPages);
      setCurrentPage(Math.min(resolvedInitialPage, preloadedPdf.numPages));
      setShouldAnimate(Boolean(entryDirection));
      setSlideDirection(entryDirection ?? 'next');
      setLoading(false);
      return;
    }

    const loadingTask = pdfjs.getDocument({ url });

    setLoading(true);
    setError(null);
    setPdf(null);
    setNumPages(0);
    setCurrentPage(resolvedInitialPage);
    setShouldAnimate(Boolean(entryDirection));
    setSlideDirection(entryDirection ?? 'next');

    loadingTask.promise
      .then((document) => {
        if (cancelled) {
          void loadingTask.destroy();
          return;
        }
        setPdf(document);
        setNumPages(document.numPages);
        setCurrentPage(Math.min(resolvedInitialPage, document.numPages));
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setError('Não foi possível carregar a partitura. Verifique a conexão ou baixe o arquivo para uso offline.');
        setLoading(false);
      });

    return () => {
      cancelled = true;
      void loadingTask.destroy();
    };
  }, [url, preloadedPdf, initialPage, entryDirection]);

  const getViewportElement = useCallback(() => {
    return navigation === 'horizontal' ? viewportRef.current : scrollRef.current;
  }, [navigation]);

  const { pan, isGesturing, isZoomed, resetPan } = usePdfViewportGestures({
    viewportRef: navigation === 'horizontal' ? viewportRef : scrollRef,
    contentRef,
    scale,
    setScale,
    fitScale,
    navigation,
    isAnnotating,
    enabled: Boolean(pdf) && numPages > 0,
    onDoubleTap: () => doubleTapFitRef.current(),
    onSingleTap: (point) => viewportSingleTapRef.current(point),
  });

  const applyFitScale = useCallback(
    (next: number, force = false) => {
      setFitScale(next);
      if (force || !isScaleZoomed(scaleRef.current, fitScaleRef.current)) {
        setScale(next);
        resetPan();
      }
    },
    [resetPan],
  );

  const computeFitScale = useCallback(
    async (mode: 'width' | 'page') => {
      if (!pdf) {
        return null;
      }

      const container = getViewportElement();
      if (!container) {
        return null;
      }

      const page = await pdf.getPage(navigation === 'horizontal' ? currentPage : 1);
      const viewport = page.getViewport({ scale: 1 });
      const containerWidth = container.clientWidth - 16;
      const containerHeight = container.clientHeight - 16;
      if (containerWidth <= 0 || viewport.width <= 0) {
        return null;
      }

      if (mode === 'width') {
        return containerWidth / viewport.width;
      }

      if (containerHeight <= 0 || viewport.height <= 0) {
        return null;
      }

      return Math.min(containerWidth / viewport.width, containerHeight / viewport.height);
    },
    [pdf, getViewportElement, navigation, currentPage],
  );

  const fitToWidth = useCallback(async (force = false) => {
    const next = await computeFitScale('width');
    if (next == null) {
      return;
    }
    applyFitScale(next, force);
  }, [applyFitScale, computeFitScale]);

  const fitToPage = useCallback(async (force = false) => {
    const next = await computeFitScale('page');
    if (next == null) {
      return;
    }
    applyFitScale(next, force);
  }, [applyFitScale, computeFitScale]);

  const handleDoubleTapFit = useCallback(async () => {
    const [widthScale, pageScale] = await Promise.all([
      computeFitScale('width'),
      computeFitScale('page'),
    ]);
    if (widthScale == null || pageScale == null) {
      return;
    }

    if (nextDoubleTapFitMode(scaleRef.current, widthScale, pageScale) === 'page') {
      await fitToPage(true);
      return;
    }

    await fitToWidth(true);
  }, [computeFitScale, fitToPage, fitToWidth]);
  doubleTapFitRef.current = () => {
    void handleDoubleTapFit();
  };

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
    resetPan();
  }, [currentPage, navigation, resetPan]);

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
    if (isAnnotating) {
      return;
    }
    if (currentPage <= 1) {
      if (navigation === 'horizontal' && playlist?.canGoPrevious) {
        playlist.onContinueToPreviousItem();
      }
      return;
    }
    navigateHorizontal('prev');
  }, [currentPage, isAnnotating, navigateHorizontal, navigation, playlist]);

  const goToNextPage = useCallback(() => {
    if (isAnnotating) {
      return;
    }
    if (currentPage >= numPages) {
      if (navigation === 'horizontal' && playlist?.canGoNext) {
        playlist.onContinueToNextItem();
      }
      return;
    }
    navigateHorizontal('next');
  }, [currentPage, isAnnotating, numPages, navigateHorizontal, navigation, playlist]);

  const handleViewportSingleTap = useCallback(
    (point: { x: number; y: number }) => {
      if (isAnnotating) {
        return;
      }

      const viewport = getViewportElement();
      if (!viewport) {
        return;
      }

      const relativeX = point.x - viewport.getBoundingClientRect().left;
      const third = viewport.clientWidth / 3;

      if (!isZoomed && navigation === 'horizontal') {
        if (relativeX < third) {
          goToPreviousPage();
          return;
        }
        if (relativeX > third * 2) {
          goToNextPage();
          return;
        }
      }

      if (isFullscreen) {
        setFullscreenControlsVisible((current) => !current);
      }
    },
    [
      getViewportElement,
      goToNextPage,
      goToPreviousPage,
      isAnnotating,
      isFullscreen,
      isZoomed,
      navigation,
    ],
  );
  viewportSingleTapRef.current = handleViewportSingleTap;

  const goToPreviousItem = useCallback(() => {
    if (isAnnotating || !playlist?.canGoPrevious) {
      return;
    }
    playlist.onPreviousItem();
  }, [isAnnotating, playlist]);

  const goToNextItem = useCallback(() => {
    if (isAnnotating || !playlist?.canGoNext) {
      return;
    }
    playlist.onGoNextItem();
  }, [isAnnotating, playlist]);

  useEffect(() => {
    if (navigation !== 'horizontal' || isAnnotating) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (playlist && event.shiftKey) {
        if (event.key === 'ArrowRight' || event.key === 'PageDown') {
          event.preventDefault();
          goToNextItem();
          return;
        }
        if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
          event.preventDefault();
          goToPreviousItem();
          return;
        }
      }

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
  }, [
    navigation,
    isAnnotating,
    goToNextPage,
    goToPreviousPage,
    playlist,
    goToNextItem,
    goToPreviousItem,
  ]);

  const handleTouchStart = useCallback(
    (event: React.TouchEvent) => {
      if (isFullscreen || isZoomed || isGesturing || event.touches.length !== 1) {
        return;
      }

      const touch = event.touches[0];
      if (!touch) {
        return;
      }
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    },
    [isFullscreen, isGesturing, isZoomed],
  );

  const handleFullscreenPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (!isFullscreen || isAnnotating || isGesturing) {
        return;
      }

      tapStartRef.current = { x: event.clientX, y: event.clientY };
    },
    [isFullscreen, isAnnotating, isGesturing],
  );

  const handleFullscreenPointerUp = useCallback(
    (event: React.PointerEvent) => {
      if (!isFullscreen || isAnnotating || isGesturing || !tapStartRef.current) {
        return;
      }

      const startX = tapStartRef.current.x;
      const startY = tapStartRef.current.y;
      tapStartRef.current = null;

      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (!isZoomed && navigation === 'horizontal' && absX >= SWIPE_THRESHOLD_PX && absX > absY) {
        if (deltaX < 0) {
          goToNextPage();
        } else {
          goToPreviousPage();
        }
      }
    },
    [isFullscreen, isAnnotating, isGesturing, isZoomed, navigation, goToNextPage, goToPreviousPage],
  );

  const handleTouchEnd = useCallback(
    (event: React.TouchEvent) => {
      if (
        isFullscreen ||
        navigation !== 'horizontal' ||
        !touchStartRef.current ||
        isAnnotating ||
        isZoomed ||
        isGesturing
      ) {
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
    [isFullscreen, navigation, isAnnotating, isGesturing, isZoomed, goToNextPage, goToPreviousPage],
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
  const canGoPrevious =
    currentPage > 1 || (navigation === 'horizontal' && (playlist?.canGoPrevious ?? false));
  const canGoNext =
    currentPage < numPages || (navigation === 'horizontal' && (playlist?.canGoNext ?? false));
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
    gesturesActive: isGesturing,
  };

  const showFullscreenControls = !isFullscreen || isAnnotating || fullscreenControlsVisible;
  const controlsBarClass = isFullscreen
    ? `pdf-fullscreen-controls absolute inset-x-0 top-0 z-20 flex flex-col border-b border-border bg-surface/95 shadow-md backdrop-blur-sm ${
        showFullscreenControls ? '' : 'pdf-fullscreen-controls-hidden'
      }`
    : 'flex shrink-0 flex-col border-b border-border';
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

  const controlsRowClass =
    'flex flex-wrap items-center justify-center gap-x-3 gap-y-2 px-4 py-2';
  const toolbarIconButtonClass = (active = false) =>
    `inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
      active ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text'
    }`;
  const mobilePanelButtonClass = (active: boolean) =>
    `${toolbarIconButtonClass(active)} lg:hidden`;
  const mobilePanelRowClass = `${controlsRowClass} border-t border-border lg:hidden`;

  const renderZoomControls = () => (
    <div className="flex shrink-0 items-center gap-1.5 lg:gap-2">
      <button
        type="button"
        onClick={() => setScale((current) => Math.max(MIN_PDF_SCALE, current - 0.15))}
        className="rounded-lg border border-border px-2 py-1 text-sm text-text"
        aria-label="Diminuir zoom"
      >
        −
      </button>
      <span className="min-w-10 text-center text-sm text-text lg:min-w-12">
        {Math.round(scale * 100)}%
      </span>
      <button
        type="button"
        onClick={() => setScale((current) => current + 0.15)}
        className="rounded-lg border border-border px-2 py-1 text-sm text-text"
        aria-label="Aumentar zoom"
      >
        +
      </button>
      <button
        type="button"
        onClick={() => void fitToWidth(true)}
        className="rounded-lg border border-border px-2 py-1 text-sm text-text"
        aria-label="Ajustar largura"
        title="Ajustar largura"
      >
        <span className="lg:hidden">Largura</span>
        <span className="hidden lg:inline">Ajustar largura</span>
      </button>
      <button
        type="button"
        onClick={() => void fitToPage(true)}
        className="rounded-lg border border-border px-2 py-1 text-sm text-text"
        aria-label="Ajustar página"
        title="Ajustar página"
      >
        <span className="lg:hidden">Página</span>
        <span className="hidden lg:inline">Ajustar página</span>
      </button>
    </div>
  );

  const renderViewAnnotationControls = () => (
    <>
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
        <span className="lg:hidden">Pessoais</span>
        <span className="hidden lg:inline">Ver pessoais</span>
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
          <span className="lg:hidden">Naipe</span>
          <span className="hidden lg:inline">Ver naipe</span>
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
    </>
  );

  const renderAnnotationToolControls = () => (
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
          <span className="mx-2 inline-block h-6 w-px bg-border align-middle" aria-hidden="true" />
        </>
      )}
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
    </>
  );

  const playlistBar = playlist && isFullscreen
    ? (
        <div className={`${controlsRowClass} border-b border-border bg-surface/95`}>
          <PdfViewerPlaylistNav
            playlist={playlist}
            onPrevious={goToPreviousItem}
            onNext={goToNextItem}
          />
        </div>
      )
    : null;

  const controlsBar = (
    <div
      className={controlsBarClass}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {playlistBar}
      {isAnnotating ? (
        <>
          <div className={controlsRowClass}>
            <button
              type="button"
              onClick={() =>
                setMobileToolbarPanel((current) => (current === 'annotate' ? null : 'annotate'))
              }
              aria-label="Ferramentas de anotação"
              aria-expanded={mobileToolbarPanel === 'annotate'}
              aria-pressed={mobileToolbarPanel === 'annotate'}
              className={mobilePanelButtonClass(mobileToolbarPanel === 'annotate')}
            >
              <IconPencil className="h-4 w-4" />
            </button>
            <div className="hidden flex-wrap items-center justify-center gap-x-3 gap-y-2 lg:flex">
              {renderAnnotationToolControls()}
            </div>
            <button
              type="button"
              onClick={handleUndoLast}
              disabled={draftAnnotations.length === 0}
              className={`${toolbarIconButtonClass()} disabled:opacity-50`}
              aria-label="Desfazer"
            >
              <IconUndo className="h-4 w-4" />
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
          </div>
          {mobileToolbarPanel === 'annotate' && (
            <div className={mobilePanelRowClass}>{renderAnnotationToolControls()}</div>
          )}
        </>
      ) : (
        <>
          <div className={controlsRowClass}>
            <div className="flex items-center justify-center gap-1.5 lg:gap-2">
            <button
              type="button"
              onClick={() =>
                setMobileToolbarPanel((current) => (current === 'zoom' ? null : 'zoom'))
              }
              aria-label="Opções de zoom"
              aria-expanded={mobileToolbarPanel === 'zoom'}
              aria-pressed={mobileToolbarPanel === 'zoom'}
              className={mobilePanelButtonClass(mobileToolbarPanel === 'zoom')}
            >
              <IconZoomIn className="h-4 w-4" />
            </button>
            <div className="hidden lg:block">{renderZoomControls()}</div>

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
                className={`${toolbarIconButtonClass(navigation === 'horizontal')} lg:h-auto lg:w-auto lg:gap-1 lg:px-2 lg:py-1`}
              >
                <IconArrowUpDown className={`h-4 w-4 ${navigation === 'horizontal' ? 'rotate-90' : ''}`} />
                <span className="hidden lg:inline">
                  {navigation === 'horizontal' ? 'Lateral' : 'Vertical'}
                </span>
              </button>
              <button
                type="button"
                onClick={toggleInvert}
                aria-pressed={inverted}
                aria-label={inverted ? 'Desativar inversão de cores' : 'Inverter cores da partitura'}
                title={inverted ? 'Cores normais' : 'Inverter cores'}
                className={toolbarIconButtonClass(inverted)}
              >
                {inverted ? <IconSun className="h-4 w-4" /> : <IconMoon className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={toggleFullscreen}
                aria-pressed={isFullscreen}
                aria-label={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
                title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
                className={toolbarIconButtonClass(isFullscreen)}
              >
                {isFullscreen ? <IconMinimize className="h-4 w-4" /> : <IconMaximize className="h-4 w-4" />}
              </button>

            <button
              type="button"
              onClick={() =>
                setMobileToolbarPanel((current) => (current === 'annotate' ? null : 'annotate'))
              }
              aria-label="Opções de anotação"
              aria-expanded={mobileToolbarPanel === 'annotate'}
              aria-pressed={mobileToolbarPanel === 'annotate'}
              className={mobilePanelButtonClass(mobileToolbarPanel === 'annotate')}
            >
              <IconPencil className="h-4 w-4" />
            </button>
            </div>
            <div className="hidden items-center gap-x-1.5 lg:flex lg:gap-x-2">
              <span className="h-6 w-px bg-border" aria-hidden="true" />
              {renderViewAnnotationControls()}
            </div>
          </div>
          {mobileToolbarPanel === 'zoom' && (
            <div className={mobilePanelRowClass}>{renderZoomControls()}</div>
          )}
          {mobileToolbarPanel === 'annotate' && (
            <div className={mobilePanelRowClass}>{renderViewAnnotationControls()}</div>
          )}
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
          className={`relative flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden ${viewportPadding} ${surfaceClass}`}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          {...viewportInteractionProps}
        >
          <div key={currentPage} className={`flex w-full items-center justify-center ${slideClass}`}>
            <div
              ref={contentRef}
              className="shrink-0"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px)`,
                willChange: 'transform',
              }}
            >
              <PdfPageFrame pageNumber={currentPage} {...pageFrameProps} />
            </div>
          </div>

          {!isAnnotating && !isFullscreen && !isZoomed && (
            <>
              <button
                type="button"
                onClick={goToPreviousPage}
                disabled={!canGoPrevious}
                aria-label="Página anterior"
                className="pointer-events-none absolute inset-y-0 left-0 z-10 w-1/3 disabled:cursor-default"
              />
              <button
                type="button"
                onClick={goToNextPage}
                disabled={!canGoNext}
                aria-label="Próxima página"
                className="pointer-events-none absolute inset-y-0 right-0 z-10 w-1/3 disabled:cursor-default"
              />
            </>
          )}
        </div>
      ) : (
        <div
          ref={scrollRef}
          className={`flex min-h-0 flex-1 flex-col items-center overscroll-contain ${
            isZoomed ? 'overflow-auto touch-pan-x touch-pan-y' : 'overflow-y-auto touch-pan-y'
          } ${viewportPadding} ${surfaceClass}`}
          {...viewportInteractionProps}
        >
          <div
            ref={contentRef}
            className="mx-auto w-max max-w-none space-y-2"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px)`,
              willChange: 'transform',
            }}
          >
            {pageNumbers.map((pageNumber) => (
              <PdfPageFrame key={pageNumber} pageNumber={pageNumber} {...pageFrameProps} />
            ))}
          </div>
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
