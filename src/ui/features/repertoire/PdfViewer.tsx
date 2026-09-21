import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as pdfjs from 'pdfjs-dist';
import { deliverPdfDocument, isShareCancellation } from '@/ui/features/repertoire/pdf-delivery';
import { openPdfDocument } from '@/ui/features/repertoire/pdf-load';
import type {
  AnnotationLayer,
  CreatePdfAnnotationInput,
  CreatePdfNavigationShortcutInput,
  HighlightGeometry,
  NormalizedPoint,
  PdfAnnotation,
  PdfNavigationShortcut,
  PieceFileTocEntry,
  CreatePieceFileTocEntryInput,
  UpdatePieceFileTocEntryInput,
  StrokeGeometry,
  TextFontFamily,
  TextGeometry,
  UpdatePdfAnnotationInput,
  UpdatePdfNavigationShortcutInput,
} from '@/domain/repertoire';
import {
  clampStrokeWidth,
  COVER_ANNOTATION_COLOR,
  COVER_STROKE_WIDTH,
  formatPresetColor,
  HIGHLIGHT_STROKE_WIDTH,
  LASER_DEFAULT_PRESET_ID,
  LASER_FADE_MS,
  LASER_FADE_OUT_MS,
  LASER_STROKE_WIDTH,
  PEN_STROKE_WIDTH,
  normalizeTextFontFamily,
  parsePresetColor,
  resolvePresetAppearance,
  resolvePresetStroke,
} from '@/domain/repertoire';
import { useLoadingBar } from '@/ui/app/loading-bar/useLoadingBar';
import {
  IconArrowUpDown,
  IconChevronLeft,
  IconChevronRight,
  IconMaximize,
  IconMetronome,
  IconMinimize,
  IconMoon,
  IconMusic,
  IconReturn,
  IconAlertTriangle,
  IconCheck,
  IconLoader,
  IconUndo,
  IconSun,
  IconZoomIn,
} from '@/ui/components/icons';
import {
  AnnotationCoverLayer,
  AnnotationHighlightLayer,
  AnnotationInteractionLayer,
  AnnotationLaserLayer,
  AnnotationPenLayer,
  AnnotationTextLayer,
  type AnnotationEditingFocus,
  type AnnotationInteractionMode,
  type LaserStroke,
  type VisibleLayers,
} from '@/ui/features/repertoire/AnnotationOverlay';
import { AnnotationToolOptions } from '@/ui/features/repertoire/AnnotationToolOptions';
import { AnnotationToolPicker } from '@/ui/features/repertoire/AnnotationToolPicker';
import {
  AnnotationLayerVisibilityDropdown,
  type LayerVisibilityOption,
} from '@/ui/features/repertoire/AnnotationLayerVisibilityDropdown';
import {
  isDraftAnnotationId,
  toNormalizedCoords,
} from '@/ui/features/repertoire/annotation-coordinates';
import type { CoverDrawMode, HighlightStrokeMode } from '@/ui/features/repertoire/highlight-brush';
import { NavigationShortcutOverlay } from '@/ui/features/repertoire/NavigationShortcutOverlay';
import { TocEntryOverlay } from '@/ui/features/repertoire/TocEntryOverlay';
import {
  PdfNavigationShortcutEditor,
  type ShortcutPickRequest,
  type ShortcutPickResult,
} from '@/ui/features/repertoire/PdfNavigationShortcutEditor';
import {
  PieceFileTocEditor,
  PieceFileTocPanel,
  type TocPickResult,
} from '@/ui/features/repertoire/PieceFileTocEditor';
import {
  DEFAULT_ANNOTATION_TOOL_PREFERENCES,
  loadAnnotationToolPreferences,
  loadNavigationShortcutsVisible,
  loadPdfReaderPreferences,
  saveAnnotationToolPreferences,
  saveNavigationShortcutsVisible,
  savePdfReaderPreferences,
  type AnnotationToolPreferences,
  type PdfNavigationMode,
} from '@/ui/features/repertoire/pdf-reader-preference-storage';
import {
  isScaleZoomed,
  MIN_PDF_SCALE,
  nextDoubleTapFitMode,
} from '@/ui/features/repertoire/pdf-viewport-gestures';
import {
  getBasePageLayout,
  scalePageLayout,
  type PageLayoutSize,
} from '@/ui/features/repertoire/pdf-page-layout-cache';
import {
  getCachedPageRender,
  storeCachedPageRender,
} from '@/ui/features/repertoire/pdf-page-render-cache';
import { usePdfViewportGestures } from '@/ui/features/repertoire/usePdfViewportGestures';
import { usePdfVisiblePages } from '@/ui/features/repertoire/usePdfVisiblePages';
import { PdfViewerMetronomeBar } from '@/ui/features/repertoire/PdfViewerMetronomeBar';
import { PdfViewerPageNavBar } from '@/ui/features/repertoire/PdfViewerPageNavBar';
import {
  PdfReaderInfoModal,
  type PdfReaderPartInfo,
  type PdfReaderPieceInfo,
} from '@/ui/features/repertoire/PdfReaderInfoModal';
import {
  TextAnnotationEditor,
  type TextAnnotationEditSession,
} from '@/ui/features/repertoire/TextAnnotationEditor';

const SWIPE_THRESHOLD_PX = 48;
const SHORTCUT_TARGET_TOP_OFFSET_PX = 50;
const SHORTCUT_TARGET_PULSE_MS = 2100;
const PAGE_NAV_BAR_BOTTOM_ZONE_RATIO = 0.5;

function isInteractivePointerTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element
    && Boolean(
      target.closest(
        "button, select, input, textarea, a, [role='button'], [contenteditable='true']",
      ),
    )
  );
}

function isNextPageKey(key: string): boolean {
  return key === 'ArrowRight' || key === 'PageDown' || key === 'ArrowDown';
}

function isPrevPageKey(key: string): boolean {
  return key === 'ArrowLeft' || key === 'PageUp' || key === 'ArrowUp';
}

function scrollVerticalToPage(container: HTMLElement, pageNumber: number) {
  const pageEl = container.querySelector(
    `[data-page-number="${pageNumber}"]`,
  ) as HTMLElement | null;
  if (!pageEl || pageEl.getBoundingClientRect().height <= 0) {
    return;
  }

  const containerRect = container.getBoundingClientRect();
  const pageRect = pageEl.getBoundingClientRect();
  container.scrollTop += pageRect.top - containerRect.top;
}

function resolveScrollVisiblePage(container: HTMLElement): number {
  const pages = container.querySelectorAll('[data-page-number]');
  if (pages.length === 0) {
    return 1;
  }

  const containerRect = container.getBoundingClientRect();
  const viewportMid = containerRect.top + containerRect.height / 2;
  let visiblePage = 1;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const pageNode of pages) {
    const pageEl = pageNode as HTMLElement;
    const pageNumber = Number.parseInt(pageEl.dataset.pageNumber ?? '1', 10);
    const pageRect = pageEl.getBoundingClientRect();
    if (pageRect.height <= 0) {
      continue;
    }

    const pageMid = pageRect.top + pageRect.height / 2;
    const distance = Math.abs(pageMid - viewportMid);
    if (distance < bestDistance) {
      bestDistance = distance;
      visiblePage = pageNumber;
    }
  }

  return visiblePage;
}

export type SectionLeadOption = {
  id: string;
  name: string;
  groupName: string;
};

function formatSectionLeadLabel(lead: SectionLeadOption): string {
  return `${lead.groupName} - ${lead.name}`;
}

export type DirectedSetOption = {
  id: string;
  label: string;
  canEdit: boolean;
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
  onTitleClick?: () => void;
};

export function PdfViewerPlaylistNav({
  playlist,
  onPrevious,
  onNext,
  onTitleClick,
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
        {onTitleClick ? (
          <button
            type="button"
            onClick={onTitleClick}
            className="max-w-full truncate text-sm font-medium text-text underline-offset-2 hover:underline"
          >
            {playlist.currentIndex + 1} / {playlist.totalItems} — {playlist.currentItemLabel}
          </button>
        ) : (
          <p className="truncate text-sm font-medium text-text">
            {playlist.currentIndex + 1} / {playlist.totalItems} — {playlist.currentItemLabel}
          </p>
        )}
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
  directedSetOptions?: DirectedSetOption[];
  canEditDirectedLayer?: boolean;
  directedSetSelectRequest?: { id: string; nonce: number } | null;
  onManageDirectedSet?: (context?: { activeDirectedSetId?: string | null }) => void;
  playlist?: PdfViewerPlaylistContext;
  initialPage?: number;
  entryDirection?: 'next' | 'prev';
  preloadedPdf?: pdfjs.PDFDocumentProxy | null;
  allowDownload?: boolean;
  audioPicker?: {
    visible: boolean;
    onOpenPicker: () => void;
  };
  inlineAudioBar?: ReactNode;
  onAnnotationCreate: (
    input: Omit<CreatePdfAnnotationInput, 'pieceFileId'>,
  ) => Promise<PdfAnnotation | null>;
  onAnnotationUpdate: (
    annotationId: string,
    input: UpdatePdfAnnotationInput,
  ) => Promise<PdfAnnotation | null>;
  onAnnotationDelete: (annotationId: string) => Promise<void>;
  navigationShortcuts?: PdfNavigationShortcut[];
  canManageNavigationShortcuts?: boolean;
  onNavigationShortcutCreate?: (
    input: Omit<CreatePdfNavigationShortcutInput, 'pieceFileId'>,
  ) => Promise<PdfNavigationShortcut | null>;
  onNavigationShortcutUpdate?: (
    id: string,
    input: UpdatePdfNavigationShortcutInput,
  ) => Promise<PdfNavigationShortcut | null>;
  onNavigationShortcutDelete?: (id: string) => Promise<void>;
  onNavigationShortcutReorder?: (orderedIds: string[]) => Promise<void>;
  tocEntries?: PieceFileTocEntry[];
  canManageToc?: boolean;
  onTocEntryCreate?: (
    input: Omit<CreatePieceFileTocEntryInput, 'pieceFileId'>,
  ) => Promise<PieceFileTocEntry | null>;
  onTocEntryUpdate?: (
    id: string,
    input: UpdatePieceFileTocEntryInput,
  ) => Promise<PieceFileTocEntry | null>;
  onTocEntryDelete?: (id: string) => Promise<void>;
  onTocEntryReorder?: (orderedIds: string[]) => Promise<void>;
  readerInfo?: {
    open: boolean;
    onClose: () => void;
    piece: PdfReaderPieceInfo;
    part: PdfReaderPartInfo;
    downloadUrl?: string | null;
    downloadName?: string;
  };
};

type PdfPageFrameProps = {
  pdf: pdfjs.PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  layoutSize: PageLayoutSize;
  inverted: boolean;
  annotations: PdfAnnotation[];
  interactionMode: AnnotationInteractionMode;
  visibleLayers: VisibleLayers;
  editingFocus: AnnotationEditingFocus | null;
  penColor: string;
  highlightColor: string;
  penStrokeWidth: number;
  highlightStrokeWidth: number;
  highlightStrokeMode: HighlightStrokeMode;
  coverStrokeWidth: number;
  coverDrawMode: CoverDrawMode;
  laserStrokes: LaserStroke[];
  laserColor: string;
  laserStrokeWidth: number;
  readOnly: boolean;
  canEraseAnnotation: (annotation: PdfAnnotation) => boolean;
  onStrokeComplete: (pageNumber: number, geometry: StrokeGeometry) => void;
  onHighlightComplete: (pageNumber: number, geometry: StrokeGeometry) => void;
  onHighlightRectComplete: (pageNumber: number, geometry: HighlightGeometry) => void;
  onCoverComplete: (pageNumber: number, geometry: StrokeGeometry) => void;
  onCoverRectComplete: (pageNumber: number, geometry: HighlightGeometry) => void;
  onLaserStrokeComplete: (pageNumber: number, geometry: StrokeGeometry) => void;
  onEraseAnnotation: (annotationId: string) => void;
  onTextPlace: (pageNumber: number, point: NormalizedPoint) => void;
  onTextSelect: (annotation: PdfAnnotation) => void;
  onTextMove: (annotationId: string, point: NormalizedPoint) => void;
  onTextDragComplete: (annotationId: string) => void;
  textEditSession: TextAnnotationEditSession | null;
  onTextEditCommit: (session: TextAnnotationEditSession) => void;
  onTextEditCancel: () => void;
  onTextEditDelete?: () => void;
  onTextEditorStylePreferenceChange: (prefs: {
    textPresetId: string;
    textFontSize: number;
    textFontFamily: TextFontFamily;
  }) => void;
  gesturesActive: boolean;
  navigationShortcuts: PdfNavigationShortcut[];
  onNavigationShortcutPress: (shortcut: PdfNavigationShortcut) => void;
  navigationShortcutsVisible: boolean;
  pulsingShortcutId: string | null;
  shortcutPulseToken: number;
  tocEntries: PieceFileTocEntry[];
  showTocOverlay: boolean;
  onTocEntryPress?: (entry: PieceFileTocEntry) => void;
  shortcutPickRequest: ShortcutPickRequest;
  tocPickActive: boolean;
  onShortcutPageTap: (pageNumber: number, point: NormalizedPoint) => void;
};

function PdfPageFrameComponent({
  pdf,
  pageNumber,
  scale,
  layoutSize,
  inverted,
  annotations,
  interactionMode,
  visibleLayers,
  editingFocus,
  penColor,
  highlightColor,
  penStrokeWidth,
  highlightStrokeWidth,
  highlightStrokeMode,
  coverStrokeWidth,
  coverDrawMode,
  laserStrokes,
  laserColor,
  laserStrokeWidth,
  readOnly,
  canEraseAnnotation,
  onStrokeComplete,
  onHighlightComplete,
  onHighlightRectComplete,
  onCoverComplete,
  onCoverRectComplete,
  onLaserStrokeComplete,
  onEraseAnnotation,
  onTextPlace,
  onTextSelect,
  onTextMove,
  onTextDragComplete,
  textEditSession,
  onTextEditCommit,
  onTextEditCancel,
  onTextEditDelete,
  onTextEditorStylePreferenceChange,
  gesturesActive,
  navigationShortcuts,
  onNavigationShortcutPress,
  navigationShortcutsVisible,
  pulsingShortcutId,
  shortcutPulseToken,
  tocEntries,
  showTocOverlay,
  onTocEntryPress,
  shortcutPickRequest,
  tocPickActive,
  onShortcutPageTap,
}: PdfPageFrameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [draftStroke, setDraftStroke] = useState<NormalizedPoint[] | null>(null);
  const [draftRect, setDraftRect] = useState<HighlightGeometry | null>(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask: pdfjs.RenderTask | null = null;
    const canvas = canvasRef.current;
    if (!canvas) {
      return () => {
        cancelled = true;
      };
    }

    const cached = getCachedPageRender(pdf, pageNumber, scale);
    if (cached) {
      canvas.width = cached.width;
      canvas.height = cached.height;
      const context = canvas.getContext('2d');
      context?.drawImage(cached, 0, 0);
      return () => {
        cancelled = true;
      };
    }

    canvas.width = layoutSize.width;
    canvas.height = layoutSize.height;

    pdf.getPage(pageNumber).then((page) => {
      if (cancelled) {
        return;
      }

      const viewport = page.getViewport({ scale });
      const activeCanvas = canvasRef.current;
      if (!activeCanvas) {
        return;
      }

      activeCanvas.width = viewport.width;
      activeCanvas.height = viewport.height;

      const context = activeCanvas.getContext('2d');
      if (!context) {
        return;
      }

      renderTask = page.render({ canvasContext: context, viewport, canvas: activeCanvas });
      return renderTask.promise.then(() => {
        if (!cancelled && canvasRef.current) {
          storeCachedPageRender(pdf, pageNumber, scale, canvasRef.current);
        }
      });
    });

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdf, pageNumber, scale, layoutSize.height, layoutSize.width]);

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

  const handleHighlightRectComplete = useCallback(
    (geometry: HighlightGeometry) => {
      onHighlightRectComplete(pageNumber, geometry);
    },
    [onHighlightRectComplete, pageNumber],
  );

  const handleCoverComplete = useCallback(
    (geometry: StrokeGeometry) => {
      onCoverComplete(pageNumber, geometry);
    },
    [onCoverComplete, pageNumber],
  );

  const handleCoverRectComplete = useCallback(
    (geometry: HighlightGeometry) => {
      onCoverRectComplete(pageNumber, geometry);
    },
    [onCoverRectComplete, pageNumber],
  );

  const handleLaserStrokeComplete = useCallback(
    (geometry: StrokeGeometry) => {
      onLaserStrokeComplete(pageNumber, geometry);
    },
    [onLaserStrokeComplete, pageNumber],
  );

  const handleTextPlace = useCallback(
    (point: NormalizedPoint) => {
      onTextPlace(pageNumber, point);
    },
    [onTextPlace, pageNumber],
  );

  const pageAspectRatio = layoutSize.width / layoutSize.height;
  const pageTextEditSession =
    textEditSession && textEditSession.pageNumber === pageNumber ? textEditSession : null;
  const textEditAnnotation =
    pageTextEditSession?.editingId != null
      ? annotations.find((annotation) => annotation.id === pageTextEditSession.editingId)
      : undefined;
  const canDeleteTextEdit =
    textEditAnnotation != null && canEraseAnnotation(textEditAnnotation);

  return (
    <div
      className="relative h-full w-full"
      style={{
        width: layoutSize.width,
        height: layoutSize.height,
      }}
    >
      <div className={`relative h-full w-full ${inverted ? 'invert' : ''}`}>
        <canvas
          ref={canvasRef}
          className={`block h-full w-full ${inverted ? 'bg-black' : 'bg-white'} ${
            inverted ? '' : 'shadow-sm'
          }`}
          style={{ width: layoutSize.width, height: layoutSize.height }}
        />
        <>
          <AnnotationPenLayer
            pageNumber={pageNumber}
            annotations={annotations}
            visibleLayers={visibleLayers}
            editingFocus={editingFocus}
            inverted={inverted}
            penColor={penColor}
            penStrokeWidth={penStrokeWidth}
            draftStroke={draftStroke}
            showDraft={interactionMode === 'pen'}
          />
          <AnnotationTextLayer
            pageNumber={pageNumber}
            annotations={annotations}
            visibleLayers={visibleLayers}
            editingFocus={editingFocus}
            inverted={inverted}
            pageAspectRatio={pageAspectRatio}
          />
          <AnnotationLaserLayer
            pageNumber={pageNumber}
            laserStrokes={laserStrokes}
            laserColor={laserColor}
            laserStrokeWidth={laserStrokeWidth}
            draftStroke={draftStroke}
            showDraft={interactionMode === 'laser'}
          />
        </>
      </div>
      <>
        <AnnotationHighlightLayer
          pageNumber={pageNumber}
          annotations={annotations}
          visibleLayers={visibleLayers}
          editingFocus={editingFocus}
          inverted={inverted}
          pageAspectRatio={pageAspectRatio}
          highlightColor={highlightColor}
          highlightStrokeWidth={highlightStrokeWidth}
          draftStroke={draftStroke}
          draftRect={draftRect}
          showDraft={interactionMode === 'highlight'}
        />
        <AnnotationCoverLayer
          pageNumber={pageNumber}
          annotations={annotations}
          visibleLayers={visibleLayers}
          editingFocus={editingFocus}
          inverted={inverted}
          pageAspectRatio={pageAspectRatio}
          coverStrokeWidth={coverStrokeWidth}
          draftStroke={draftStroke}
          draftRect={draftRect}
          showDraft={interactionMode === 'cover'}
        />
        <AnnotationInteractionLayer
          pageNumber={pageNumber}
          annotations={annotations}
          visibleLayers={visibleLayers}
          editingFocus={editingFocus}
          mode={interactionMode}
          readOnly={readOnly}
          gesturesActive={gesturesActive}
          pageAspectRatio={pageAspectRatio}
          penStrokeWidth={penStrokeWidth}
          highlightStrokeWidth={highlightStrokeWidth}
          highlightStrokeMode={highlightStrokeMode}
          coverStrokeWidth={coverStrokeWidth}
          coverDrawMode={coverDrawMode}
          laserStrokeWidth={laserStrokeWidth}
          canEraseAnnotation={canEraseAnnotation}
          onStrokeComplete={handleStrokeComplete}
          onHighlightComplete={handleHighlightComplete}
          onHighlightRectComplete={handleHighlightRectComplete}
          onCoverComplete={handleCoverComplete}
          onCoverRectComplete={handleCoverRectComplete}
          onLaserStrokeComplete={handleLaserStrokeComplete}
          onEraseAnnotation={onEraseAnnotation}
          onDraftStrokeChange={setDraftStroke}
          onDraftRectChange={setDraftRect}
          onTextPlace={handleTextPlace}
          onTextSelect={onTextSelect}
          onTextMove={onTextMove}
          onTextDragComplete={onTextDragComplete}
          textEditing={pageTextEditSession != null}
        />
      </>
      {pageTextEditSession ? (
        <TextAnnotationEditor
          session={pageTextEditSession}
          pageWidth={layoutSize.width}
          inverted={inverted}
          onCommit={onTextEditCommit}
          onCancel={onTextEditCancel}
          onDelete={canDeleteTextEdit ? onTextEditDelete : undefined}
          onStylePreferenceChange={onTextEditorStylePreferenceChange}
        />
      ) : null}
      <NavigationShortcutOverlay
        shortcuts={navigationShortcuts}
        pageNumber={pageNumber}
        onShortcutPress={onNavigationShortcutPress}
        inverted={inverted}
        disabled={shortcutPickRequest != null || tocPickActive}
        visible={navigationShortcutsVisible}
        pulsingShortcutId={pulsingShortcutId}
        pulseToken={shortcutPulseToken}
      />
      {showTocOverlay && (
        <TocEntryOverlay
          entries={tocEntries}
          pageNumber={pageNumber}
          onEntryPress={onTocEntryPress}
          inverted={inverted}
          disabled={gesturesActive || shortcutPickRequest != null || tocPickActive}
        />
      )}
      {(shortcutPickRequest != null || tocPickActive) && (
        <button
          type="button"
          className="absolute inset-0 z-30 cursor-crosshair bg-primary/5"
          aria-label="Selecionar posição na partitura"
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            onShortcutPageTap(
              pageNumber,
              toNormalizedCoords(event.clientX, event.clientY, rect),
            );
          }}
        />
      )}
    </div>
  );
}

const PdfPageFrame = memo(PdfPageFrameComponent);

type PdfPageSlotProps = Omit<PdfPageFrameProps, 'layoutSize'> & {
  shouldRender: boolean;
};

function PdfPageSlot({
  shouldRender,
  pdf,
  pageNumber,
  scale,
  inverted,
  ...frameProps
}: PdfPageSlotProps) {
  const [baseLayout, setBaseLayout] = useState<{
    pageNumber: number;
    layout: PageLayoutSize;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    void getBasePageLayout(pdf, pageNumber).then((layout) => {
      if (cancelled) {
        return;
      }
      setBaseLayout({ pageNumber, layout });
    });

    return () => {
      cancelled = true;
    };
  }, [pdf, pageNumber]);

  const layoutSize =
    baseLayout && baseLayout.pageNumber === pageNumber
      ? scalePageLayout(baseLayout.layout, scale)
      : null;

  return (
    <div
      className="relative mx-auto shrink-0"
      data-page-number={pageNumber}
      style={{
        width: layoutSize?.width,
        height: layoutSize?.height,
        minHeight: layoutSize?.height,
      }}
    >
      {shouldRender && layoutSize ? (
        <PdfPageFrame
          pdf={pdf}
          pageNumber={pageNumber}
          scale={scale}
          layoutSize={layoutSize}
          inverted={inverted}
          {...frameProps}
        />
      ) : layoutSize ? (
        <div
          className={`h-full w-full ${inverted ? 'bg-black/80' : 'bg-white/80'} shadow-sm`}
          aria-hidden
        />
      ) : null}
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
    annotationSetId: input.annotationSetId ?? null,
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
    annotationSetId: draft.annotationSetId,
  };
}

const AUTO_SAVE_DEBOUNCE_MS = 500;
const SAVED_INDICATOR_MS = 2000;

type AnnotationSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

type SessionUndoEntry =
  | { kind: 'create'; annotationId: string }
  | { kind: 'delete'; annotation: PdfAnnotation; wasDraft: boolean }
  | { kind: 'update'; before: PdfAnnotation; after: PdfAnnotation };

export function PdfViewer({
  url,
  userId,
  annotations,
  sectionLeadOptions,
  directedSetOptions = [],
  canEditDirectedLayer = false,
  directedSetSelectRequest = null,
  onManageDirectedSet,
  playlist,
  initialPage = 1,
  entryDirection,
  preloadedPdf = null,
  allowDownload = true,
  audioPicker,
  inlineAudioBar,
  onAnnotationCreate,
  onAnnotationUpdate,
  onAnnotationDelete,
  navigationShortcuts = [],
  canManageNavigationShortcuts = false,
  onNavigationShortcutCreate,
  onNavigationShortcutUpdate,
  onNavigationShortcutDelete,
  onNavigationShortcutReorder,
  tocEntries = [],
  canManageToc = false,
  onTocEntryCreate,
  onTocEntryUpdate,
  onTocEntryDelete,
  onTocEntryReorder,
  readerInfo,
}: PdfViewerProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const tapStartRef = useRef<{ x: number; y: number } | null>(null);
  const loadedDocumentRef = useRef<{
    pdf: pdfjs.PDFDocumentProxy;
    initialPage: number;
    entryDirection?: 'next' | 'prev';
  } | null>(null);

  const leadOptions = useMemo(
    () => dedupeSectionLeadOptions(sectionLeadOptions),
    [sectionLeadOptions],
  );
  const canEditSectionLayer = leadOptions.length > 0;

  const [pdf, setPdf] = useState<pdfjs.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const currentPageRef = useRef(currentPage);
  currentPageRef.current = currentPage;
  const verticalProgrammaticScrollRef = useRef(false);
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
  const [navigationShortcutsVisible, setNavigationShortcutsVisible] = useState(
    () => (userId ? loadNavigationShortcutsVisible(userId) : true),
  );
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'next' | 'prev'>('next');
  const [horizontalSlideKey, setHorizontalSlideKey] = useState(0);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [saveStatus, setSaveStatus] = useState<AnnotationSaveStatus>('idle');
  const [draftAnnotations, setDraftAnnotations] = useState<PdfAnnotation[]>([]);
  const [pendingDeletionIds, setPendingDeletionIds] = useState<string[]>([]);
  const [pendingUpdates, setPendingUpdates] = useState<Record<string, UpdatePdfAnnotationInput>>({});
  const [textEditSession, setTextEditSession] = useState<TextAnnotationEditSession | null>(null);
  const [sessionUndoStack, setSessionUndoStack] = useState<SessionUndoEntry[]>([]);
  const autoSaveTimeoutRef = useRef<number | null>(null);
  const savedIndicatorTimeoutRef = useRef<number | null>(null);
  const isSavingRef = useRef(false);
  const saveQueuedRef = useRef(false);
  const inFlightSaveDraftIdsRef = useRef<Set<string>>(new Set());
  const undoneDuringSaveDraftIdsRef = useRef<Set<string>>(new Set());
  const hasAnnotatedRef = useRef(false);
  const isAnnotatingRef = useRef(isAnnotating);
  isAnnotatingRef.current = isAnnotating;
  const draftAnnotationsRef = useRef(draftAnnotations);
  draftAnnotationsRef.current = draftAnnotations;
  const pendingDeletionIdsRef = useRef(pendingDeletionIds);
  pendingDeletionIdsRef.current = pendingDeletionIds;
  const pendingUpdatesRef = useRef(pendingUpdates);
  pendingUpdatesRef.current = pendingUpdates;
  const persistDraftChangesRef = useRef<() => Promise<boolean>>(async () => true);
  const [laserStrokes, setLaserStrokes] = useState<LaserStroke[]>([]);
  const laserTimeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const [interactionMode, setInteractionMode] = useState<AnnotationInteractionMode>('read');
  const [annotationToolPrefs, setAnnotationToolPrefs] = useState<AnnotationToolPreferences>(
    () =>
      userId
        ? loadAnnotationToolPreferences(userId)
        : DEFAULT_ANNOTATION_TOOL_PREFERENCES,
  );
  const [activeLayer, setActiveLayer] = useState<AnnotationLayer>('personal');
  const [activeSectionId, setActiveSectionId] = useState<string | null>(
    leadOptions[0]?.id ?? null,
  );
  const canShowDirectedLayer = canEditDirectedLayer || directedSetOptions.length > 0;
  const editableDirectedSets = useMemo(
    () => directedSetOptions.filter((option) => option.canEdit),
    [directedSetOptions],
  );

  const [activeDirectedSetId, setActiveDirectedSetId] = useState<string | null>(
    editableDirectedSets[0]?.id ?? directedSetOptions[0]?.id ?? null,
  );
  const [visibleLayers, setVisibleLayers] = useState<VisibleLayers>({
    personal: true,
    section: true,
    directed: Object.fromEntries(directedSetOptions.map((option) => [option.id, true])),
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenControlsVisible, setFullscreenControlsVisible] = useState(false);
  const [mobileToolbarPanel, setMobileToolbarPanel] = useState<'zoom' | null>(null);
  const [metronomeOpen, setMetronomeOpen] = useState(false);
  const [shortcutEditorOpen, setShortcutEditorOpen] = useState(false);
  const [shortcutPickRequest, setShortcutPickRequest] = useState<ShortcutPickRequest>(null);
  const [shortcutPickResult, setShortcutPickResult] = useState<ShortcutPickResult | null>(null);
  const [pulsingShortcutId, setPulsingShortcutId] = useState<string | null>(null);
  const [shortcutPulseToken, setShortcutPulseToken] = useState(0);
  const shortcutPulseTimeoutRef = useRef<number | null>(null);
  const [tocPanelOpen, setTocPanelOpen] = useState(false);
  const [tocEditorOpen, setTocEditorOpen] = useState(false);
  const [tocPickActive, setTocPickActive] = useState(false);
  const [tocPickResult, setTocPickResult] = useState<TocPickResult | null>(null);
  const [pageNavBarVisible, setPageNavBarVisible] = useState(false);

  const sortedNavigationShortcuts = useMemo(
    () => [...navigationShortcuts].sort((a, b) => a.sortOrder - b.sortOrder),
    [navigationShortcuts],
  );

  const sortedTocEntries = useMemo(
    () => [...tocEntries].sort((a, b) => a.sortOrder - b.sortOrder),
    [tocEntries],
  );

  useEffect(() => {
    if (!userId) {
      setAnnotationToolPrefs(DEFAULT_ANNOTATION_TOOL_PREFERENCES);
      return;
    }
    setAnnotationToolPrefs(loadAnnotationToolPreferences(userId));
  }, [userId]);

  useEffect(() => {
    setVisibleLayers({
      personal: true,
      section: true,
      directed: {},
    });
  }, [url]);

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

  useEffect(() => {
    setVisibleLayers((current) => {
      const directed = { ...current.directed };
      let changed = false;
      for (const option of directedSetOptions) {
        if (directed[option.id] === undefined) {
          directed[option.id] = true;
          changed = true;
        }
      }
      return changed ? { ...current, directed } : current;
    });

    if (directedSetOptions.length === 0) {
      setActiveDirectedSetId(null);
      return;
    }

    setActiveDirectedSetId((current) => {
      if (current && directedSetOptions.some((option) => option.id === current)) {
        return current;
      }
      return editableDirectedSets[0]?.id ?? directedSetOptions[0]?.id ?? null;
    });
  }, [directedSetOptions, editableDirectedSets]);

  useEffect(() => {
    if (!directedSetSelectRequest) {
      return;
    }
    const { id } = directedSetSelectRequest;
    if (!directedSetOptions.some((option) => option.id === id)) {
      return;
    }
    setActiveDirectedSetId(id);
    setActiveLayer('directed');
  }, [directedSetSelectRequest, directedSetOptions]);

  const layerMenuOptions = useMemo((): LayerVisibilityOption[] => {
    const options: LayerVisibilityOption[] = [];

    if (userId) {
      options.push({
        id: 'personal',
        label: 'Pessoal',
        visible: visibleLayers.personal,
        canEdit: true,
        editValue: 'personal',
      });
    }

    if (canEditSectionLayer) {
      for (const lead of leadOptions) {
        options.push({
          id: 'section',
          label: formatSectionLeadLabel(lead),
          visible: visibleLayers.section,
          canEdit: true,
          editValue: `section:${lead.id}`,
        });
      }
    }

    if (canShowDirectedLayer) {
      for (const option of directedSetOptions) {
        options.push({
          id: option.id,
          label: option.label,
          visible: visibleLayers.directed[option.id] ?? true,
          canEdit: option.canEdit,
          editValue: option.canEdit ? `directed:${option.id}` : undefined,
        });
      }
    }

    return options;
  }, [
    userId,
    canEditSectionLayer,
    canShowDirectedLayer,
    leadOptions,
    directedSetOptions,
    visibleLayers,
  ]);

  const toggleLayerVisibility = useCallback((id: string) => {
    if (id === 'personal') {
      setVisibleLayers((current) => ({ ...current, personal: !current.personal }));
      return;
    }

    if (id === 'section') {
      setVisibleLayers((current) => ({ ...current, section: !current.section }));
      return;
    }

    setVisibleLayers((current) => ({
      ...current,
      directed: {
        ...current.directed,
        [id]: !(current.directed[id] ?? true),
      },
    }));
  }, []);

  const editLayerOptions = useMemo(() => {
    const options: Array<{ value: string; label: string }> = [
      { value: 'personal', label: 'Pessoal' },
    ];

    if (canEditSectionLayer) {
      for (const lead of leadOptions) {
        options.push({
          value: `section:${lead.id}`,
          label: formatSectionLeadLabel(lead),
        });
      }
    }

    if (canEditDirectedLayer) {
      for (const set of editableDirectedSets) {
        options.push({
          value: `directed:${set.id}`,
          label: set.label,
        });
      }
    }

    return options;
  }, [canEditSectionLayer, canEditDirectedLayer, leadOptions, editableDirectedSets]);

  const activeEditLayerValue = useMemo(() => {
    if (activeLayer === 'section' && activeSectionId) {
      return `section:${activeSectionId}`;
    }
    if (activeLayer === 'directed' && activeDirectedSetId) {
      return `directed:${activeDirectedSetId}`;
    }
    if (editLayerOptions.some((option) => option.value === 'personal')) {
      return 'personal';
    }
    return editLayerOptions[0]?.value ?? 'personal';
  }, [activeLayer, activeSectionId, activeDirectedSetId, editLayerOptions]);

  const handleEditLayerChange = useCallback((value: string) => {
    if (value === 'personal') {
      setActiveLayer('personal');
      return;
    }

    if (value.startsWith('section:')) {
      setActiveLayer('section');
      setActiveSectionId(value.slice('section:'.length));
      return;
    }

    if (value.startsWith('directed:')) {
      setActiveLayer('directed');
      setActiveDirectedSetId(value.slice('directed:'.length));
    }
  }, []);

  useEffect(() => {
    if (!isAnnotating) {
      return;
    }

    if (editLayerOptions.some((option) => option.value === activeEditLayerValue)) {
      return;
    }

    const fallback = editLayerOptions[0]?.value;
    if (fallback) {
      handleEditLayerChange(fallback);
    }
  }, [isAnnotating, editLayerOptions, activeEditLayerValue, handleEditLayerChange]);

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
    setNavigationShortcutsVisible(preferences.navigationShortcutsVisible !== false);
  }, [userId]);

  const setNavigationShortcutsVisiblePreference = useCallback(
    (visible: boolean) => {
      setNavigationShortcutsVisible(visible);
      if (userId) {
        saveNavigationShortcutsVisible(userId, visible);
      }
    },
    [userId],
  );

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
      } else {
        setPageNavBarVisible(false);
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

  const toggleMetronome = useCallback(() => {
    setMetronomeOpen((current) => {
      const next = !current;
      if (next) {
        setMobileToolbarPanel(null);
      }
      return next;
    });
  }, []);

  const closeMetronome = useCallback(() => {
    setMetronomeOpen(false);
  }, []);

  const handlePrint = useCallback(() => {
    if (!pdf || !allowDownload) {
      return;
    }
    void deliverPdfDocument(pdf, readerInfo?.downloadName).catch((error) => {
      if (isShareCancellation(error)) {
        return;
      }
    });
  }, [pdf, allowDownload, readerInfo?.downloadName]);

  const clearLaserStrokes = useCallback(() => {
    laserTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    laserTimeoutsRef.current.clear();
    setLaserStrokes([]);
  }, []);

  const scheduleLaserTimeout = useCallback((callback: () => void, delayMs: number) => {
    const timeoutId = setTimeout(() => {
      laserTimeoutsRef.current.delete(timeoutId);
      callback();
    }, delayMs);
    laserTimeoutsRef.current.add(timeoutId);
  }, []);

  useEffect(
    () => () => {
      laserTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    },
    [],
  );

  const enterAnnotationMode = useCallback(() => {
    setMetronomeOpen(false);
    setDraftAnnotations([]);
    setPendingDeletionIds([]);
    clearLaserStrokes();
    setInteractionMode('pen');
    if (userId) {
      setAnnotationToolPrefs(loadAnnotationToolPreferences(userId));
    }
    hasAnnotatedRef.current = false;
    setSaveStatus('idle');
    setSessionUndoStack([]);
    setIsAnnotating(true);
    setMobileToolbarPanel(null);
    setPageNavBarVisible(false);
  }, [clearLaserStrokes, userId]);

  const handleLayerEdit = useCallback(
    (editValue: string) => {
      handleEditLayerChange(editValue);
      if (!isAnnotatingRef.current) {
        enterAnnotationMode();
      }
    },
    [handleEditLayerChange, enterAnnotationMode],
  );

  const handleCreateLayer = useCallback(() => {
    if (!onManageDirectedSet) {
      return;
    }
    onManageDirectedSet({
      activeDirectedSetId: activeEditLayerValue.startsWith('directed:')
        ? activeEditLayerValue.slice('directed:'.length)
        : null,
    });
  }, [onManageDirectedSet, activeEditLayerValue]);

  const exitAnnotationMode = useCallback(async () => {
    if (autoSaveTimeoutRef.current !== null) {
      window.clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }
    if (
      draftAnnotationsRef.current.length > 0 ||
      pendingDeletionIdsRef.current.length > 0
    ) {
      await persistDraftChangesRef.current();
    }
    if (savedIndicatorTimeoutRef.current !== null) {
      window.clearTimeout(savedIndicatorTimeoutRef.current);
      savedIndicatorTimeoutRef.current = null;
    }
    isSavingRef.current = false;
    saveQueuedRef.current = false;
    hasAnnotatedRef.current = false;
    setSaveStatus('idle');
    setSessionUndoStack([]);
    setIsAnnotating(false);
    setInteractionMode('read');
    setDraftAnnotations([]);
    setPendingDeletionIds([]);
    clearLaserStrokes();
    setMobileToolbarPanel(null);
  }, [clearLaserStrokes]);

  useEffect(() => {
    let cancelled = false;
    const resolvedInitialPage = Math.max(1, initialPage);

    if (preloadedPdf) {
      const previous = loadedDocumentRef.current;
      if (
        previous?.pdf === preloadedPdf &&
        previous.initialPage === resolvedInitialPage &&
        previous.entryDirection === entryDirection
      ) {
        return;
      }

      loadedDocumentRef.current = {
        pdf: preloadedPdf,
        initialPage: resolvedInitialPage,
        entryDirection,
      };
      setError(null);
      setPdf(preloadedPdf);
      setNumPages(preloadedPdf.numPages);
      setCurrentPage(Math.min(resolvedInitialPage, preloadedPdf.numPages));
      setShouldAnimate(Boolean(entryDirection));
      setSlideDirection(entryDirection ?? 'next');
      setLoading(false);
      return;
    }

    loadedDocumentRef.current = null;

    const loadingTask = openPdfDocument({ url });

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

  const { pan, isGesturing, isZoomed, displayScale, visualScaleRatio, resetPan } =
    usePdfViewportGestures({
      viewportRef: navigation === 'horizontal' ? viewportRef : scrollRef,
      contentRef,
      renderScale: scale,
      setRenderScale: setScale,
      fitScale,
      navigation,
      isAnnotating,
      enabled: Boolean(pdf) && numPages > 0,
      onDoubleTap: () => doubleTapFitRef.current(),
      onSingleTap: (point) => viewportSingleTapRef.current(point),
    });

  const visiblePages = usePdfVisiblePages(
    scrollRef,
    numPages,
    currentPage,
    navigation === 'vertical' && Boolean(pdf) && numPages > 0,
  );

  const [currentPageBaseLayout, setCurrentPageBaseLayout] = useState<PageLayoutSize | null>(null);

  useEffect(() => {
    if (!pdf) {
      setCurrentPageBaseLayout(null);
      return;
    }

    let cancelled = false;
    void getBasePageLayout(pdf, currentPage).then((layout) => {
      if (!cancelled) {
        setCurrentPageBaseLayout(layout);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [pdf, currentPage]);

  const pageRenderWidth = currentPageBaseLayout
    ? currentPageBaseLayout.width * displayScale
    : 800;

  const contentTransformStyle = useMemo(
    () => ({
      transform:
        visualScaleRatio !== 1
          ? `translate(${pan.x}px, ${pan.y}px) scale(${visualScaleRatio})`
          : `translate(${pan.x}px, ${pan.y}px)`,
      transformOrigin: navigation === 'horizontal' ? 'center center' : 'top left',
      willChange: 'transform' as const,
    }),
    [navigation, pan.x, pan.y, visualScaleRatio],
  );

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

      const page = await pdf.getPage(
        navigation === 'horizontal' ? currentPageRef.current : 1,
      );
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
    [pdf, getViewportElement, navigation],
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

    let timeoutId: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (navigation === 'horizontal') {
          void fitToPage();
        } else {
          void fitToWidth();
        }
      }, 150);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
    };
  }, [pdf, numPages, navigation, fitToPage, fitToWidth]);

  useEffect(() => {
    resetPan();
  }, [navigation, resetPan]);

  useEffect(() => {
    if (navigation === 'horizontal') {
      resetPan();
    }
  }, [currentPage, navigation, resetPan]);

  const scrollVerticalToPageProgrammatically = useCallback((pageNumber: number) => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    verticalProgrammaticScrollRef.current = true;
    scrollVerticalToPage(container, pageNumber);
    window.setTimeout(() => {
      verticalProgrammaticScrollRef.current = false;
    }, 150);
  }, []);

  useEffect(() => {
    if (navigation !== 'vertical' || !pdf || numPages === 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      scrollVerticalToPageProgrammatically(currentPageRef.current);
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [navigation, pdf, numPages, url, scrollVerticalToPageProgrammatically]);

  useEffect(() => {
    if (navigation !== 'vertical' || !pdf || numPages === 0) {
      return;
    }

    const container = scrollRef.current;
    if (!container) {
      return;
    }

    let frameId = 0;
    const onScroll = () => {
      if (verticalProgrammaticScrollRef.current || frameId !== 0) {
        return;
      }

      frameId = requestAnimationFrame(() => {
        frameId = 0;
        if (verticalProgrammaticScrollRef.current) {
          return;
        }

        const nextPage = resolveScrollVisiblePage(container);
        setCurrentPage((page) => {
          if (page === nextPage) {
            return page;
          }

          currentPageRef.current = nextPage;
          return nextPage;
        });
      });
    };

    container.addEventListener('scroll', onScroll, { passive: true });

    const initialSyncFrameId = requestAnimationFrame(() => {
      if (verticalProgrammaticScrollRef.current) {
        return;
      }

      const nextPage = resolveScrollVisiblePage(container);
      setCurrentPage((page) => {
        if (page === nextPage) {
          return page;
        }

        currentPageRef.current = nextPage;
        return nextPage;
      });
    });

    return () => {
      container.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(initialSyncFrameId);
      if (frameId !== 0) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [navigation, pdf, numPages]);

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
        const targetPage = currentPage - 1;
        if (navigation === 'horizontal') {
          setShouldAnimate(true);
          setSlideDirection('prev');
          setHorizontalSlideKey((key) => key + 1);
          currentPageRef.current = targetPage;
          setCurrentPage(targetPage);
        } else {
          setShouldAnimate(false);
          currentPageRef.current = targetPage;
          setCurrentPage(targetPage);
          requestAnimationFrame(() => {
            scrollVerticalToPageProgrammatically(targetPage);
          });
        }
        return;
      }

      if (currentPage >= numPages) {
        return;
      }
      const targetPage = currentPage + 1;
      if (navigation === 'horizontal') {
        setShouldAnimate(true);
        setSlideDirection('next');
        setHorizontalSlideKey((key) => key + 1);
        currentPageRef.current = targetPage;
        setCurrentPage(targetPage);
      } else {
        setShouldAnimate(false);
        currentPageRef.current = targetPage;
        setCurrentPage(targetPage);
        requestAnimationFrame(() => {
          scrollVerticalToPageProgrammatically(targetPage);
        });
      }
    },
    [currentPage, isAnnotating, navigation, numPages, scrollVerticalToPageProgrammatically],
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

  const goToPage = useCallback(
    (targetPage: number) => {
      if (isAnnotating) {
        return;
      }

      const page = Math.min(Math.max(1, targetPage), numPages);
      if (page === currentPage) {
        return;
      }

      if (navigation === 'horizontal') {
        setShouldAnimate(true);
        setSlideDirection(page > currentPage ? 'next' : 'prev');
        setHorizontalSlideKey((key) => key + 1);
        currentPageRef.current = page;
        setCurrentPage(page);
        resetPan();
        return;
      }

      setShouldAnimate(false);
      currentPageRef.current = page;
      setCurrentPage(page);
      requestAnimationFrame(() => {
        scrollVerticalToPageProgrammatically(page);
      });
    },
    [currentPage, isAnnotating, navigation, numPages, resetPan, scrollVerticalToPageProgrammatically],
  );

  const goToFirstPage = useCallback(() => {
    goToPage(1);
  }, [goToPage]);

  const closePageNavBar = useCallback(() => {
    setPageNavBarVisible(false);
  }, []);

  const openTocPanel = useCallback(() => {
    setTocPanelOpen(true);
    closePageNavBar();
  }, [closePageNavBar]);

  const showTocButton = sortedTocEntries.length > 0 || canManageToc;

  const startShortcutTargetPulse = useCallback((shortcutId: string) => {
    setPulsingShortcutId(shortcutId);
    setShortcutPulseToken((token) => token + 1);
    if (shortcutPulseTimeoutRef.current != null) {
      window.clearTimeout(shortcutPulseTimeoutRef.current);
    }
    shortcutPulseTimeoutRef.current = window.setTimeout(() => {
      setPulsingShortcutId(null);
      shortcutPulseTimeoutRef.current = null;
    }, SHORTCUT_TARGET_PULSE_MS);
  }, []);

  useEffect(
    () => () => {
      if (shortcutPulseTimeoutRef.current != null) {
        window.clearTimeout(shortcutPulseTimeoutRef.current);
      }
    },
    [],
  );

  const goToShortcut = useCallback(
    (shortcut: PdfNavigationShortcut) => {
      if (isAnnotating || shortcutPickRequest != null) {
        return;
      }

      const targetPage = Math.min(Math.max(1, shortcut.targetPageNumber), numPages);
      setShouldAnimate(false);
      currentPageRef.current = targetPage;
      startShortcutTargetPulse(shortcut.id);

      if (navigation === 'horizontal') {
        setCurrentPage(targetPage);
        resetPan();
        return;
      }

      setCurrentPage(targetPage);
      resetPan();
      requestAnimationFrame(() => {
        const container = scrollRef.current;
        const pageEl = container?.querySelector(
          `[data-page-number="${targetPage}"]`,
        ) as HTMLElement | null;
        if (!container || !pageEl) {
          return;
        }
        const offsetY =
          shortcut.targetY != null ? pageEl.offsetHeight * shortcut.targetY : pageEl.offsetHeight * 0.5;
        const offsetX =
          shortcut.targetX != null ? pageEl.offsetWidth * shortcut.targetX : pageEl.offsetWidth * 0.5;
        container.scrollTop = Math.max(0, pageEl.offsetTop + offsetY - SHORTCUT_TARGET_TOP_OFFSET_PX);
        container.scrollLeft = Math.max(
          0,
          pageEl.offsetLeft + offsetX - container.clientWidth / 2,
        );
      });
    },
    [
      isAnnotating,
      shortcutPickRequest,
      numPages,
      navigation,
      resetPan,
      startShortcutTargetPulse,
    ],
  );

  const goToTocEntry = useCallback(
    (entry: PieceFileTocEntry) => {
      if (isAnnotating || shortcutPickRequest != null || tocPickActive) {
        return;
      }

      const targetPage = Math.min(Math.max(1, entry.targetPageNumber), numPages);
      setShouldAnimate(false);
      currentPageRef.current = targetPage;
      setCurrentPage(targetPage);
      resetPan();

      if (navigation !== 'horizontal') {
        requestAnimationFrame(() => {
          const container = scrollRef.current;
          const pageEl = container?.querySelector(
            `[data-page-number="${targetPage}"]`,
          ) as HTMLElement | null;
          if (!container || !pageEl) {
            return;
          }
          const offsetY =
            entry.targetY != null ? pageEl.offsetHeight * entry.targetY : pageEl.offsetHeight * 0.5;
          const offsetX =
            entry.targetX != null ? pageEl.offsetWidth * entry.targetX : pageEl.offsetWidth * 0.5;
          container.scrollTop = pageEl.offsetTop + offsetY - container.clientHeight / 2;
          container.scrollLeft = Math.max(
            0,
            pageEl.offsetLeft + offsetX - container.clientWidth / 2,
          );
        });
      }
    },
    [
      isAnnotating,
      shortcutPickRequest,
      tocPickActive,
      numPages,
      navigation,
      resetPan,
    ],
  );

  const handleShortcutPageTap = useCallback(
    (pageNumber: number, point: NormalizedPoint) => {
      if (shortcutPickRequest) {
        setShortcutPickResult({
          pageNumber,
          y: point.y,
          x: point.x,
        });
        return;
      }

      if (tocPickActive) {
        setTocPickResult({
          pageNumber,
          y: point.y,
          x: point.x,
        });
      }
    },
    [shortcutPickRequest, tocPickActive],
  );

  const handleViewportSingleTap = useCallback(
    (point: { x: number; y: number }) => {
      if (isAnnotating || shortcutPickRequest != null || tocPickActive) {
        return;
      }

      const hit = document.elementFromPoint(point.x, point.y);
      if (isInteractivePointerTarget(hit)) {
        return;
      }

      const viewport = getViewportElement();
      if (!viewport) {
        return;
      }

      const rect = viewport.getBoundingClientRect();
      const relativeY = point.y - rect.top;
      const bottomZoneTop = viewport.clientHeight * (1 - PAGE_NAV_BAR_BOTTOM_ZONE_RATIO);
      const inBottomHalf = relativeY >= bottomZoneTop;

      if (!isZoomed && inBottomHalf) {
        setPageNavBarVisible((current) => !current);
        return;
      }

      if (isFullscreen) {
        setFullscreenControlsVisible((current) => !current);
      }
    },
    [
      getViewportElement,
      isAnnotating,
      isFullscreen,
      isZoomed,
      navigation,
      shortcutPickRequest,
      tocPickActive,
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
    if (isAnnotating) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (shortcutPickRequest != null || tocPickActive) {
        if (isNextPageKey(event.key)) {
          event.preventDefault();
          navigateHorizontal('next');
        } else if (isPrevPageKey(event.key)) {
          event.preventDefault();
          navigateHorizontal('prev');
        } else if (event.key === 'Escape') {
          event.preventDefault();
          setShortcutPickRequest(null);
          setTocPickActive(false);
        }
        return;
      }

      if (allowDownload && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        handlePrint();
        return;
      }

      const shortcutIndex = Number.parseInt(event.key, 10);
      if (
        !event.shiftKey
        && !event.ctrlKey
        && !event.metaKey
        && !event.altKey
        && shortcutIndex >= 1
        && shortcutIndex <= 9
      ) {
        const shortcut = sortedNavigationShortcuts[shortcutIndex - 1];
        if (shortcut) {
          event.preventDefault();
          goToShortcut(shortcut);
          return;
        }
      }

      if (playlist && event.shiftKey) {
        if (isNextPageKey(event.key)) {
          event.preventDefault();
          goToNextItem();
          return;
        }
        if (isPrevPageKey(event.key)) {
          event.preventDefault();
          goToPreviousItem();
          return;
        }
      }

      if (isNextPageKey(event.key)) {
        event.preventDefault();
        goToNextPage();
      } else if (isPrevPageKey(event.key)) {
        event.preventDefault();
        goToPreviousPage();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    isAnnotating,
    shortcutPickRequest,
    tocPickActive,
    navigateHorizontal,
    goToNextPage,
    goToPreviousPage,
    goToShortcut,
    sortedNavigationShortcuts,
    playlist,
    goToNextItem,
    goToPreviousItem,
    handlePrint,
    allowDownload,
  ]);

  const handleTouchStart = useCallback(
    (event: React.TouchEvent) => {
      if (isFullscreen || isZoomed || isGesturing || event.touches.length !== 1) {
        return;
      }
      if (isInteractivePointerTarget(event.target)) {
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
      if (isInteractivePointerTarget(event.target)) {
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

  const persistAnnotationToolPrefs = useCallback(
    (patch: Partial<AnnotationToolPreferences>) => {
      if (userId) {
        saveAnnotationToolPreferences(userId, patch);
        setAnnotationToolPrefs(loadAnnotationToolPreferences(userId));
        return;
      }
      setAnnotationToolPrefs((current) => ({ ...current, ...patch }));
    },
    [userId],
  );

  const handlePenPresetChange = useCallback(
    (penPresetId: string) => {
      persistAnnotationToolPrefs({ penPresetId });
    },
    [persistAnnotationToolPrefs],
  );

  const handlePenStrokeWidthChange = useCallback(
    (penStrokeWidth: number) => {
      persistAnnotationToolPrefs({
        penStrokeWidth: clampStrokeWidth(penStrokeWidth, PEN_STROKE_WIDTH),
      });
    },
    [persistAnnotationToolPrefs],
  );

  const handleHighlightPresetChange = useCallback(
    (highlightPresetId: string) => {
      persistAnnotationToolPrefs({ highlightPresetId });
    },
    [persistAnnotationToolPrefs],
  );

  const handleHighlightStrokeWidthChange = useCallback(
    (highlightStrokeWidth: number) => {
      persistAnnotationToolPrefs({
        highlightStrokeWidth: clampStrokeWidth(highlightStrokeWidth, HIGHLIGHT_STROKE_WIDTH),
      });
    },
    [persistAnnotationToolPrefs],
  );

  const handleHighlightStrokeModeChange = useCallback(
    (highlightStrokeMode: HighlightStrokeMode) => {
      persistAnnotationToolPrefs({ highlightStrokeMode });
    },
    [persistAnnotationToolPrefs],
  );

  const handleCoverStrokeWidthChange = useCallback(
    (coverStrokeWidth: number) => {
      persistAnnotationToolPrefs({
        coverStrokeWidth: clampStrokeWidth(coverStrokeWidth, COVER_STROKE_WIDTH),
      });
    },
    [persistAnnotationToolPrefs],
  );

  const handleCoverDrawModeChange = useCallback(
    (coverDrawMode: CoverDrawMode) => {
      persistAnnotationToolPrefs({ coverDrawMode });
    },
    [persistAnnotationToolPrefs],
  );

  const applyLocalAnnotationUpdate = useCallback(
    (annotationId: string, input: UpdatePdfAnnotationInput): PdfAnnotation | null => {
      const draft = draftAnnotationsRef.current.find((item) => item.id === annotationId);
      if (draft) {
        const updated: PdfAnnotation = {
          ...draft,
          geometry: input.geometry ?? draft.geometry,
          color: input.color ?? draft.color,
          updatedAt: new Date().toISOString(),
        };
        setDraftAnnotations((current) =>
          current.map((item) => (item.id === annotationId ? updated : item)),
        );
        return updated;
      }

      const saved = annotations.find((item) => item.id === annotationId);
      if (!saved) {
        return null;
      }

      const pending = pendingUpdatesRef.current[annotationId];
      const mergedBase: PdfAnnotation = {
        ...saved,
        geometry: pending?.geometry ?? saved.geometry,
        color: pending?.color ?? saved.color,
      };
      const updated: PdfAnnotation = {
        ...mergedBase,
        geometry: input.geometry ?? mergedBase.geometry,
        color: input.color ?? mergedBase.color,
        updatedAt: new Date().toISOString(),
      };

      setPendingUpdates((current) => ({
        ...current,
        [annotationId]: {
          geometry: updated.geometry,
          color: updated.color,
        },
      }));
      return updated;
    },
    [annotations],
  );

  const displayAnnotations = useMemo(() => {
    const deleted = new Set(pendingDeletionIds);
    return [
      ...annotations
        .filter((annotation) => !deleted.has(annotation.id))
        .map((annotation) => {
          const update = pendingUpdates[annotation.id];
          if (!update) {
            return annotation;
          }
          return {
            ...annotation,
            geometry: update.geometry ?? annotation.geometry,
            color: update.color ?? annotation.color,
          };
        }),
      ...draftAnnotations,
    ];
  }, [annotations, draftAnnotations, pendingDeletionIds, pendingUpdates]);

  const penAppearance = resolvePresetAppearance(
    'stroke',
    annotationToolPrefs.penPresetId,
    inverted,
  );
  const highlightAppearance = resolvePresetAppearance(
    'highlight',
    annotationToolPrefs.highlightPresetId,
    inverted,
  );
  const penColor = penAppearance.stroke;
  const highlightColor = highlightAppearance.stroke;
  const laserColor = resolvePresetStroke('stroke', LASER_DEFAULT_PRESET_ID, inverted);
  const penStrokeWidth = annotationToolPrefs.penStrokeWidth;
  const highlightStrokeWidth = annotationToolPrefs.highlightStrokeWidth;
  const highlightStrokeMode = annotationToolPrefs.highlightStrokeMode;
  const coverStrokeWidth = annotationToolPrefs.coverStrokeWidth;
  const coverDrawMode = annotationToolPrefs.coverDrawMode;
  const laserStrokeWidth = LASER_STROKE_WIDTH;

  const activeDirectedSet = directedSetOptions.find((option) => option.id === activeDirectedSetId);
  const canEditActiveDirectedSet = Boolean(activeDirectedSet?.canEdit);

  const annotationReadOnly =
    !userId ||
    (activeLayer === 'section' && (!canEditSectionLayer || !activeSectionId)) ||
    (activeLayer === 'directed' && (!canEditActiveDirectedSet || !activeDirectedSetId));

  const hasUnsavedChanges =
    draftAnnotations.length > 0
    || pendingDeletionIds.length > 0
    || Object.keys(pendingUpdates).length > 0;

  const canEraseAnnotation = useCallback(
    (annotation: PdfAnnotation) => {
      if (!userId) {
        return false;
      }

      if (isDraftAnnotationId(annotation.id)) {
        return true;
      }

      if (annotation.authorUserId !== userId) {
        return false;
      }

      if (annotation.layer === 'personal') {
        return true;
      }

      if (annotation.layer === 'section') {
        return (
          annotation.sectionId !== null &&
          leadOptions.some((option) => option.id === annotation.sectionId)
        );
      }

      if (annotation.layer === 'directed') {
        const setId = annotation.annotationSetId;
        if (!setId) {
          return false;
        }

        const matchingSet = directedSetOptions.find((option) => option.id === setId);
        if (matchingSet?.canEdit) {
          return true;
        }

        if (setId.startsWith('draft-set-')) {
          return directedSetOptions.some((option) => option.canEdit);
        }

        return false;
      }

      return false;
    },
    [userId, leadOptions, directedSetOptions],
  );

  const persistDraftChanges = useCallback(async (): Promise<boolean> => {
    if (!userId) {
      return false;
    }

    if (isSavingRef.current) {
      saveQueuedRef.current = true;
      return false;
    }

    const deletionsToProcess = [...pendingDeletionIdsRef.current];
    const draftsToProcess = [...draftAnnotationsRef.current];
    const updatesToProcess = { ...pendingUpdatesRef.current };

    if (
      deletionsToProcess.length === 0
      && draftsToProcess.length === 0
      && Object.keys(updatesToProcess).length === 0
    ) {
      return true;
    }

    isSavingRef.current = true;
    setSaveStatus('saving');

    const draftIdsToSave = new Set(draftsToProcess.map((draft) => draft.id));
    inFlightSaveDraftIdsRef.current = draftIdsToSave;
    const deletionIdsToSave = new Set(deletionsToProcess);
    const idMapping = new Map<string, string>();
    let allSucceeded = true;

    for (const annotationId of deletionsToProcess) {
      await onAnnotationDelete(annotationId);
    }

    for (const draft of draftsToProcess) {
      const created = await onAnnotationCreate(draftToCreateInput(draft));
      if (!created) {
        allSucceeded = false;
        break;
      }
      idMapping.set(draft.id, created.id);
    }

    const updateIdsToProcess = Object.keys(updatesToProcess);
    for (const annotationId of updateIdsToProcess) {
      const updated = await onAnnotationUpdate(annotationId, updatesToProcess[annotationId]!);
      if (!updated) {
        allSucceeded = false;
        break;
      }
    }

    if (allSucceeded) {
      const undoneDuringSave = undoneDuringSaveDraftIdsRef.current;
      const deletionIdsFromUndoneSave = new Set<string>();
      for (const draftId of undoneDuringSave) {
        const savedId = idMapping.get(draftId);
        if (savedId) {
          deletionIdsFromUndoneSave.add(savedId);
        }
      }
      undoneDuringSaveDraftIdsRef.current = new Set();

      setPendingDeletionIds((current) => {
        const next = current.filter((annotationId) => !deletionIdsToSave.has(annotationId));
        for (const annotationId of deletionIdsFromUndoneSave) {
          if (!next.includes(annotationId)) {
            next.push(annotationId);
          }
        }
        return next;
      });
      setDraftAnnotations((current) =>
        current.filter((draft) => !draftIdsToSave.has(draft.id)),
      );
      setPendingUpdates((current) => {
        const next = { ...current };
        for (const annotationId of updateIdsToProcess) {
          delete next[annotationId];
        }
        return next;
      });

      if (idMapping.size > 0) {
        setSessionUndoStack((stack) =>
          stack.map((entry) => {
            if (entry.kind === 'create') {
              const mappedId = idMapping.get(entry.annotationId);
              return mappedId ? { kind: 'create', annotationId: mappedId } : entry;
            }

            if (entry.kind === 'delete' && entry.wasDraft) {
              const mappedId = idMapping.get(entry.annotation.id);
              if (mappedId) {
                return {
                  kind: 'delete',
                  wasDraft: false,
                  annotation: { ...entry.annotation, id: mappedId },
                };
              }
            }

            return entry;
          }),
        );
      }

      if (savedIndicatorTimeoutRef.current !== null) {
        window.clearTimeout(savedIndicatorTimeoutRef.current);
      }
      setSaveStatus('saved');
      savedIndicatorTimeoutRef.current = window.setTimeout(() => {
        savedIndicatorTimeoutRef.current = null;
        setSaveStatus('idle');
      }, SAVED_INDICATOR_MS);
    } else {
      undoneDuringSaveDraftIdsRef.current = new Set();
      setSaveStatus('error');
    }

    inFlightSaveDraftIdsRef.current = new Set();
    isSavingRef.current = false;

    const shouldRetry =
      saveQueuedRef.current ||
      pendingDeletionIdsRef.current.some((id) => !deletionIdsToSave.has(id)) ||
      draftAnnotationsRef.current.some((draft) => !draftIdsToSave.has(draft.id)) ||
      Object.keys(pendingUpdatesRef.current).some(
        (annotationId) => !(annotationId in updatesToProcess),
      );
    saveQueuedRef.current = false;

    if (shouldRetry) {
      void persistDraftChangesRef.current();
    }

    return allSucceeded;
  }, [userId, onAnnotationDelete, onAnnotationCreate, onAnnotationUpdate]);
  persistDraftChangesRef.current = persistDraftChanges;

  useEffect(() => {
    if (!isAnnotating || !userId) {
      return;
    }

    if (!hasUnsavedChanges) {
      setSaveStatus((current) => (current === 'pending' ? 'idle' : current));
      return;
    }

    setSaveStatus((current) => (current === 'saving' ? current : 'pending'));

    autoSaveTimeoutRef.current = window.setTimeout(() => {
      autoSaveTimeoutRef.current = null;
      void persistDraftChangesRef.current();
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (autoSaveTimeoutRef.current !== null) {
        window.clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }
    };
  }, [
    draftAnnotations,
    pendingDeletionIds,
    pendingUpdates,
    isAnnotating,
    hasUnsavedChanges,
    userId,
    persistDraftChanges,
  ]);

  useEffect(
    () => () => {
      if (autoSaveTimeoutRef.current !== null) {
        window.clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }
      if (savedIndicatorTimeoutRef.current !== null) {
        window.clearTimeout(savedIndicatorTimeoutRef.current);
      }
      if (
        isAnnotatingRef.current &&
        (draftAnnotationsRef.current.length > 0
          || pendingDeletionIdsRef.current.length > 0
          || Object.keys(pendingUpdatesRef.current).length > 0)
      ) {
        void persistDraftChangesRef.current();
      }
    },
    [],
  );

  const addDraftAnnotation = useCallback(
    (input: Omit<CreatePdfAnnotationInput, 'pieceFileId'>) => {
      if (!userId) {
        return;
      }
      const draft = createDraftAnnotation(input, userId);
      hasAnnotatedRef.current = true;
      setDraftAnnotations((current) => [...current, draft]);
      setSessionUndoStack((current) => [...current, { kind: 'create', annotationId: draft.id }]);
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
        color: formatPresetColor(annotationToolPrefs.penPresetId),
        sectionId: activeLayer === 'section' ? activeSectionId : null,
        annotationSetId: activeLayer === 'directed' ? activeDirectedSetId : null,
      });
    },
    [
      annotationToolPrefs.penPresetId,
      activeLayer,
      activeSectionId,
      activeDirectedSetId,
      annotationReadOnly,
      addDraftAnnotation,
    ],
  );

  const addHighlightDraftAnnotation = useCallback(
    (pageNumber: number, geometry: StrokeGeometry | HighlightGeometry) => {
      if (annotationReadOnly) {
        return;
      }

      addDraftAnnotation({
        pageNumber,
        layer: activeLayer,
        type: 'highlight',
        geometry,
        color: formatPresetColor(annotationToolPrefs.highlightPresetId),
        sectionId: activeLayer === 'section' ? activeSectionId : null,
        annotationSetId: activeLayer === 'directed' ? activeDirectedSetId : null,
      });
    },
    [
      annotationToolPrefs.highlightPresetId,
      activeLayer,
      activeSectionId,
      activeDirectedSetId,
      annotationReadOnly,
      addDraftAnnotation,
    ],
  );

  const handleHighlightComplete = useCallback(
    (pageNumber: number, geometry: StrokeGeometry) => {
      addHighlightDraftAnnotation(pageNumber, geometry);
    },
    [addHighlightDraftAnnotation],
  );

  const handleHighlightRectComplete = useCallback(
    (pageNumber: number, geometry: HighlightGeometry) => {
      addHighlightDraftAnnotation(pageNumber, geometry);
    },
    [addHighlightDraftAnnotation],
  );

  const addCoverDraftAnnotation = useCallback(
    (pageNumber: number, geometry: StrokeGeometry | HighlightGeometry) => {
      if (annotationReadOnly) {
        return;
      }

      addDraftAnnotation({
        pageNumber,
        layer: activeLayer,
        type: 'cover',
        geometry,
        color: COVER_ANNOTATION_COLOR,
        sectionId: activeLayer === 'section' ? activeSectionId : null,
        annotationSetId: activeLayer === 'directed' ? activeDirectedSetId : null,
      });
    },
    [
      activeLayer,
      activeSectionId,
      activeDirectedSetId,
      annotationReadOnly,
      addDraftAnnotation,
    ],
  );

  const handleCoverComplete = useCallback(
    (pageNumber: number, geometry: StrokeGeometry) => {
      addCoverDraftAnnotation(pageNumber, geometry);
    },
    [addCoverDraftAnnotation],
  );

  const handleCoverRectComplete = useCallback(
    (pageNumber: number, geometry: HighlightGeometry) => {
      addCoverDraftAnnotation(pageNumber, geometry);
    },
    [addCoverDraftAnnotation],
  );

  const textDragBeforeRef = useRef<PdfAnnotation | null>(null);

  const openTextEditor = useCallback((session: TextAnnotationEditSession) => {
    setTextEditSession(session);
  }, []);

  const handleTextPlace = useCallback(
    (pageNumber: number, point: NormalizedPoint) => {
      if (annotationReadOnly) {
        return;
      }

      openTextEditor({
        pageNumber,
        colorPresetId: annotationToolPrefs.textPresetId,
        geometry: {
          x: point.x,
          y: point.y,
          content: '',
          fontSize: annotationToolPrefs.textFontSize,
          fontFamily: annotationToolPrefs.textFontFamily,
        },
      });
    },
    [
      annotationReadOnly,
      annotationToolPrefs.textFontFamily,
      annotationToolPrefs.textFontSize,
      annotationToolPrefs.textPresetId,
      openTextEditor,
    ],
  );

  const handleTextSelect = useCallback(
    (annotation: PdfAnnotation) => {
      if (annotation.type !== 'text' || !('content' in annotation.geometry)) {
        return;
      }

      openTextEditor({
        pageNumber: annotation.pageNumber,
        geometry: annotation.geometry as TextGeometry,
        editingId: annotation.id,
        colorPresetId:
          parsePresetColor(annotation.color) ?? annotationToolPrefs.textPresetId,
      });
    },
    [annotationToolPrefs.textPresetId, openTextEditor],
  );

  const handleTextMove = useCallback(
    (annotationId: string, point: NormalizedPoint) => {
      const current = displayAnnotations.find((annotation) => annotation.id === annotationId);
      if (!current || current.type !== 'text' || !('content' in current.geometry)) {
        return;
      }

      if (!textDragBeforeRef.current || textDragBeforeRef.current.id !== annotationId) {
        textDragBeforeRef.current = current;
      }

      const geometry: TextGeometry = {
        ...(current.geometry as TextGeometry),
        x: Math.min(1, Math.max(0, point.x)),
        y: Math.min(1, Math.max(0, point.y)),
      };
      applyLocalAnnotationUpdate(annotationId, { geometry });
    },
    [applyLocalAnnotationUpdate, displayAnnotations],
  );

  const handleTextEditCommit = useCallback(
    (session: TextAnnotationEditSession) => {
      const color = formatPresetColor(session.colorPresetId);
      setTextEditSession(null);
      persistAnnotationToolPrefs({
        textPresetId: session.colorPresetId,
        textFontSize: session.geometry.fontSize,
        textFontFamily: normalizeTextFontFamily(
          session.geometry.fontFamily ?? annotationToolPrefs.textFontFamily,
        ),
      });

      if (!session.editingId) {
        if (annotationReadOnly) {
          return;
        }

        addDraftAnnotation({
          pageNumber: session.pageNumber,
          layer: activeLayer,
          type: 'text',
          geometry: session.geometry,
          color,
          sectionId: activeLayer === 'section' ? activeSectionId : null,
          annotationSetId: activeLayer === 'directed' ? activeDirectedSetId : null,
        });
        return;
      }

      const before =
        displayAnnotations.find((annotation) => annotation.id === session.editingId) ?? null;
      const after = applyLocalAnnotationUpdate(session.editingId, {
        geometry: session.geometry,
        color,
      });

      if (before && after) {
        hasAnnotatedRef.current = true;
        setSessionUndoStack((current) => [...current, { kind: 'update', before, after }]);
      }
    },
    [
      activeDirectedSetId,
      activeLayer,
      activeSectionId,
      addDraftAnnotation,
      annotationReadOnly,
      applyLocalAnnotationUpdate,
      displayAnnotations,
      annotationToolPrefs.textFontFamily,
      persistAnnotationToolPrefs,
    ],
  );

  const handleTextEditorStylePreferenceChange = useCallback(
    (prefs: { textPresetId: string; textFontSize: number; textFontFamily: TextFontFamily }) => {
      persistAnnotationToolPrefs(prefs);
    },
    [persistAnnotationToolPrefs],
  );

  const handleTextEditCancel = useCallback(() => {
    setTextEditSession(null);
  }, []);

  useEffect(() => {
    if (!textEditSession || !isGesturing) {
      return;
    }

    if (textEditSession.geometry.content.trim()) {
      handleTextEditCommit(textEditSession);
    } else {
      handleTextEditCancel();
    }
  }, [handleTextEditCancel, handleTextEditCommit, isGesturing, textEditSession]);

  const handleTextDragComplete = useCallback(
    (annotationId: string) => {
      const before = textDragBeforeRef.current;
      textDragBeforeRef.current = null;
      if (!before || before.id !== annotationId) {
        return;
      }

      const after = displayAnnotations.find((annotation) => annotation.id === annotationId);
      if (!after || JSON.stringify(after.geometry) === JSON.stringify(before.geometry)) {
        return;
      }

      hasAnnotatedRef.current = true;
      setSessionUndoStack((current) => [...current, { kind: 'update', before, after }]);
    },
    [displayAnnotations],
  );

  const handleLaserStrokeComplete = useCallback(
    (pageNumber: number, geometry: StrokeGeometry) => {
      const id = crypto.randomUUID();
      const stroke: LaserStroke = {
        id,
        pageNumber,
        geometry,
        color: resolvePresetStroke('stroke', LASER_DEFAULT_PRESET_ID, inverted),
      };

      setLaserStrokes((current) => [...current, stroke]);

      scheduleLaserTimeout(() => {
        setLaserStrokes((current) =>
          current.map((item) => (item.id === id ? { ...item, fading: true } : item)),
        );

        scheduleLaserTimeout(() => {
          setLaserStrokes((current) => current.filter((item) => item.id !== id));
        }, LASER_FADE_OUT_MS);
      }, LASER_FADE_MS);
    },
    [inverted, scheduleLaserTimeout],
  );

  const handleEraseAnnotation = useCallback(
    (annotationId: string) => {
      setPendingUpdates((current) => {
        if (!(annotationId in current)) {
          return current;
        }
        const next = { ...current };
        delete next[annotationId];
        return next;
      });

      const draft = draftAnnotations.find((annotation) => annotation.id === annotationId);
      if (draft) {
        hasAnnotatedRef.current = true;
        setDraftAnnotations((current) =>
          current.filter((annotation) => annotation.id !== annotationId),
        );
        setSessionUndoStack((current) => [
          ...current,
          { kind: 'delete', annotation: draft, wasDraft: true },
        ]);
        return;
      }

      const saved = annotations.find((annotation) => annotation.id === annotationId);
      if (!saved) {
        return;
      }

      hasAnnotatedRef.current = true;
      setPendingDeletionIds((current) =>
        current.includes(annotationId) ? current : [...current, annotationId],
      );
      setSessionUndoStack((current) => [
        ...current,
        { kind: 'delete', annotation: saved, wasDraft: false },
      ]);
    },
    [draftAnnotations, annotations],
  );

  const handleTextEditDelete = useCallback(() => {
    const editingId = textEditSession?.editingId;
    if (!editingId) {
      return;
    }

    handleEraseAnnotation(editingId);
    setTextEditSession(null);
  }, [handleEraseAnnotation, textEditSession?.editingId]);

  const handleUndoLast = useCallback(() => {
    setSessionUndoStack((current) => {
      if (current.length === 0) {
        return current;
      }

      const entry = current[current.length - 1];
      hasAnnotatedRef.current = true;

      if (entry.kind === 'create') {
        const { annotationId } = entry;

        if (inFlightSaveDraftIdsRef.current.has(annotationId)) {
          undoneDuringSaveDraftIdsRef.current.add(annotationId);
        }

        const isDraft = draftAnnotationsRef.current.some((draft) => draft.id === annotationId);
        if (isDraft) {
          setDraftAnnotations((drafts) => drafts.filter((draft) => draft.id !== annotationId));
        } else {
          setPendingDeletionIds((pending) =>
            pending.includes(annotationId) ? pending : [...pending, annotationId],
          );
        }
      } else if (entry.kind === 'delete') {
        const { annotation, wasDraft } = entry;
        if (wasDraft) {
          setDraftAnnotations((drafts) =>
            drafts.some((draft) => draft.id === annotation.id)
              ? drafts
              : [...drafts, annotation],
          );
        } else {
          setPendingDeletionIds((pending) => pending.filter((id) => id !== annotation.id));
        }
      } else {
        const { before } = entry;
        if (isDraftAnnotationId(before.id)) {
          setDraftAnnotations((drafts) =>
            drafts.map((draft) => (draft.id === before.id ? before : draft)),
          );
        } else {
          const server = annotations.find((annotation) => annotation.id === before.id);
          const matchesServer =
            server
            && JSON.stringify(server.geometry) === JSON.stringify(before.geometry)
            && server.color === before.color;
          setPendingUpdates((current) => {
            const next = { ...current };
            if (matchesServer) {
              delete next[before.id];
            } else {
              next[before.id] = { geometry: before.geometry, color: before.color };
            }
            return next;
          });
        }
      }

      return current.slice(0, -1);
    });
  }, [annotations]);

  useEffect(() => {
    if (!isAnnotating) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.key.toLowerCase() !== 'z') {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLElement
        && (target.tagName === 'INPUT'
          || target.tagName === 'TEXTAREA'
          || target.tagName === 'SELECT'
          || target.isContentEditable)
      ) {
        return;
      }

      event.preventDefault();
      handleUndoLast();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isAnnotating, handleUndoLast]);

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
  const surfaceClass = inverted ? 'bg-black' : 'bg-bg';
  const slideClass = shouldAnimate
    ? slideDirection === 'next'
      ? 'upload-entry-slide-in-next'
      : 'upload-entry-slide-in-prev'
    : '';
  const effectiveInteractionMode: AnnotationInteractionMode = isAnnotating ? interactionMode : 'read';
  const annotationEditingFocus: AnnotationEditingFocus | null = !isAnnotating
    ? null
    : activeLayer === 'section' && activeSectionId
      ? { layer: 'section', sectionId: activeSectionId }
      : activeLayer === 'directed' && activeDirectedSetId
        ? { layer: 'directed', annotationSetId: activeDirectedSetId }
        : { layer: 'personal' };

  const pageFrameProps = {
    pdf,
    scale,
    inverted,
    annotations: displayAnnotations,
    interactionMode: effectiveInteractionMode,
    visibleLayers,
    editingFocus: annotationEditingFocus,
    penColor,
    highlightColor,
    penStrokeWidth,
    highlightStrokeWidth,
    highlightStrokeMode,
    coverStrokeWidth,
    coverDrawMode,
    laserStrokes,
    laserColor,
    laserStrokeWidth,
    readOnly:
      !userId ||
      (interactionMode !== 'eraser' &&
        interactionMode !== 'laser' &&
        annotationReadOnly),
    canEraseAnnotation,
    onStrokeComplete: handleStrokeComplete,
    onHighlightComplete: handleHighlightComplete,
    onHighlightRectComplete: handleHighlightRectComplete,
    onCoverComplete: handleCoverComplete,
    onCoverRectComplete: handleCoverRectComplete,
    onLaserStrokeComplete: handleLaserStrokeComplete,
    onEraseAnnotation: handleEraseAnnotation,
    onTextPlace: handleTextPlace,
    onTextSelect: handleTextSelect,
    onTextMove: handleTextMove,
    onTextDragComplete: handleTextDragComplete,
    textEditSession,
    onTextEditCommit: handleTextEditCommit,
    onTextEditCancel: handleTextEditCancel,
    onTextEditDelete: handleTextEditDelete,
    onTextEditorStylePreferenceChange: handleTextEditorStylePreferenceChange,
    gesturesActive: isGesturing || shortcutPickRequest != null || tocPickActive,
    navigationShortcuts: sortedNavigationShortcuts,
    onNavigationShortcutPress: goToShortcut,
    navigationShortcutsVisible,
    pulsingShortcutId,
    shortcutPulseToken,
    tocEntries: sortedTocEntries,
    showTocOverlay: tocEditorOpen || tocPanelOpen,
    onTocEntryPress: goToTocEntry,
    shortcutPickRequest,
    tocPickActive,
    onShortcutPageTap: handleShortcutPageTap,
  };

  const showFullscreenControls = !isFullscreen || isAnnotating || fullscreenControlsVisible;
  const controlsBarClass = isFullscreen
    ? `pdf-fullscreen-controls absolute inset-x-0 top-0 z-20 flex flex-col border-b border-border bg-surface/95 pt-[var(--safe-area-top)] shadow-md backdrop-blur-sm ${
        showFullscreenControls ? '' : 'pdf-fullscreen-controls-hidden'
      }`
    : 'flex shrink-0 flex-col border-b border-border';
  const rootClass = isFullscreen
    ? `fixed inset-x-0 z-50 flex flex-col ${surfaceClass}`
    : 'relative flex min-h-0 flex-1 flex-col';
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
    'flex flex-wrap items-center justify-center gap-x-5 gap-y-2 px-4 py-2';
  const toolbarIconButtonClass = (active = false) =>
    `inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-sm ${
      active ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text'
    }`;
  const annotationPanelRowClass = `${controlsRowClass} border-t border-border`;

  const renderAnnotationLayerMenu = () => (
    <AnnotationLayerVisibilityDropdown
      options={layerMenuOptions}
      onToggle={toggleLayerVisibility}
      onEditLayer={layerMenuOptions.some((option) => option.canEdit) ? handleLayerEdit : undefined}
      onCreateLayer={canEditDirectedLayer && onManageDirectedSet ? handleCreateLayer : undefined}
      activeEditValue={isAnnotating ? activeEditLayerValue : null}
      isAnnotating={isAnnotating}
      buttonClassName={toolbarIconButtonClass(false)}
    />
  );

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
        {Math.round(displayScale * 100)}%
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

  const renderAnnotationToolOptions = () => {
    if (
      interactionMode !== 'pen'
      && interactionMode !== 'highlight'
      && interactionMode !== 'cover'
    ) {
      return null;
    }

    return (
      <AnnotationToolOptions
        tool={interactionMode}
        inverted={inverted}
        selectedPresetId={
          interactionMode === 'pen'
            ? annotationToolPrefs.penPresetId
            : interactionMode === 'highlight'
              ? annotationToolPrefs.highlightPresetId
              : annotationToolPrefs.penPresetId
        }
        strokeWidth={
          interactionMode === 'pen'
            ? annotationToolPrefs.penStrokeWidth
            : interactionMode === 'highlight'
              ? annotationToolPrefs.highlightStrokeWidth
              : annotationToolPrefs.coverStrokeWidth
        }
        pageRenderWidth={pageRenderWidth}
        onPresetChange={
          interactionMode === 'pen'
            ? handlePenPresetChange
            : handleHighlightPresetChange
        }
        onStrokeWidthChange={
          interactionMode === 'pen'
            ? handlePenStrokeWidthChange
            : interactionMode === 'highlight'
              ? handleHighlightStrokeWidthChange
              : handleCoverStrokeWidthChange
        }
        highlightStrokeMode={annotationToolPrefs.highlightStrokeMode}
        onHighlightStrokeModeChange={handleHighlightStrokeModeChange}
        coverDrawMode={annotationToolPrefs.coverDrawMode}
        onCoverDrawModeChange={handleCoverDrawModeChange}
      />
    );
  };

  const annotationToolOptionsPanel = renderAnnotationToolOptions();

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

  const renderAnnotationSaveStatus = () => {
    const statusIconClass = 'flex h-8 w-8 shrink-0 items-center justify-center';

    if (saveStatus === 'error') {
      return (
        <span
          className={`${statusIconClass} text-red-600`}
          aria-live="polite"
          aria-label="Erro ao salvar"
        >
          <IconAlertTriangle className="h-4 w-4" aria-hidden />
        </span>
      );
    }

    if (saveStatus === 'saving' || saveStatus === 'pending') {
      return (
        <span
          className={`${statusIconClass} text-muted`}
          aria-live="polite"
          aria-label="Salvando"
        >
          <IconLoader className="h-4 w-4 animate-spin" aria-hidden />
        </span>
      );
    }

    return (
      <span
        className={`${statusIconClass} text-muted`}
        aria-live="polite"
        aria-label="Salvo"
      >
        <IconCheck className="h-4 w-4" aria-hidden />
      </span>
    );
  };

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
          <div className={`${controlsRowClass} justify-between`}>
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => void exitAnnotationMode()}
                disabled={saveStatus === 'saving'}
                className="flex shrink-0 items-center justify-center rounded-lg border border-border p-1 text-muted transition-colors hover:bg-surface hover:text-text disabled:opacity-50"
                aria-label="Voltar"
              >
                <IconChevronLeft className="h-6 w-6" />
              </button>
              {renderAnnotationLayerMenu()}
            </div>
            <div className="flex flex-1 flex-wrap items-center justify-center gap-x-3 gap-y-2">
              <AnnotationToolPicker
                interactionMode={interactionMode === 'read' ? 'pen' : interactionMode}
                onSelect={setInteractionMode}
                buttonClassName={toolbarIconButtonClass}
              />
              <span className="h-6 w-px shrink-0 bg-border" aria-hidden="true" />
              <button
                type="button"
                onClick={handleUndoLast}
                disabled={sessionUndoStack.length === 0}
                className={`${toolbarIconButtonClass()} disabled:opacity-50`}
                aria-label="Desfazer"
                title="Desfazer"
              >
                <IconUndo className="h-4 w-4" />
              </button>
            </div>
            {renderAnnotationSaveStatus()}
          </div>
          {annotationToolOptionsPanel && (
            <div className={annotationPanelRowClass}>{annotationToolOptionsPanel}</div>
          )}
        </>
      ) : (
        <>
          <div className={controlsRowClass}>
            <div className="flex shrink-0 items-center justify-center gap-1.5 lg:gap-2">
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
                  setMobileToolbarPanel((current) => (current === 'zoom' ? null : 'zoom'))
                }
                aria-label="Opções de zoom"
                aria-expanded={mobileToolbarPanel === 'zoom'}
                aria-pressed={mobileToolbarPanel === 'zoom'}
                title="Zoom"
                className={toolbarIconButtonClass(mobileToolbarPanel === 'zoom')}
              >
                <IconZoomIn className="h-4 w-4" />
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
                onClick={toggleNavigation}
                aria-label={
                  navigation === 'horizontal'
                    ? 'Usar navegação vertical'
                    : 'Usar navegação lateral'
                }
                title={navigation === 'horizontal' ? 'Navegação vertical' : 'Navegação lateral'}
                className={`${toolbarIconButtonClass()} lg:h-auto lg:w-auto lg:gap-1 lg:px-2 lg:py-2 `}
              >
                <IconArrowUpDown className={`h-4 w-4 ${navigation === 'horizontal' ? 'rotate-90' : ''}`} />
                <span className="hidden lg:inline">
                  {navigation === 'horizontal' ? 'Lateral' : 'Vertical'}
                </span>
              </button>
              {audioPicker?.visible && (
                <button
                  type="button"
                  onClick={audioPicker.onOpenPicker}
                  aria-label="Áudios da peça"
                  title="Áudios da peça"
                  className={toolbarIconButtonClass()}
                >
                  <IconMusic className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex shrink-0 items-center justify-center gap-1.5 lg:gap-2">
              <button
                type="button"
                onClick={toggleMetronome}
                aria-label={metronomeOpen ? 'Fechar metrônomo' : 'Abrir metrônomo'}
                aria-pressed={metronomeOpen}
                title={metronomeOpen ? 'Fechar metrônomo' : 'Metrônomo'}
                className={toolbarIconButtonClass(metronomeOpen)}
              >
                <IconMetronome className="h-4 w-4" />
              </button>
              {renderAnnotationLayerMenu()}
              {canManageNavigationShortcuts && onNavigationShortcutCreate ? (
                <button
                  type="button"
                  onClick={() => setShortcutEditorOpen(true)}
                  aria-label="Atalhos de navegação"
                  title="Atalhos"
                  className={toolbarIconButtonClass(shortcutEditorOpen)}
                >
                  <IconReturn className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
          {mobileToolbarPanel === 'zoom' && (
            <div className={annotationPanelRowClass}>{renderZoomControls()}</div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div
      className={rootClass}
      style={
        isFullscreen
          ? { top: 'var(--vv-offset-top)', height: 'var(--app-vh)' }
          : undefined
      }
    >
      {controlsBar}
      {metronomeOpen ? (
        <PdfViewerMetronomeBar userId={userId} onClose={closeMetronome} />
      ) : null}
      {inlineAudioBar}

      <div className="relative flex min-h-0 flex-1 flex-col">
        {navigation === 'horizontal' ? (
          <div
            ref={viewportRef}
            className={`relative flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden ${viewportPadding} ${surfaceClass}`}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            {...viewportInteractionProps}
          >
            <div key={horizontalSlideKey} className={`flex w-full items-center justify-center ${slideClass}`}>
              <div ref={contentRef} className="shrink-0" style={contentTransformStyle}>
                <PdfPageSlot
                  pageNumber={currentPage}
                  shouldRender
                  {...pageFrameProps}
                />
              </div>
            </div>
          </div>
        ) : (
          <div
            ref={scrollRef}
            className={`flex min-h-0 flex-1 flex-col items-center overflow-auto overscroll-contain ${
              isZoomed ? 'touch-pan-x touch-pan-y' : 'touch-pan-y'
            } ${viewportPadding} ${surfaceClass}`}
            {...viewportInteractionProps}
          >
            <div
              ref={contentRef}
              className="mx-auto w-max max-w-none space-y-2"
              style={contentTransformStyle}
            >
              {pageNumbers.map((pageNumber) => (
                <PdfPageSlot
                  key={pageNumber}
                  pageNumber={pageNumber}
                  shouldRender={visiblePages.has(pageNumber)}
                  {...pageFrameProps}
                />
              ))}
            </div>
          </div>
        )}

        <PdfViewerPageNavBar
          pdf={pdf}
          inverted={inverted}
          currentPage={currentPage}
          numPages={numPages}
          visible={pageNavBarVisible && !isAnnotating && !shortcutPickRequest && !tocPickActive}
          showTocButton={showTocButton}
          onGoHome={goToFirstPage}
          onOpenToc={openTocPanel}
          onPageChange={goToPage}
          onRequestClose={closePageNavBar}
        />
      </div>
      {(shortcutPickRequest != null || tocPickActive) && (
        <div className="pointer-events-none absolute inset-x-0 top-16 z-40 flex justify-center px-4">
          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-lg border border-primary bg-primary/90 px-4 py-2 text-sm font-medium text-white shadow-md">
            {navigation === 'horizontal' && (
              <>
                <button
                  type="button"
                  onClick={() => navigateHorizontal('prev')}
                  disabled={currentPage <= 1}
                  aria-label="Página anterior"
                  className="rounded border border-white/40 p-1 hover:bg-white/10 disabled:opacity-40"
                >
                  <IconChevronLeft className="h-4 w-4" />
                </button>
                <span className="tabular-nums">
                  {currentPage}/{numPages}
                </span>
                <button
                  type="button"
                  onClick={() => navigateHorizontal('next')}
                  disabled={currentPage >= numPages}
                  aria-label="Próxima página"
                  className="rounded border border-white/40 p-1 hover:bg-white/10 disabled:opacity-40"
                >
                  <IconChevronRight className="h-4 w-4" />
                </button>
              </>
            )}
            <p>
              {shortcutPickRequest?.kind === 'anchor'
                ? 'Toque na partitura para posicionar o botão'
                : shortcutPickRequest?.kind === 'target'
                  ? 'Toque na partitura para definir a posição de destino'
                  : 'Toque na partitura para marcar a posição da lição'}
            </p>
            <button
              type="button"
              onClick={() => {
                setShortcutPickRequest(null);
                setTocPickActive(false);
              }}
              className="rounded border border-white/40 px-2 py-0.5 text-xs hover:bg-white/10"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      <PieceFileTocPanel
        open={tocPanelOpen}
        entries={sortedTocEntries}
        canManage={canManageToc && Boolean(onTocEntryCreate)}
        onClose={() => setTocPanelOpen(false)}
        onEntryPress={goToTocEntry}
        onEdit={() => setTocEditorOpen(true)}
      />
      {canManageToc && onTocEntryCreate && (
        <PieceFileTocEditor
          open={tocEditorOpen}
          entries={sortedTocEntries}
          numPages={numPages}
          currentPage={currentPage}
          pickActive={tocPickActive}
          lastPick={tocPickResult}
          onPickConsumed={() => setTocPickResult(null)}
          onClose={() => {
            setTocEditorOpen(false);
            setTocPickActive(false);
            setTocPickResult(null);
          }}
          onRequestPick={setTocPickActive}
          onCreate={async (input) => {
            await onTocEntryCreate(input);
          }}
          onUpdate={async (id, input) => {
            if (onTocEntryUpdate) {
              await onTocEntryUpdate(id, input);
            }
          }}
          onDelete={async (id) => {
            if (onTocEntryDelete) {
              await onTocEntryDelete(id);
            }
          }}
          onReorder={async (orderedIds) => {
            if (onTocEntryReorder) {
              await onTocEntryReorder(orderedIds);
            }
          }}
        />
      )}
      {canManageNavigationShortcuts && onNavigationShortcutCreate && (
        <PdfNavigationShortcutEditor
          open={shortcutEditorOpen}
          shortcuts={sortedNavigationShortcuts}
          numPages={numPages}
          buttonsVisible={navigationShortcutsVisible}
          onButtonsVisibleChange={setNavigationShortcutsVisiblePreference}
          pickRequest={shortcutPickRequest}
          lastPick={shortcutPickResult}
          onPickConsumed={() => setShortcutPickResult(null)}
          onClose={() => {
            setShortcutEditorOpen(false);
            setShortcutPickRequest(null);
            setShortcutPickResult(null);
          }}
          onRequestPick={setShortcutPickRequest}
          onCreate={async (input) => {
            await onNavigationShortcutCreate(input);
          }}
          onUpdate={async (id, input) => {
            if (onNavigationShortcutUpdate) {
              await onNavigationShortcutUpdate(id, input);
            }
          }}
          onDelete={async (id) => {
            if (onNavigationShortcutDelete) {
              await onNavigationShortcutDelete(id);
            }
          }}
          onReorder={async (orderedIds) => {
            if (onNavigationShortcutReorder) {
              await onNavigationShortcutReorder(orderedIds);
            }
          }}
        />
      )}
      {readerInfo ? (
        <PdfReaderInfoModal
          open={readerInfo.open}
          onClose={readerInfo.onClose}
          piece={readerInfo.piece}
          part={readerInfo.part}
          allowDownload={allowDownload}
          downloadUrl={readerInfo.downloadUrl}
          downloadName={readerInfo.downloadName}
          onPrint={pdf && allowDownload ? handlePrint : undefined}
        />
      ) : null}
    </div>
  );
}
